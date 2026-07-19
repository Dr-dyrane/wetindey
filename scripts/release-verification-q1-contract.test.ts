import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  existsSync,
  lstatSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, isAbsolute, join, normalize, relative, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const REQUIRED_CATEGORIES = [
  "accessibility",
  "browser",
  "build",
  "legal",
  "map-sheet",
  "migration",
  "provenance",
  "pwa",
  "seed",
  "server-action",
  "trust",
] as const;

type Category = (typeof REQUIRED_CATEGORIES)[number];
type IssueGroup = "missingArtifacts" | "staleArtifacts" | "invalidArtifacts" | "repositoryFailures";

interface Issue {
  code: string;
  detail: string;
  category?: Category;
  path?: string;
}

interface Result {
  schemaVersion: 1;
  verdict: "PASS" | "REFUTED";
  candidateCommit: string | null;
  currentMainCommit: string | null;
  checkedAt: string;
  missingArtifacts: Issue[];
  staleArtifacts: Issue[];
  invalidArtifacts: Issue[];
  repositoryFailures: Issue[];
  disclaimer: string;
}

interface Manifest {
  candidateCommit: string | null;
  currentMainCommit: string | null;
  createdAt: number | null;
  artifacts: unknown[];
}

interface ArtifactReference {
  category: Category;
  path: string;
  sha256: string;
}

interface Attachment {
  path: string;
  sha256: string;
}

interface BuildRecord {
  workingDirectory: string;
  outputDirectory: string;
  command: string;
}

const COMMIT_SHA = /^[0-9a-f]{40}$/;
const FILE_SHA = /^[0-9a-f]{64}$/;
const MAX_JSON_BYTES = 2 * 1024 * 1024;
const MAX_ATTACHMENT_BYTES = 50 * 1024 * 1024;
const MAX_MANIFEST_AGE_MS = 60 * 60 * 1_000;
const MAX_EVIDENCE_LIFETIME_MS = 24 * 60 * 60 * 1_000;
const CLOCK_SKEW_MS = 5 * 60 * 1_000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function normalizedIdentity(value: unknown): string | null {
  const identity = asString(value);
  return identity ? identity.trim().normalize("NFKC").toLocaleLowerCase("en-US") : null;
}

function asCanonicalTime(value: unknown): number | null {
  if (typeof value !== "string") return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) && new Date(parsed).toISOString() === value ? parsed : null;
}

function digest(bytes: Buffer | string): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function isInside(root: string, candidate: string): boolean {
  const fromRoot = relative(root, candidate);
  return fromRoot === "" || (!fromRoot.startsWith("..") && !isAbsolute(fromRoot));
}

function resolveBundlePath(bundleRoot: string, path: string): string | null {
  if (
    !path ||
    isAbsolute(path) ||
    path.includes("\\") ||
    normalize(path) !== path ||
    path === ".." ||
    path.startsWith("../")
  ) {
    return null;
  }
  const resolved = resolve(bundleRoot, path);
  return isInside(bundleRoot, resolved) ? resolved : null;
}

function readRegularFile(path: string, maximumBytes: number): Buffer {
  const stats = lstatSync(path);
  if (!stats.isFile() || stats.isSymbolicLink()) throw new Error("not a regular file");
  if (stats.size > maximumBytes) throw new Error(`exceeds ${maximumBytes} bytes`);
  return readFileSync(path);
}

function readJson(path: string): unknown {
  return JSON.parse(readRegularFile(path, MAX_JSON_BYTES).toString("utf8")) as unknown;
}

