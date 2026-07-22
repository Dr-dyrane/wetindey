import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const base = "2e76199e40b4e42a324420f49398e9f228099316";
const evidence = "WD-DEVREL-WORKLOG-20260719-FWD1";
const refuter = "independent-codex-refuter-forward-20260719-07";
const laneHeading = "#### Developer Relations & Engineering Enablement: department worklog protocol \u2014 active exact claim";
const laneOwner = "019f7995-5b7b-7ee1-81ef-2c3a3c57b836";
const releasedLaneRecord = "#### Developer Relations department worklog protocol \u2014 RELEASED / PATHLESS";
const exactOwned = "Exactly the 23 paths in the preceding Candidate paths (sorted) block; no other path.";
const exactExcluded = "Every repository path not listed in Candidate paths (sorted), including LANES.md and all app, schema, migration, package, and ADR paths.";
const departments = [
  "catalog-stewardship", "client-reliability-offline", "community-growth",
  "contribution-integrity", "developer-experience", "executive-product",
  "human-interface", "legal-policy", "maps-location", "operations-field-data",
  "presence-safety", "program-release", "quality-release", "security-privacy",
  "seller-identity-access", "trust-data-governance",
] as const;
const paths = [
  "AGENTS.md",
  "docs/CONTRIBUTING.md",
  "docs/operations/BRANCH-HANDOFF-TEMPLATE.md",
  "docs/operations/DEPARTMENT-WORKLOG-PROTOCOL.md",
  "docs/operations/WETINDEY-OPERATING-SYSTEM.md",
  "docs/operations/departments/README.md",
  "docs/operations/departments/catalog-stewardship.md",
  "docs/operations/departments/client-reliability-offline.md",
  "docs/operations/departments/community-growth.md",
  "docs/operations/departments/contribution-integrity.md",
  "docs/operations/departments/developer-experience.md",
  "docs/operations/departments/executive-product.md",
  "docs/operations/departments/human-interface.md",
  "docs/operations/departments/legal-policy.md",
  "docs/operations/departments/maps-location.md",
  "docs/operations/departments/operations-field-data.md",
  "docs/operations/departments/presence-safety.md",
  "docs/operations/departments/program-release.md",
  "docs/operations/departments/quality-release.md",
  "docs/operations/departments/security-privacy.md",
  "docs/operations/departments/seller-identity-access.md",
  "docs/operations/departments/trust-data-governance.md",
  "scripts/department-worklog-contract.test.ts",
] as const;
const supersededRepairBase = "dae6786d2c0567387fdffc4ddd33bac2603ae33a";
const supersededRepairEvidence = "WD-DEVREL-WORKLOG-20260721-DIGEST2";
const supersededRepairRefuter = "independent-codex-refuter-digest-20260721-02";
const supersededRepairDigest = "393b153a810093b0876f5c0e12f074fce15ff71477fe812fe98a767c116dd311";
const supersededRepair3Base = "d3de9dc5a6f89481b0454fe0abe98e90d5c939be";
const supersededRepair3Evidence = "WD-DEVREL-WORKLOG-20260721-DIGEST3";
const supersededRepair3Refuter = "independent-codex-refuter-digest-20260721-03";
const supersededRepair3Digest = "759e9cd3263030be967fcce995935253b54dd4eb09c9f8402eca3c0d63b00597";
const repairBase = "d6357a5f2b897e9272abc0926ce302c9e6a9f199";
const repairEvidence = "WD-DEVREL-WORKLOG-20260722-DIGEST4";
const repairRefuter = "independent-codex-refuter-digest-20260722-04";
const repairPaths = [
  "docs/operations/DEPARTMENT-WORKLOG-PROTOCOL.md",
  "docs/operations/departments/developer-experience.md",
  "scripts/department-worklog-contract.test.ts",
] as const;
const reviewedRepairDigest = "435a9b4ab8f659bc31d560b030d76df5306902023b189dfc10081e28de10f812";
const headings = [
  "Transfer coordinates", "Lane and path boundaries", "Decisions and rationale",
  "Implementation", "Evidence and refutations", "Known failures", "External gates",
  "Integration order", "Rollback or disable", "Exact next action",
] as const;
const fields = [
  "Evidence ID", "Base SHA", "Candidate tree SHA-256", "Candidate hash algorithm",
  "Candidate paths (sorted)", "Final commit SHA", "Lane heading", "Lane owner",
  "Owned paths", "Excluded paths", "Refuter ID", "Runtime and external evidence",
  "Unknown scope", "Unknown owner", "Unknown resolution action", "External gate owner", "Gate state",
  "Actor", "Action", "Target", "Completion",
] as const;