function git(repoRoot: string, args: string[]): string {
  return execFileSync("git", ["-C", repoRoot, ...args], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function add(
  groups: Record<IssueGroup, Issue[]>,
  group: IssueGroup,
  code: string,
  detail: string,
  category?: Category,
  path?: string
): void {
  groups[group].push({
    code,
    detail,
    ...(category ? { category } : {}),
    ...(path ? { path } : {}),
  });
}

function parseManifest(value: unknown, groups: Record<IssueGroup, Issue[]>): Manifest {
  if (!isRecord(value)) {
    add(groups, "invalidArtifacts", "MANIFEST_SCHEMA", "manifest must be a JSON object");
    return { candidateCommit: null, currentMainCommit: null, createdAt: null, artifacts: [] };
  }
  if (value.schemaVersion !== 1) {
    add(groups, "invalidArtifacts", "MANIFEST_VERSION", "manifest schemaVersion must equal 1");
  }

  const candidateCommit = asString(value.candidateCommit);
  const currentMainCommit = asString(value.currentMainCommit);
  const createdAt = asCanonicalTime(value.createdAt);
  if (!candidateCommit || !COMMIT_SHA.test(candidateCommit)) {
    add(
      groups,
      "invalidArtifacts",
      "CANDIDATE_SHA",
      "candidateCommit must be a lowercase 40-character commit SHA"
    );
  }
  if (!currentMainCommit || !COMMIT_SHA.test(currentMainCommit)) {
    add(
      groups,
      "invalidArtifacts",
      "CURRENT_MAIN_SHA",
      "currentMainCommit must be a lowercase 40-character commit SHA"
    );
  }
  if (createdAt === null) {
    add(
      groups,
      "invalidArtifacts",
      "MANIFEST_TIME",
      "createdAt must be a canonical UTC ISO-8601 timestamp"
    );
  }
  if (!Array.isArray(value.artifacts)) {
    add(groups, "invalidArtifacts", "MANIFEST_ARTIFACTS", "artifacts must be an array");
  }

  return {
    candidateCommit: candidateCommit && COMMIT_SHA.test(candidateCommit) ? candidateCommit : null,
    currentMainCommit:
      currentMainCommit && COMMIT_SHA.test(currentMainCommit) ? currentMainCommit : null,
    createdAt,
    artifacts: Array.isArray(value.artifacts) ? value.artifacts : [],
  };
}

function validateRepository(
  repoRootInput: string,
  manifest: Manifest,
  groups: Record<IssueGroup, Issue[]>
): string | null {
  let repoRoot: string;
  try {
    repoRoot = realpathSync(repoRootInput);
    if (realpathSync(git(repoRoot, ["rev-parse", "--show-toplevel"])) !== repoRoot) {
      add(groups, "repositoryFailures", "REPO_ROOT", "--repo must name the Git top level");
      return null;
    }
  } catch {
    add(groups, "repositoryFailures", "REPO_UNREADABLE", "--repo is not a readable Git worktree");
    return null;
  }

  try {
    const branch = git(repoRoot, ["symbolic-ref", "--quiet", "--short", "HEAD"]);
    if (branch !== "main") {
      add(
        groups,
        "repositoryFailures",
        "BRANCH_NOT_MAIN",
        `candidate branch is ${branch}, not main`
      );
    }
  } catch {
    add(groups, "repositoryFailures", "DETACHED_HEAD", "candidate HEAD is detached");
  }

  let head: string | null = null;
  let currentMain: string | null = null;
  try {
    head = git(repoRoot, ["rev-parse", "HEAD"]);
  } catch {
    add(groups, "repositoryFailures", "HEAD_MISSING", "candidate HEAD cannot be resolved");
  }
  try {
    currentMain = git(repoRoot, ["rev-parse", "refs/remotes/origin/main"]);
  } catch {
    add(
      groups,
      "repositoryFailures",
      "CURRENT_MAIN_MISSING",
      "refs/remotes/origin/main cannot be resolved"
    );
  }

  if (manifest.candidateCommit && manifest.candidateCommit !== head) {
    add(
      groups,
      "repositoryFailures",
      "CANDIDATE_NOT_HEAD",
      `manifest candidate ${manifest.candidateCommit} does not equal HEAD ${head ?? "unknown"}`
    );
  }
  if (manifest.currentMainCommit && manifest.currentMainCommit !== currentMain) {
    add(
      groups,
      "repositoryFailures",
      "CURRENT_MAIN_STALE",
      `manifest current main ${manifest.currentMainCommit} does not equal origin/main ${currentMain ?? "unknown"}`
    );
  }
  if (manifest.candidateCommit && manifest.currentMainCommit) {
    try {
      git(repoRoot, [
        "merge-base",
        "--is-ancestor",
        manifest.currentMainCommit,
        manifest.candidateCommit,
      ]);
    } catch {
      add(
        groups,
        "repositoryFailures",
        "CURRENT_MAIN_NOT_ANCESTOR",
        `${manifest.currentMainCommit} is not an ancestor of ${manifest.candidateCommit}`
      );
    }
  }

  try {
    if (git(repoRoot, ["status", "--porcelain=v1", "--untracked-files=all"])) {
      add(groups, "repositoryFailures", "DIRTY_WORKTREE", "candidate worktree is not clean");
    }
  } catch {
    add(groups, "repositoryFailures", "STATUS_UNREADABLE", "candidate status cannot be read");
  }
  return repoRoot;
}

function parseReference(value: unknown): ArtifactReference | null {
  if (!isRecord(value)) return null;
  const category = asString(value.category);
  const path = asString(value.path);
  const sha256 = asString(value.sha256);
  if (
    !category ||
    !REQUIRED_CATEGORIES.includes(category as Category) ||
    !path ||
    !sha256 ||
    !FILE_SHA.test(sha256)
  ) {
    return null;
  }
  return { category: category as Category, path, sha256 };
}

function parseAttachment(value: unknown): Attachment | null {
  if (!isRecord(value)) return null;
  const path = asString(value.path);
  const sha256 = asString(value.sha256);
  return path && sha256 && FILE_SHA.test(sha256) ? { path, sha256 } : null;
}

function parseBuild(value: unknown): BuildRecord | null {
  if (!isRecord(value)) return null;
  const workingDirectory = asString(value.workingDirectory);
  const outputDirectory = asString(value.outputDirectory);
  const command = asString(value.command);
  return workingDirectory && outputDirectory && command
    ? { workingDirectory, outputDirectory, command }
    : null;
}

function validateBuild(
  value: unknown,
  repoRoot: string | null,
  artifactPath: string,
  groups: Record<IssueGroup, Issue[]>
): void {
  const build = parseBuild(value);
  if (!build) {
    add(
      groups,
      "invalidArtifacts",
      "BUILD_RECORD_MISSING",
      "build artifact must record workingDirectory, outputDirectory, and command",
      "build",
      artifactPath
    );
    return;
  }
  if (!isAbsolute(build.workingDirectory) || !isAbsolute(build.outputDirectory)) {
    add(
      groups,
      "invalidArtifacts",
      "BUILD_PATH_NOT_ABSOLUTE",
      "build directories must be absolute",
      "build",
      artifactPath
    );
    return;
  }

  const declaredWorkspace = resolve(build.workingDirectory);
  const declaredOutput = resolve(build.outputDirectory);
  const declaredOutputFromWorkspace = relative(declaredWorkspace, declaredOutput);
  let workspace = declaredWorkspace;
  let output = declaredOutput;
  try {
    const workspaceStats = lstatSync(declaredWorkspace);
    workspace = realpathSync(declaredWorkspace);
    if (!workspaceStats.isDirectory() || workspaceStats.isSymbolicLink()) {
      throw new Error("build workspace is not a real, non-symlink directory");
    }
  } catch (error) {
    add(
      groups,
      "invalidArtifacts",
      "BUILD_PATH_UNVERIFIABLE",
      error instanceof Error ? error.message : "build workspace cannot be verified",
      "build",
      artifactPath
    );
  }
  output = resolve(workspace, declaredOutputFromWorkspace);
  try {
    const outputStats = lstatSync(declaredOutput);
    output = realpathSync(declaredOutput);
    if (!outputStats.isDirectory() || outputStats.isSymbolicLink()) {
      throw new Error("build output is not a real, non-symlink directory");
    }
  } catch (error) {
    add(
      groups,
      "invalidArtifacts",
      "BUILD_PATH_UNVERIFIABLE",
      error instanceof Error ? error.message : "build output cannot be verified",
      "build",
      artifactPath
    );
  }
  const outputFromWorkspace = relative(workspace, output);
  const sharedNext = repoRoot ? resolve(repoRoot, ".next") : null;
  if (
    basename(output) !== ".next" ||
    !outputFromWorkspace ||
    outputFromWorkspace.startsWith("..") ||
    isAbsolute(outputFromWorkspace)
  ) {
    add(
      groups,
      "invalidArtifacts",
      "BUILD_OUTPUT_NOT_ISOLATED",
      "build output must be a .next directory inside its recorded workspace",
      "build",
      artifactPath
    );
  }
  if (
    repoRoot &&
    (workspace === repoRoot ||
      isInside(repoRoot, workspace) ||
      output === sharedNext ||
      (sharedNext !== null && isInside(sharedNext, output)))
  ) {
    add(
      groups,
      "invalidArtifacts",
      "BUILD_SHARED_NEXT",
      "production build evidence uses the candidate workspace or its shared .next",
      "build",
      artifactPath
    );
  }
  if (!["npm run build", "npx next build", "next build"].includes(build.command)) {
    add(
      groups,
      "invalidArtifacts",
      "BUILD_COMMAND_INVALID",
      "build command is not an explicit production Next build",
      "build",
      artifactPath
    );
  }
}

function validateArtifact(
  reference: ArtifactReference,
  value: unknown,
  bundleRoot: string,
  repoRoot: string | null,
  manifest: Manifest,
  now: number,
  groups: Record<IssueGroup, Issue[]>
): void {
  if (!isRecord(value)) {
    add(
      groups,
      "invalidArtifacts",
      "ARTIFACT_SCHEMA",
      "artifact must be a JSON object",
      reference.category,
      reference.path
    );
    return;
  }
  if (value.schemaVersion !== 1) {
    add(
      groups,
      "invalidArtifacts",
      "ARTIFACT_VERSION",
      "artifact schemaVersion must equal 1",
      reference.category,
      reference.path
    );
  }
  if (value.category !== reference.category) {
    add(
      groups,
      "invalidArtifacts",
      "ARTIFACT_CATEGORY",
      "artifact category does not match its manifest reference",
      reference.category,
      reference.path
    );
  }
  if (value.candidateCommit !== manifest.candidateCommit) {
    add(
      groups,
      "invalidArtifacts",
      "ARTIFACT_CANDIDATE",
      "artifact is not bound to the exact candidate commit",
      reference.category,
      reference.path
    );
  }
  if (value.verdict !== "PASS") {
    add(
      groups,
      "invalidArtifacts",
      "ARTIFACT_NOT_PASS",
      "referenced artifact verdict must be PASS",
      reference.category,
      reference.path
    );
  }

  const capturedAt = asCanonicalTime(value.capturedAt);
  const expiresAt = asCanonicalTime(value.expiresAt);
  if (capturedAt === null || expiresAt === null) {
    add(
      groups,
      "invalidArtifacts",
      "ARTIFACT_TIME",
      "capturedAt and expiresAt must be canonical UTC timestamps",
      reference.category,
      reference.path
    );
  } else {
    if (expiresAt <= capturedAt || expiresAt - capturedAt > MAX_EVIDENCE_LIFETIME_MS) {
      add(
        groups,
        "invalidArtifacts",
        "ARTIFACT_LIFETIME",
        "evidence lifetime must be positive and no longer than 24 hours",
        reference.category,
        reference.path
      );
    }
    if (
      capturedAt > now + CLOCK_SKEW_MS ||
      (manifest.createdAt !== null && capturedAt > manifest.createdAt)
    ) {
      add(
        groups,
        "invalidArtifacts",
        "ARTIFACT_FROM_FUTURE",
        "artifact capture time is later than the manifest or clock-skew allowance",
        reference.category,
        reference.path
      );
    }
    if (now > expiresAt) {
      add(
        groups,
        "staleArtifacts",
        "ARTIFACT_EXPIRED",
        `artifact expired at ${new Date(expiresAt).toISOString()}`,
        reference.category,
        reference.path
      );
    }
  }

  const producer = normalizedIdentity(value.producer);
  const reviewer = normalizedIdentity(value.independentReviewer);
  if (!producer || !reviewer || producer === reviewer) {
    add(
      groups,
      "invalidArtifacts",
      "INDEPENDENCE_MISSING",
      "producer and independentReviewer must be non-empty and different",
      reference.category,
      reference.path
    );
  }

  const attachments = new Map<string, Attachment>();
  if (!Array.isArray(value.attachments)) {
    add(
      groups,
      "invalidArtifacts",
      "ATTACHMENTS_SCHEMA",
      "attachments must be an array",
      reference.category,
      reference.path
    );
  } else {
    for (const item of value.attachments) {
      const attachment = parseAttachment(item);
      if (!attachment) {
        add(
          groups,
          "invalidArtifacts",
          "ATTACHMENT_REFERENCE",
          "each attachment needs a path and SHA-256",
          reference.category,
          reference.path
        );
      } else if (attachments.has(attachment.path)) {
        add(
          groups,
          "invalidArtifacts",
          "ATTACHMENT_DUPLICATE",
          "attachment paths must be unique",
          reference.category,
          attachment.path
        );
      } else {
        attachments.set(attachment.path, attachment);
      }
    }
  }

  const usedAttachments = new Set<string>();
  if (!Array.isArray(value.claims) || value.claims.length === 0) {
    add(
      groups,
      "invalidArtifacts",
      "CLAIMS_MISSING",
      "artifact must contain at least one evidence-backed claim",
      reference.category,
      reference.path
    );
  } else {
    for (const claim of value.claims) {
      if (
        !isRecord(claim) ||
        !asString(claim.id) ||
        !asString(claim.summary) ||
        !Array.isArray(claim.evidence)
      ) {
        add(
          groups,
          "invalidArtifacts",
          "CLAIM_SCHEMA",
          "each claim needs id, summary, and evidence paths",
          reference.category,
          reference.path
        );
        continue;
      }
      if (claim.evidence.length === 0) {
        add(
          groups,
          "invalidArtifacts",
          "CLAIM_UNSUPPORTED",
          `${String(claim.id)} has no referenced evidence`,
          reference.category,
          reference.path
        );
      }
      for (const evidencePath of claim.evidence) {
        if (typeof evidencePath !== "string" || !attachments.has(evidencePath)) {
          add(
            groups,
            "missingArtifacts",
            "CLAIM_EVIDENCE_MISSING",
            `${String(claim.id)} references undeclared evidence`,
            reference.category,
            typeof evidencePath === "string" ? evidencePath : reference.path
          );
        } else {
          usedAttachments.add(evidencePath);
        }
      }
    }
  }

  for (const attachment of attachments.values()) {
    if (!usedAttachments.has(attachment.path)) {
      add(
        groups,
        "invalidArtifacts",
        "ATTACHMENT_UNCLAIMED",
        "attachment is not referenced by a claim",
        reference.category,
        attachment.path
      );
    }
    const resolved = resolveBundlePath(bundleRoot, attachment.path);
    if (!resolved) {
      add(
        groups,
        "invalidArtifacts",
        "ATTACHMENT_PATH",
        "attachment path escapes the evidence bundle",
        reference.category,
        attachment.path
      );
    } else if (!existsSync(resolved)) {
      add(
        groups,
        "missingArtifacts",
        "ATTACHMENT_MISSING",
        "referenced attachment does not exist",
        reference.category,
        attachment.path
      );
    } else {
      try {
        const real = realpathSync(resolved);
        if (!isInside(bundleRoot, real)) throw new Error("resolves outside the evidence bundle");
        const actual = digest(readRegularFile(real, MAX_ATTACHMENT_BYTES));
        if (actual !== attachment.sha256) {
          add(
            groups,
            "invalidArtifacts",
            "ATTACHMENT_HASH",
            `expected ${attachment.sha256}, received ${actual}`,
            reference.category,
            attachment.path
          );
        }
      } catch (error) {
        add(
          groups,
          "invalidArtifacts",
          "ATTACHMENT_UNREADABLE",
          error instanceof Error ? error.message : "attachment cannot be read",
          reference.category,
          attachment.path
        );
      }
    }
  }

  if (reference.category !== "build" && value.build !== undefined) {
    add(
      groups,
      "invalidArtifacts",
      "BUILD_RECORD_WRONG_CATEGORY",
      "only build evidence may record build workspace metadata",
      reference.category,
      reference.path
    );
  }
}

function verify(manifestPathInput: string, repoRootInput: string, now = new Date()): Result {
  const groups: Record<IssueGroup, Issue[]> = {
    missingArtifacts: [],
    staleArtifacts: [],
    invalidArtifacts: [],
    repositoryFailures: [],
  };
  const baseResult = {
    schemaVersion: 1 as const,
    candidateCommit: null,
    currentMainCommit: null,
    checkedAt: now.toISOString(),
    disclaimer:
      "This gate verifies a content-addressed evidence bundle; it does not itself prove runtime behavior.",
  };

  let manifestPath: string;
  let bundleRoot: string;
  let manifestValue: unknown;
  try {
    manifestPath = realpathSync(manifestPathInput);
    bundleRoot = realpathSync(dirname(manifestPath));
    manifestValue = readJson(manifestPath);
  } catch (error) {
    add(
      groups,
      "missingArtifacts",
      "MANIFEST_MISSING",
      error instanceof Error ? error.message : "manifest cannot be read",
      undefined,
      manifestPathInput
    );
    return { ...baseResult, verdict: "REFUTED", ...groups };
  }

  const manifest = parseManifest(manifestValue, groups);
  const repoRoot = validateRepository(repoRootInput, manifest, groups);
  if (manifest.createdAt !== null) {
    if (manifest.createdAt > now.getTime() + CLOCK_SKEW_MS) {
      add(groups, "invalidArtifacts", "MANIFEST_FROM_FUTURE", "manifest time is beyond clock skew");
    }
    if (now.getTime() - manifest.createdAt > MAX_MANIFEST_AGE_MS) {
      add(groups, "staleArtifacts", "MANIFEST_STALE", "manifest is older than 60 minutes");
    }
  }

  const references = new Map<Category, ArtifactReference>();
  const paths = new Set<string>();
  for (const value of manifest.artifacts) {
    const reference = parseReference(value);
    if (!reference) {
      add(groups, "invalidArtifacts", "ARTIFACT_REFERENCE", "artifact reference is invalid");
      continue;
    }
    if (references.has(reference.category)) {
      add(
        groups,
        "invalidArtifacts",
        "CATEGORY_DUPLICATE",
        "each evidence category must occur exactly once",
        reference.category,
        reference.path
      );
      continue;
    }
    if (paths.has(reference.path)) {
      add(
        groups,
        "invalidArtifacts",
        "ARTIFACT_REUSED",
        "one artifact cannot satisfy multiple categories",
        reference.category,
        reference.path
      );
      continue;
    }
    references.set(reference.category, reference);
    paths.add(reference.path);
  }

  for (const category of REQUIRED_CATEGORIES) {
    const reference = references.get(category);
    if (!reference) {
      add(
        groups,
        "missingArtifacts",
        "CATEGORY_MISSING",
        `required ${category} evidence is missing`,
        category
      );
      continue;
    }
    const resolved = resolveBundlePath(bundleRoot, reference.path);
    if (!resolved) {
      add(
        groups,
        "invalidArtifacts",
        "ARTIFACT_PATH",
        "artifact path escapes the evidence bundle",
        category,
        reference.path
      );
      continue;
    }
    if (!existsSync(resolved)) {
      add(
        groups,
        "missingArtifacts",
        "ARTIFACT_MISSING",
        "referenced artifact does not exist",
        category,
        reference.path
      );
      continue;
    }
    try {
      const real = realpathSync(resolved);
      if (!isInside(bundleRoot, real)) throw new Error("resolves outside the evidence bundle");
      const bytes = readRegularFile(real, MAX_JSON_BYTES);
      const actual = digest(bytes);
      if (actual !== reference.sha256) {
        add(
          groups,
          "invalidArtifacts",
          "ARTIFACT_HASH",
          `expected ${reference.sha256}, received ${actual}`,
          category,
          reference.path
        );
        continue;
      }
      const artifactValue = JSON.parse(bytes.toString("utf8")) as unknown;
      validateArtifact(
        reference,
        artifactValue,
        bundleRoot,
        repoRoot,
        manifest,
        now.getTime(),
        groups
      );
      if (category === "build") {
        validateBuild(
          isRecord(artifactValue) ? artifactValue.build : null,
          repoRoot,
          reference.path,
          groups
        );
      }
    } catch (error) {
      add(
        groups,
        "invalidArtifacts",
        "ARTIFACT_UNREADABLE",
        error instanceof Error ? error.message : "artifact cannot be read",
        category,
        reference.path
      );
    }
  }

  for (const issues of Object.values(groups)) {
    issues.sort((left, right) =>
      [left.code, left.category ?? "", left.path ?? "", left.detail]
        .join("\u0000")
        .localeCompare(
          [right.code, right.category ?? "", right.path ?? "", right.detail].join("\u0000")
        )
    );
  }
  const count = Object.values(groups).reduce((sum, issues) => sum + issues.length, 0);
  return {
    ...baseResult,
    verdict: count === 0 ? "PASS" : "REFUTED",
    candidateCommit: manifest.candidateCommit,
    currentMainCommit: manifest.currentMainCommit,
    ...groups,
  };
}

interface Fixture {
  root: string;
  repoRoot: string;
  bundleRoot: string;
  manifestPath: string;
  candidateCommit: string;
  currentMainCommit: string;
  now: Date;
}

function writeJson(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function fixtureGit(repoRoot: string, args: string[]): string {
  return execFileSync(
    "git",
    [
      "-c",
      "user.name=Q1 fixture",
      "-c",
      "user.email=q1-fixture@wetindey.invalid",
      "-C",
      repoRoot,
      ...args,
    ],
    { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }
  ).trim();
}

function createFixture(): Fixture {
  const root = mkdtempSync(join(tmpdir(), "wetindey-q1-"));
  const repoRoot = join(root, "candidate");
  const bundleRoot = join(root, "bundle");
  mkdirSync(repoRoot, { recursive: true });
  mkdirSync(bundleRoot, { recursive: true });
  fixtureGit(repoRoot, ["init", "-b", "main"]);
  writeFileSync(join(repoRoot, "base.txt"), "base\n", "utf8");
  fixtureGit(repoRoot, ["add", "base.txt"]);
  fixtureGit(repoRoot, ["commit", "-m", "base"]);
  const currentMainCommit = fixtureGit(repoRoot, ["rev-parse", "HEAD"]);
  fixtureGit(repoRoot, ["update-ref", "refs/remotes/origin/main", currentMainCommit]);
  writeFileSync(join(repoRoot, "candidate.txt"), "candidate\n", "utf8");
  fixtureGit(repoRoot, ["add", "candidate.txt"]);
  fixtureGit(repoRoot, ["commit", "-m", "candidate"]);
  const candidateCommit = fixtureGit(repoRoot, ["rev-parse", "HEAD"]);
  const now = new Date("2026-07-18T12:00:00.000Z");
  mkdirSync(join(root, "isolated-build-worktree", ".next"), {
    recursive: true,
  });

  const artifacts: ArtifactReference[] = [];
  for (const category of REQUIRED_CATEGORIES) {
    const evidencePath = `evidence/${category}.log`;
    const evidence = Buffer.from(`${category}\ncandidate=${candidateCommit}\n`, "utf8");
    mkdirSync(dirname(join(bundleRoot, evidencePath)), { recursive: true });
    writeFileSync(join(bundleRoot, evidencePath), evidence);
    const artifactPath = `artifacts/${category}.json`;
    const artifact: Record<string, unknown> = {
      schemaVersion: 1,
      category,
      candidateCommit,
      capturedAt: "2026-07-18T11:30:00.000Z",
      expiresAt: "2026-07-18T13:00:00.000Z",
      producer: `${category}-producer`,
      independentReviewer: `${category}-refuter`,
      verdict: "PASS",
      claims: [
        {
          id: `${category}-evidence`,
          summary: `Existing ${category} evidence passed for the candidate`,
          evidence: [evidencePath],
        },
      ],
      attachments: [{ path: evidencePath, sha256: digest(evidence) }],
    };
    if (category === "build") {
      artifact.build = {
        workingDirectory: join(root, "isolated-build-worktree"),
        outputDirectory: join(root, "isolated-build-worktree", ".next"),
        command: "npm run build",
      };
    }
    const fullArtifactPath = join(bundleRoot, artifactPath);
    writeJson(fullArtifactPath, artifact);
    artifacts.push({
      category,
      path: artifactPath,
      sha256: digest(readFileSync(fullArtifactPath)),
    });
  }

  const manifestPath = join(bundleRoot, "manifest.json");
  writeJson(manifestPath, {
    schemaVersion: 1,
    candidateCommit,
    currentMainCommit,
    createdAt: now.toISOString(),
    artifacts,
  });
  return { root, repoRoot, bundleRoot, manifestPath, candidateCommit, currentMainCommit, now };
}

function mutateArtifact(
  fixture: Fixture,
  category: Category,
  mutate: (artifact: Record<string, unknown>) => void
): void {
  const manifest = readJson(fixture.manifestPath);
  assert.ok(isRecord(manifest) && Array.isArray(manifest.artifacts));
  const reference = manifest.artifacts.find(
    (value) => isRecord(value) && value.category === category
  );
  assert.ok(isRecord(reference) && typeof reference.path === "string");
  const artifactPath = join(fixture.bundleRoot, reference.path);
  const artifact = readJson(artifactPath);
  assert.ok(isRecord(artifact));
  mutate(artifact);
  writeJson(artifactPath, artifact);
  reference.sha256 = digest(readFileSync(artifactPath));
  writeJson(fixture.manifestPath, manifest);
}

function withFixture(run: (fixture: Fixture) => void): void {
  const fixture = createFixture();
  try {
    run(fixture);
  } finally {
    rmSync(fixture.root, { recursive: true, force: true });
  }
}

function codes(result: Result): string[] {
  return [
    ...result.missingArtifacts,
    ...result.staleArtifacts,
    ...result.invalidArtifacts,
    ...result.repositoryFailures,
  ].map((issue) => issue.code);
}

function contractTests(): void {
  test("PASS requires a complete exact-candidate evidence manifest", () => {
    withFixture((fixture) => {
      const result = verify(fixture.manifestPath, fixture.repoRoot, fixture.now);
      assert.equal(result.verdict, "PASS", JSON.stringify(result));
      assert.deepEqual(codes(result), []);
    });
  });

  test("missing and stale evidence are explicit REFUTED reasons", () => {
    withFixture((fixture) => {
      rmSync(join(fixture.bundleRoot, "evidence/browser.log"));
      mutateArtifact(fixture, "legal", (artifact) => {
        artifact.capturedAt = "2026-07-16T12:00:00.000Z";
        artifact.expiresAt = "2026-07-17T12:00:00.000Z";
      });
      const result = verify(fixture.manifestPath, fixture.repoRoot, fixture.now);
      assert.equal(result.verdict, "REFUTED");
      assert.ok(codes(result).includes("ATTACHMENT_MISSING"));
      assert.ok(codes(result).includes("ARTIFACT_EXPIRED"));
    });
  });

  test("tampered files and claims without verifiable evidence are REFUTED", () => {
    withFixture((fixture) => {
      writeFileSync(join(fixture.bundleRoot, "evidence/trust.log"), "tampered\n", "utf8");
      mutateArtifact(fixture, "browser", (artifact) => {
        assert.ok(Array.isArray(artifact.claims) && isRecord(artifact.claims[0]));
        artifact.claims[0].evidence = [];
      });
      mutateArtifact(fixture, "legal", (artifact) => {
        artifact.producer = "Same Reviewer";
        artifact.independentReviewer = "  same reviewer  ";
      });
      const result = verify(fixture.manifestPath, fixture.repoRoot, fixture.now);
      assert.equal(result.verdict, "REFUTED");
      assert.ok(codes(result).includes("ATTACHMENT_HASH"));
      assert.ok(codes(result).includes("CLAIM_UNSUPPORTED"));
      assert.ok(codes(result).includes("INDEPENDENCE_MISSING"));
    });
  });

  test("candidate HEAD, current origin main, and ancestry must be exact", () => {
    withFixture((fixture) => {
      const tree = fixtureGit(fixture.repoRoot, ["rev-parse", `${fixture.candidateCommit}^{tree}`]);
      const sideMain = fixtureGit(fixture.repoRoot, ["commit-tree", tree, "-m", "side main"]);
      fixtureGit(fixture.repoRoot, ["update-ref", "refs/remotes/origin/main", sideMain]);
      const manifest = readJson(fixture.manifestPath);
      assert.ok(isRecord(manifest));
      manifest.currentMainCommit = sideMain;
      writeJson(fixture.manifestPath, manifest);
      const result = verify(fixture.manifestPath, fixture.repoRoot, fixture.now);
      assert.equal(result.verdict, "REFUTED");
      assert.ok(codes(result).includes("CURRENT_MAIN_NOT_ANCESTOR"));
    });
  });

  test("build evidence may never use the candidate worktree shared .next", () => {
    withFixture((fixture) => {
      mutateArtifact(fixture, "build", (artifact) => {
        artifact.build = {
          workingDirectory: fixture.repoRoot,
          outputDirectory: join(fixture.repoRoot, ".next"),
          command: "npm run build",
        };
      });
      const result = verify(fixture.manifestPath, fixture.repoRoot, fixture.now);
      assert.equal(result.verdict, "REFUTED", JSON.stringify(result));
      assert.ok(codes(result).includes("BUILD_SHARED_NEXT"));
    });
  });

  test("build isolation rejects symlink aliases and contradictory shell commands", () => {
    withFixture((fixture) => {
      const isolatedOutput = join(fixture.root, "isolated-build-worktree", ".next");
      const sharedOutput = join(fixture.repoRoot, ".next");
      rmSync(isolatedOutput, { recursive: true, force: true });
      mkdirSync(sharedOutput, { recursive: true });
      symlinkSync(sharedOutput, isolatedOutput, "dir");
      mutateArtifact(fixture, "build", (artifact) => {
        artifact.build = {
          workingDirectory: join(fixture.root, "isolated-build-worktree"),
          outputDirectory: isolatedOutput,
          command: `cd ${fixture.repoRoot} && npm run build`,
        };
      });
      const result = verify(fixture.manifestPath, fixture.repoRoot, fixture.now);
      assert.equal(result.verdict, "REFUTED", JSON.stringify(result));
      assert.ok(codes(result).includes("BUILD_PATH_UNVERIFIABLE"));
      assert.ok(codes(result).includes("BUILD_SHARED_NEXT"));
      assert.ok(codes(result).includes("BUILD_COMMAND_INVALID"));
    });
  });

  test("every evidence family named by the Q1 lane is mandatory", () => {
    withFixture((fixture) => {
      const manifest = readJson(fixture.manifestPath);
      assert.ok(isRecord(manifest) && Array.isArray(manifest.artifacts));
      manifest.artifacts = manifest.artifacts.filter(
        (value) => !isRecord(value) || value.category !== "pwa"
      );
      writeJson(fixture.manifestPath, manifest);
      const result = verify(fixture.manifestPath, fixture.repoRoot, fixture.now);
      assert.equal(result.verdict, "REFUTED");
      assert.ok(
        result.missingArtifacts.some(
          (issue) => issue.code === "CATEGORY_MISSING" && issue.category === "pwa"
        )
      );
    });
  });
}

function argument(name: string): string | null {
  const index = process.argv.indexOf(name);
  return index >= 0 && index + 1 < process.argv.length ? process.argv[index + 1] : null;
}

const directlyExecuted =
  typeof process.argv[1] === "string" &&
  resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));

if (directlyExecuted) {
  const manifestPath = argument("--manifest");
  if (manifestPath) {
    const result = verify(manifestPath, argument("--repo") ?? process.cwd());
    process.stdout.write(`${JSON.stringify(result)}\n`);
    process.exitCode = result.verdict === "PASS" ? 0 : 1;
  } else {
    contractTests();
  }
}