const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const matches = (source: string, label: string) =>
  [...source.matchAll(new RegExp(`^- ${escape(label)}:\\s*(.*)$`, "gm"))];
function field(entry: string, label: string) {
  const found = matches(entry, label);
  assert.equal(found.length, 1, `entry must contain exactly one ${label}; found ${found.length}`);
  return found[0][1].trim();
}
function plain(raw: string) {
  const value = raw.trim();
  if ((value.startsWith("`") && value.endsWith("`")) ||
      (value.startsWith('"') && value.endsWith('"'))) return value.slice(1, -1).trim();
  return value;
}
function concreteValue(raw: string, context: string) {
  const value = plain(raw);
  assert.ok(value, `${context} must not be empty`);
  assert.doesNotMatch(value, /^(?:tbd|todo|to[ -]?do|n\/?a|na|not applicable|none|null|later|pending|generic|placeholder|to be determined|fill(?: this)? in|insert(?: value)? here)[.!]?$/i, `${context} is generic or a placeholder`);
  assert.doesNotMatch(value, /^(?:\[[^\]]*\]|<[^>]*>|\{\{?[^}]*\}\}?)$/, `${context} is a bracketed placeholder`);
  assert.doesNotMatch(value, /\b(?:tbd|todo|n\/?a|not applicable|to be determined|fill this in|insert here|replace me)\b/i, `${context} contains placeholder text`);
  assert.doesNotMatch(value, /(?:\[[^\]\n]+\]|<[^>\n]+>|\{\{[^}\n]+\}\})/, `${context} contains a bracketed placeholder`);
  assert.doesNotMatch(value, /\bnone\s+(?:assigned|known|provided|available|yet)\b|\blater\s+(?:after|when|once|following|pending|review)\b|\bgeneric\s+(?:value|owner|text|action|target|artifact|path|evidence|response|thing|stuff)\b/i, `${context} contains a generic deferred value`);
  assert.doesNotMatch(value, /^(?:someone|somebody|anyone|anybody|owner|assignee|stakeholder|responsible party|the team|some team)\b/i, `${context} names only a generic actor or owner`);
  assert.doesNotMatch(value, /^(?:please\s+)?(?:review|check|look at|investigate|follow up(?: on)?|handle|work on|update|fix|continue)\s+(?:(?:the|any|some)\s+)?(?:(?:relevant|related|appropriate|necessary|current|existing|available|general|generic)\s+)?(?:documentation|docs|issue|issues|task|tasks|work|things|stuff)\b/i, `${context} contains a vague generic instruction`);
  const affirmative = value.replace(/\b(?:no|not|without)\s+(?:a\s+)?generic\b/gi, "");
  assert.doesNotMatch(affirmative, /\b(?:none|later|pending|generic)\b/i, `${context} contains an embedded generic or deferred value`);
  return value;
}
function entries(source: string) {
  const starts = [...source.matchAll(/^### \d{4}-\d{2}-\d{2} - [^\n]+$/gm)].map((match) => match.index ?? -1);
  assert.ok(starts.length, "worklog must contain a dated append-only entry");
  return starts.map((start, index) => source.slice(start, starts[index + 1] ?? source.length));
}
function checkAppendOrder(records: readonly string[], context: string) {
  const titles = records.map((entry) => entry.match(/^### \d{4}-\d{2}-\d{2} - [^\n]+$/m)?.[0] ?? "");
  const evidenceIds = records.map((entry) => plain(field(entry, "Evidence ID")));
  assert.equal(titles[0], "### 2026-07-19 - Conservative initialization", `${context} first entry must remain the bootstrap`);
  assert.equal(new Set(titles).size, titles.length, `${context} dated entry headings must be unique`);
  assert.equal(evidenceIds[0], evidence, `${context} first entry must retain the bootstrap Evidence ID`);
  assert.equal(evidenceIds.filter((id) => id === evidence).length, 1, `${context} bootstrap Evidence ID must occur in exactly one entry`);
}
function manifest(source: string) {
  const match = /^- Candidate paths \(sorted\):\s*\n```text\n([\s\S]*?)\n```$/m.exec(source);
  assert.ok(match, "entry requires one fenced Candidate paths (sorted) manifest");
  return match[1].split("\n").map((line) => line.trim()).filter(Boolean);
}
function canonical(source: string, path?: string) {
  let cleaned = source.replace(/^- Candidate tree SHA-256: `(?:[0-9a-f]{64}|CANDIDATE_HASH_PENDING)`$/gm, "- Candidate tree SHA-256: `<normalized-candidate-tree-sha256>`");
  if (path === "scripts/department-worklog-contract.test.ts") {
    const pattern = new RegExp("const\\s+reviewed" + "RepairDigest\\s*=\\s*\"[0-9a-f]{64}\";", "g");
    cleaned = cleaned.replace(pattern, "const reviewedRepairDigest = \"<normalized-candidate-tree-sha256>\";");
  }
  return cleaned;
}
function digest(candidateBase: string, candidatePaths: readonly string[], sources: ReadonlyMap<string, string>) {
  const hash = createHash("sha256");
  hash.update("wetindey-candidate-tree-v1\0");
  hash.update(`base\0${candidateBase}\0`);
  for (const path of candidatePaths) {
    const bytes = Buffer.from(canonical(sources.get(path) ?? readFileSync(resolve(root, path), "utf8"), path), "utf8");
    hash.update(`path\0${Buffer.byteLength(path)}\0${path}\0content\0${bytes.length}\0`);
    hash.update(bytes);
    hash.update("\0");
  }
  return hash.digest("hex");
}
function coordinates(entry: string, context: string) {
  const evidenceId = concreteValue(field(entry, "Evidence ID"), `${context} Evidence ID`);
  const baseSha = concreteValue(field(entry, "Base SHA"), `${context} Base SHA`);
  const candidateHash = concreteValue(field(entry, "Candidate tree SHA-256"), `${context} Candidate tree SHA-256`);
  const algorithm = concreteValue(field(entry, "Candidate hash algorithm"), `${context} Candidate hash algorithm`);
  const candidatePaths = manifest(entry);
  assert.match(evidenceId, /^[A-Za-z0-9][A-Za-z0-9._-]{7,}$/, `${context} Evidence ID is not stable and concrete`);
  assert.match(baseSha, /^[0-9a-f]{40}$/, `${context} Base SHA must be full`);
  assert.match(candidateHash, /^[0-9a-f]{64}$/, `${context} candidate digest is incomplete`);
  assert.equal(algorithm, "wetindey-candidate-tree-v1", `${context} hash algorithm mismatch`);
  assert.ok(candidatePaths.length > 0, `${context} candidate manifest must not be empty`);
  assert.deepEqual([...candidatePaths].sort(), candidatePaths, `${context} candidate manifest must be sorted`);
  assert.equal(new Set(candidatePaths).size, candidatePaths.length, `${context} candidate paths must be unique`);
  for (const path of candidatePaths) {
    assert.match(path, /^(?!\/)(?!.*(?:^|\/)\.\.(?:\/|$))[A-Za-z0-9_.-]+(?:\/[A-Za-z0-9_.-]+)*$/, `${context} candidate path is not exact: ${path}`);
  }
  return { evidenceId, baseSha, candidateHash, candidatePaths };
}
function metadata(source: string, path: string) {
  const match = /^---\n([\s\S]*?)\n---(?:\n|$)/.exec(source);
  assert.ok(match, `${path} requires frontmatter`);
  const pairs = match[1].split("\n").filter(Boolean).map((line) => {
    const at = line.indexOf(":");
    assert.ok(at > 0, `invalid frontmatter in ${path}: ${line}`);
    return [line.slice(0, at).trim(), line.slice(at + 1).trim()] as const;
  });
  const data = Object.fromEntries(pairs) as Record<string, string>;
  assert.equal(Object.keys(data).length, pairs.length, `${path} frontmatter keys must be unique`);
  for (const key of ["department_id", "department_name", "worklog_contract_version", "authority"]) {
    assert.ok(key in data, `${path} missing frontmatter ${key}`);
    concreteValue(data[key], `${path} frontmatter ${key}`);
  }
  assert.equal(data.worklog_contract_version, "1", `${path} worklog_contract_version must be 1`);
  assert.equal(data.authority, "durable-memory-only", `${path} authority must remain durable-memory-only`);
  return data;
}
function semanticText(raw: string) {
  return plain(raw).toLowerCase().replace(/[`'"]/g, "").replace(/[-/]/g, " ").replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}
function hasSemanticSubject(source: string, subject: string) {
  const normalizedSubject = semanticText(subject);
  return normalizedSubject.length > 0 && ` ${semanticText(source)} `.includes(` ${normalizedSubject} `);
}

function checkNextAction(entry: string, context: string) {
  const actor = concreteValue(field(entry, "Actor"), `${context} Actor`);
  const action = concreteValue(field(entry, "Action"), `${context} Action`);
  const target = concreteValue(field(entry, "Target"), `${context} Target`);
  const completion = concreteValue(field(entry, "Completion"), `${context} Completion`);
  assert.ok(actor.length >= 4, `${context} Actor must identify a role or person`);
  assert.doesNotMatch(action, /^(?:please\s+)?(?:review|check|look at|investigate|follow up(?: on)?|handle|work on|update|fix|continue)(?:\s+(?:the\s+)?(?:relevant|related|appropriate|necessary|current|existing)?\s*(?:documentation|docs|issue|issues|task|tasks|work|things|stuff))?[.!]?$/i, `${context} Action is vague`);
  assert.match(action, /^(?:resolve|preserve|present|submit|charter|complete|designate|route|refute|approve|reject|frame|propose|test|produce|record|recompute|run|compare|inspect|verify|reconcile|apply|execute|capture|publish|report|escalate)\b/i, `${context} Action needs a concrete command verb`);
  const noun = /\b(?:artifact|paths?|symbols?|commands?|evidence|manifest|records?|entries|files?|sha|digest|hash|verdict|lane|contract|test|protocol|receipt|commit|branch|diff|decisions?|facts?|definition|result|catalog|migration|provider|deployment|environment|adapter|canvas|location|browser|database|role|backup|scheduler|flags?|kill switch|allowlist|responder|flow|call sites?|source|consent|jurisdiction|data|processor|copy|implementation|claim|threat|authorization|retention|identity|proof|projection|geography|operator|portfolio|device|runtime|moderation|boundary|plan)\b|LANES\.md|[A-Za-z0-9_.-]+\/[A-Za-z0-9_./*-]+/i;
  assert.match(action, noun, `${context} Action must name an artifact, path, symbol, command, or evidence object`);
  assert.match(target, noun, `${context} Target must name an artifact, path, symbol, command, or evidence object`);
  assert.match(target, /\b(?:exact|path|manifest|lane|evidence|sha|digest|hash|record|decision|definition|result|boundary|claim)\b|LANES\.md|WD-[A-Z0-9-]+/i, `${context} Target needs an exact lane, path, artifact, or evidence reference`);
  assert.match(completion, /\b(?:recorded|records?|verdict|evidence|sha|digest|hash|commit|lane|manifest|decision|disposition|refuter|proof|documented|closes?|closed|matches|passes)\b/i, `${context} Completion needs observable evidence`);
}
function checkEntryContract(entry: string, context: string) {
  assert.deepEqual([...entry.matchAll(/^#### (.+)$/gm)].map((match) => match[1].trim()), [...headings], `${context} headings must occur exactly once in order`);
  for (const label of fields) {
    const raw = field(entry, label);
    if (label !== "Candidate paths (sorted)") concreteValue(raw, `${context} ${label}`);
  }
  const entryCoordinates = coordinates(entry, context);
  const headFields = matches(entry, "Head SHA");
  assert.ok(headFields.length <= 1, `${context} Head SHA must occur at most once`);
  if (headFields.length === 1) assert.match(plain(headFields[0][1]), /^[0-9a-f]{40}$/, `${context} Head SHA must be full`);
  assert.equal(plain(field(entry, "Final commit SHA")), "Reported by the worker/controller after commit; not embedded in these bytes.", `${context} final commit report must remain external`);
  const entryLaneHeading = concreteValue(field(entry, "Lane heading"), `${context} Lane heading`);
  const entryLaneOwner = concreteValue(field(entry, "Lane owner"), `${context} Lane owner`);
  const entryOwned = concreteValue(field(entry, "Owned paths"), `${context} Owned paths`);
  const entryExcluded = concreteValue(field(entry, "Excluded paths"), `${context} Excluded paths`);
  const entryRefuter = concreteValue(field(entry, "Refuter ID"), `${context} Refuter ID`);
  assert.match(entryLaneHeading, /^#### \S.+$/, `${context} lane heading must be copied exactly`);
  assert.ok(entryLaneOwner.length >= 8, `${context} lane owner must be a stable identity`);
  assert.equal(entryOwned, `Exactly the ${entryCoordinates.candidatePaths.length} paths in the preceding Candidate paths (sorted) block; no other path.`, `${context} owned paths must exactly reference the entry manifest`);
  assert.match(entryExcluded, /^Every repository path not listed in Candidate paths \(sorted\), including .+\.$/, `${context} exclusions must be explicit`);
  assert.match(entryRefuter, /^[A-Za-z0-9][A-Za-z0-9._-]{7,}$/, `${context} Refuter ID is not stable and concrete`);
  const unknownScope = concreteValue(field(entry, "Unknown scope"), `${context} Unknown scope`);
  const unknownOwner = concreteValue(field(entry, "Unknown owner"), `${context} Unknown owner`);
  const unknownAction = concreteValue(field(entry, "Unknown resolution action"), `${context} Unknown resolution action`);
  assert.doesNotMatch(unknownOwner, /^(?:unknown|unassigned)\b/i, `${context} must name the resolving owner`);
  assert.match(unknownAction, /^(?:capture|inspect|record|reconcile|resolve|produce|verify|test)\b/i, `${context} unknown resolution must begin with a concrete command`);
  assert.match(unknownAction, /\b(?:artifact|path|paths|evidence|record|sha|environment|target|runtime|release|browser|device|source|owner|identity|consent|retention|provenance|freshness|confidence|conflict|coverage|outcome|requirements|controls|flows|behavior)\b/i, `${context} unknown resolution must name a concrete evidence object`);
  const failureSection = entry.match(/^#### Known failures\s*\n([\s\S]*?)(?=^#### External gates$)/m);
  assert.ok(failureSection, `${context} must contain a bounded Known failures section`);
  const failureNarrative = failureSection[1].replace(/^- Unknown (?:scope|owner|resolution action):.*$/gm, "");
  const unknownSubjects = unknownScope.split(";").map((subject) => concreteValue(subject, `${context} Unknown scope subject`));
  assert.ok(unknownSubjects.length > 0, `${context} Unknown scope must name at least one subject`);
  for (const subject of unknownSubjects) {
    assert.ok(hasSemanticSubject(failureNarrative, subject), `${context} failure narrative omits exact unknown subject: ${subject}`);
    assert.ok(hasSemanticSubject(unknownAction, subject), `${context} resolution action omits exact unknown subject: ${subject}`);
  }
  checkNextAction(entry, context);
  return { entryCoordinates, headFields, entryLaneHeading, entryLaneOwner, entryOwned, entryExcluded, entryRefuter };
}

test("placeholder validator rejects embedded generic and deferred values", () => {
  for (const value of ["none assigned", "later after review", "generic owner", "[owner] pending", "status N/A", "TODO after handoff", "Review relevant documentation", "someone", "check the related docs", "Record none for exact evidence.", "Record later evidence for the exact manifest.", "Record generic disposition evidence for the exact manifest."]) {
    assert.throws(() => concreteValue(value, "mutation fixture"), `${value} must be rejected`);
  }
  assert.doesNotThrow(() => concreteValue("Program Management records exact LANES.md evidence before implementation.", "concrete fixture"));
  assert.doesNotThrow(() => concreteValue("The lane closes without a generic score.", "negated concrete fixture"));
});

test("entry parser scopes labels to each dated append-only entry", () => {
  const sample = "### 2026-07-19 - First\n- Evidence ID: `first`\n#### Transfer coordinates\n### 2026-07-20 - Second\n- Evidence ID: `second`\n#### Transfer coordinates";
  const parsed = entries(sample);
  assert.equal(parsed.length, 2);
  assert.deepEqual(parsed.map((entry) => matches(entry, "Evidence ID").length), [1, 1]);
  const duplicateBeforeTransfer = "### 2026-07-21 - Duplicate\n- Evidence ID: `before`\n#### Transfer coordinates\n- Evidence ID: `after`";
  assert.equal(matches(entries(duplicateBeforeTransfer)[0], "Evidence ID").length, 2);
});

test("unknown subjects require exact normalized token sequences", () => {
  for (const [source, subject] of [
    ["coverageish remains unexamined", "coverage"],
    ["themed behavior remains unexamined", "theme"],
    ["error recoveryish remains unexamined", "error recovery"],
    ["community behavioral effects remain unexamined", "community behavior"],
  ]) {
    assert.equal(hasSemanticSubject(source, subject), false, `${source} must not satisfy ${subject}`);
  }
  assert.equal(hasSemanticSubject("Exact source-quality evidence remains UNKNOWN.", "source quality"), true);
  assert.equal(hasSemanticSubject("Theme and error recovery remain UNKNOWN.", "error recovery"), true);
});

test("later append-only entries carry a complete independent contract", () => {
  const bootstrap = entries(readFileSync(resolve(root, "docs/operations/departments/developer-experience.md"), "utf8"))[0];
  const future = bootstrap
    .replace("### 2026-07-19 - Conservative initialization", "### 2026-07-20 - Receiver acknowledgement")
    .replace("WD-DEVREL-WORKLOG-20260719-FWD1", "WD-FUTURE-ENTRY-0001")
    .replaceAll(base, "a".repeat(40))
    .replace(/[0-9a-f]{64}/g, "b".repeat(64))
    .replace(/^- Candidate paths \(sorted\):\s*\n```text\n[\s\S]*?\n```$/m, "- Candidate paths (sorted):\n```text\ndocs/operations/departments/developer-experience.md\n```")
    .replace(laneHeading, "#### Developer Experience: receiver acknowledgement - active exact claim")
    .replace(laneOwner, "future-owner-0001")
    .replace(exactOwned, "Exactly the 1 paths in the preceding Candidate paths (sorted) block; no other path.")
    .replace(exactExcluded, "Every repository path not listed in Candidate paths (sorted), including LANES.md and all schema and migration paths.")
    .replace(refuter, "independent-future-refuter-0001");
  const checked = checkEntryContract(future, "future mutation fixture");
  assert.equal(checked.entryCoordinates.evidenceId, "WD-FUTURE-ENTRY-0001");
  assert.equal(checked.entryLaneOwner, "future-owner-0001");
  assert.equal(checked.entryExcluded, "Every repository path not listed in Candidate paths (sorted), including LANES.md and all schema and migration paths.");
  assert.equal(checked.entryRefuter, "independent-future-refuter-0001");
  assert.deepEqual(checked.entryCoordinates.candidatePaths, ["docs/operations/departments/developer-experience.md"]);
  assert.doesNotThrow(() => checkAppendOrder([bootstrap, future], "valid append fixture"));
  assert.throws(() => checkAppendOrder([future, bootstrap], "relocated bootstrap fixture"));
  assert.throws(() => checkAppendOrder([bootstrap, bootstrap], "duplicate bootstrap fixture"));
  assert.throws(() => checkAppendOrder([bootstrap.replace(evidence, "WD-REWRITTEN-HISTORY-0001"), bootstrap], "rewritten history fixture"));
});

test("department worklogs satisfy the static handoff contract", () => {
  assert.equal(new Set(departments).size, departments.length, "department IDs must be unique");
  assert.deepEqual([...paths].sort(), [...paths], "candidate manifest must be sorted");
  assert.equal(new Set(paths).size, paths.length, "candidate paths must be unique");
  assert.deepEqual([...repairPaths].sort(), [...repairPaths], "repair candidate manifest must be sorted");
  assert.equal(new Set(repairPaths).size, repairPaths.length, "repair candidate paths must be unique");
  for (const path of repairPaths) assert.ok(paths.includes(path), `repair path must remain inside the exact lane: ${path}`);
  const actual = readdirSync(resolve(root, "docs/operations/departments"))
    .filter((name) => name.endsWith(".md") && name !== "README.md")
    .map((name) => name.slice(0, -3)).sort();
  assert.deepEqual(actual, [...departments], "department files must exactly match registered IDs");

  const sources = new Map<string, string>(paths.map((path) => [path, readFileSync(resolve(root, path), "utf8")]));
  const lanes = readFileSync(resolve(root, "LANES.md"), "utf8");
  assert.equal(lanes.indexOf(laneHeading), -1, "released lane must not readvertise its active heading");
  assert.ok(lanes.includes(releasedLaneRecord), "LANES.md must record the released Developer Relations worklog lane");
  assert.ok(lanes.includes(laneOwner), "released lane record must retain the exact lane owner");

  const ids = new Set<string>();
  const names = new Set<string>();
  let bootstrapEntries = 0;
  let supersededRepairEntries = 0;
  let supersededRepair3Entries = 0;
  let repairEntries = 0;
  for (const id of departments) {
    const path = `docs/operations/departments/${id}.md`;
    const source = sources.get(path)!;
    const records = entries(source);
    checkAppendOrder(records, path);
    const frontmatter = metadata(source, path);
    assert.equal(frontmatter.department_id, id, `${path} department_id must match filename`);
    assert.ok(!ids.has(id), `duplicate department ID ${id}`);
    assert.ok(!names.has(frontmatter.department_name.toLowerCase()), `duplicate department name ${frontmatter.department_name}`);
    ids.add(id);
    names.add(frontmatter.department_name.toLowerCase());
    for (const [index, entry] of records.entries()) {
      const context = `${path} entry ${index + 1}`;
      const checked = checkEntryContract(entry, context);
      const { entryCoordinates, headFields, entryLaneHeading, entryLaneOwner, entryOwned, entryExcluded, entryRefuter } = checked;
      if (entryCoordinates.evidenceId === evidence) {
        bootstrapEntries += 1;
        assert.equal(headFields.length, 0, `${context} bootstrap must not invent Head SHA`);
        assert.equal(entryCoordinates.baseSha, base, `${context} bootstrap Base SHA mismatch`);
        assert.equal(entryCoordinates.candidateHash, plain(field(sources.get("docs/operations/departments/README.md")!, "Candidate tree SHA-256")), `${context} bootstrap candidate digest mismatch`);
        assert.deepEqual(entryCoordinates.candidatePaths, [...paths], `${context} bootstrap candidate paths mismatch`);
        assert.equal(entryLaneHeading, laneHeading, `${context} bootstrap lane heading is paraphrased`);
        assert.equal(entryLaneOwner, laneOwner, `${context} bootstrap lane owner mismatch`);
        assert.equal(entryOwned, exactOwned, `${context} bootstrap owned paths are paraphrased`);
        assert.equal(entryExcluded, exactExcluded, `${context} bootstrap exclusions are paraphrased`);
        assert.equal(entryRefuter, refuter, `${context} bootstrap refuter mismatch`);
      }
      if (entryCoordinates.evidenceId === supersededRepairEvidence) {
        supersededRepairEntries += 1;
        assert.equal(path, "docs/operations/departments/developer-experience.md", `${context} superseded repair must stay in its functional-home log`);
        assert.equal(headFields.length, 0, `${context} superseded repair must not invent Head SHA`);
        assert.equal(entryCoordinates.baseSha, supersededRepairBase, `${context} superseded repair Base SHA mismatch`);
        assert.equal(entryCoordinates.candidateHash, supersededRepairDigest, `${context} superseded repair candidate digest mismatch`);
        assert.deepEqual(entryCoordinates.candidatePaths, [...repairPaths], `${context} superseded repair candidate paths mismatch`);
        assert.equal(entryLaneHeading, laneHeading, `${context} superseded repair lane heading is paraphrased`);
        assert.equal(entryLaneOwner, laneOwner, `${context} superseded repair lane owner mismatch`);
        assert.equal(entryOwned, "Exactly the 3 paths in the preceding Candidate paths (sorted) block; no other path.", `${context} superseded repair owned paths are paraphrased`);
        assert.equal(entryExcluded, exactExcluded, `${context} superseded repair exclusions are paraphrased`);
        assert.equal(entryRefuter, supersededRepairRefuter, `${context} superseded repair refuter mismatch`);
      }
      if (entryCoordinates.evidenceId === supersededRepair3Evidence) {
        supersededRepair3Entries += 1;
        assert.equal(path, "docs/operations/departments/developer-experience.md", `${context} superseded repair must stay in its functional-home log`);
        assert.equal(headFields.length, 0, `${context} superseded repair must not invent Head SHA`);
        assert.equal(entryCoordinates.baseSha, supersededRepair3Base, `${context} superseded repair Base SHA mismatch`);
        assert.equal(entryCoordinates.candidateHash, supersededRepair3Digest, `${context} superseded repair candidate digest mismatch`);
        assert.deepEqual(entryCoordinates.candidatePaths, [...repairPaths], `${context} superseded repair candidate paths mismatch`);
        assert.equal(entryLaneHeading, laneHeading, `${context} superseded repair lane heading is paraphrased`);
        assert.equal(entryLaneOwner, laneOwner, `${context} superseded repair lane owner mismatch`);
        assert.equal(entryOwned, "Exactly the 3 paths in the preceding Candidate paths (sorted) block; no other path.", `${context} superseded repair owned paths are paraphrased`);
        assert.equal(entryExcluded, exactExcluded, `${context} superseded repair exclusions are paraphrased`);
        assert.equal(entryRefuter, supersededRepair3Refuter, `${context} superseded repair refuter mismatch`);
      }
      if (entryCoordinates.evidenceId === repairEvidence) {
        repairEntries += 1;
        assert.equal(path, "docs/operations/departments/developer-experience.md", `${context} repair must stay in its functional-home log`);
        assert.equal(headFields.length, 0, `${context} pre-commit repair must not invent Head SHA`);
        assert.equal(entryCoordinates.baseSha, repairBase, `${context} repair Base SHA mismatch`);
        assert.equal(entryCoordinates.candidateHash, reviewedRepairDigest, `${context} repair candidate digest mismatch`);
        assert.deepEqual(entryCoordinates.candidatePaths, [...repairPaths], `${context} repair candidate paths mismatch`);
        assert.equal(entryLaneHeading, laneHeading, `${context} repair lane heading is paraphrased`);
        assert.equal(entryLaneOwner, laneOwner, `${context} repair lane owner mismatch`);
        assert.equal(entryOwned, "Exactly the 3 paths in the preceding Candidate paths (sorted) block; no other path.", `${context} repair owned paths are paraphrased`);
        assert.equal(entryExcluded, exactExcluded, `${context} repair exclusions are paraphrased`);
        assert.equal(entryRefuter, repairRefuter, `${context} repair refuter mismatch`);
      }
    }
  }
  assert.equal(bootstrapEntries, departments.length, "every department must preserve exactly one bootstrap entry");
  assert.equal(supersededRepairEntries, 1, "the superseded fail-closed digest repair must remain exactly one append-only entry");
  assert.equal(supersededRepair3Entries, 1, "the superseded active-lane re-freeze digest repair must remain exactly one append-only entry");
  assert.equal(repairEntries, 1, "the current fail-closed digest repair must have exactly one append-only entry");
  const readme = sources.get("docs/operations/departments/README.md")!;
  assert.equal(plain(field(readme, "Evidence ID")), evidence);
  assert.equal(plain(field(readme, "Refuter ID")), refuter);
  assert.equal(plain(field(readme, "Base SHA")), base);
  assert.deepEqual(manifest(readme), [...paths]);
  const bootstrapHash = plain(field(readme, "Candidate tree SHA-256"));
  assert.equal(bootstrapHash, "829fcb2dd6130475e57c9af52cbb446c8a4752fb5dc970d1ae8a62fab075b3a8", "bootstrap digest must remain immutable");
  const repairSources = new Map<string, string>(repairPaths.map((path) => [path, sources.get(path)!] as const));
  assert.equal(digest(repairBase, repairPaths, repairSources), reviewedRepairDigest, "repair candidate bytes must match the fixed independently reviewed digest");

  const protocol = sources.get("docs/operations/DEPARTMENT-WORKLOG-PROTOCOL.md")!;
  assert.match(protocol, /every required label, including\s+`Evidence ID`, MUST appear exactly once within that entry/i);
  assert.match(protocol, /Review relevant\s+documentation/);
  assert.match(protocol, /Receiver acknowledgement is a separate follow-up/);
  const handoff = sources.get("docs/operations/BRANCH-HANDOFF-TEMPLATE.md")!;
  assert.match(handoff, /replace every instructional placeholder with concrete transfer evidence/i);
  assert.match(handoff, /Separate receiver acknowledgement follow-up/);
});
