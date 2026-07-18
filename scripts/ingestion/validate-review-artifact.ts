import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { getTableName } from "drizzle-orm";

import { ingestionSchema } from "../../src/db/schema/ingestion";
import {
  buildCandidateFingerprint,
  validateCandidate,
  type CandidateDraft,
} from "../../src/db/ingestion/tooling";

type ReviewArtifact = {
  artifactVersion: string;
  publicationMode: "review_only";
  sourcePermissionStatus: "unresolved" | "approved" | "rejected";
  source: {
    name: string;
    canonicalLandingUrl: string;
    downloadUrl: string;
    lifecycleState: string;
  };
  capture: {
    requestUrl: string;
    finalResolvedUrl: string;
    title: string;
    publisher: string;
    upstreamPublicationIdentity: string;
    attributionText: string;
    captureStatus: string;
    fetchResult: string;
    outcome: string;
    databaseStagingStatus: string;
    reviewContext: string;
    fetchedAt: string;
    byteLength: number;
    mediaType: string;
    contentFormat: string;
    parserVersion: string;
    hashingAlgorithm: string;
    contentHash: string;
    packageFiles: string[];
    publishedAt: string | null;
    rawPublishedDate: string;
    publicationPrecision: string;
    publicationNormalizationNote: string;
    observedAt: string | null;
    surveyPeriodStart: string | null;
    surveyPeriodEnd: string | null;
  };
  candidates: Array<
    Omit<
      CandidateDraft,
      | "canonicalSourceIdentity"
      | "canonicalUrl"
      | "captureContentHash"
      | "fetchedAt"
      | "parserVersion"
    > & {
      candidateStatus: string;
      rawSurveyPeriod: string;
      periodPrecision: string;
      periodNormalizationNote: string;
      rawPublishedDate: string;
      publicationPrecision: string;
      publicationNormalizationNote: string;
    }
  >;
  publicationFirewall: {
    databaseWrites: number;
    liveObservationsPromoted: number;
    demoRecordsModified: number;
    demoRecordsDeleted: number;
    destructiveSeedExecuted: boolean;
    productionTablesTruncated: boolean;
  };
};

function zipCentralDirectoryFilenames(bytes: Buffer): string[] {
  const eocdSignature = 0x06054b50;
  const centralSignature = 0x02014b50;
  const minimumEocdLength = 22;
  const earliest = Math.max(0, bytes.length - 65_557);
  let eocdOffset = -1;
  for (let offset = bytes.length - minimumEocdLength; offset >= earliest; offset -= 1) {
    if (bytes.readUInt32LE(offset) === eocdSignature) {
      eocdOffset = offset;
      break;
    }
  }
  if (eocdOffset < 0) throw new Error("ZIP end-of-central-directory record not found");

  const entryCount = bytes.readUInt16LE(eocdOffset + 10);
  let offset = bytes.readUInt32LE(eocdOffset + 16);
  const filenames: string[] = [];
  for (let entry = 0; entry < entryCount; entry += 1) {
    if (offset + 46 > bytes.length || bytes.readUInt32LE(offset) !== centralSignature) {
      throw new Error("Malformed ZIP central directory");
    }
    const filenameLength = bytes.readUInt16LE(offset + 28);
    const extraLength = bytes.readUInt16LE(offset + 30);
    const commentLength = bytes.readUInt16LE(offset + 32);
    const filenameStart = offset + 46;
    const filenameEnd = filenameStart + filenameLength;
    filenames.push(bytes.subarray(filenameStart, filenameEnd).toString("utf8"));
    offset = filenameEnd + extraLength + commentLength;
  }
  return filenames;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const packageFlagIndex = args.indexOf("--package");
  const packageArgument = packageFlagIndex >= 0 ? args[packageFlagIndex + 1] : undefined;
  if (packageFlagIndex >= 0 && !packageArgument) {
    throw new Error("--package requires a local ZIP path");
  }
  const artifactArgument = args.find(
    (_argument, index) =>
      packageFlagIndex < 0 || (index !== packageFlagIndex && index !== packageFlagIndex + 1)
  );
  const artifactPath = resolve(
    process.cwd(),
    artifactArgument ?? "data/ingestion/nbs-selected-food-may-2026.review.json"
  );
  const artifact = JSON.parse(await readFile(artifactPath, "utf8")) as ReviewArtifact;

  const tableNames = Object.values(ingestionSchema).map(getTableName).sort();
  const expectedTables = [
    "public_candidate_reviews",
    "public_food_candidates",
    "public_ingestion_fetches",
    "public_ingestion_runs",
    "public_source_captures",
    "public_source_registry",
  ];
  if (JSON.stringify(tableNames) !== JSON.stringify(expectedTables)) {
    throw new Error(`Ingestion schema mismatch: ${tableNames.join(", ")}`);
  }

  if (artifact.publicationMode !== "review_only") {
    throw new Error("Pilot artifacts must remain review-only");
  }
  if (artifact.sourcePermissionStatus !== "unresolved") {
    throw new Error("This pilot must not claim source permission approval");
  }
  if (!/^[0-9a-f]{64}$/.test(artifact.capture.contentHash)) {
    throw new Error("Capture SHA-256 is missing or malformed");
  }
  if (
    artifact.capture.hashingAlgorithm !== "sha256" ||
    artifact.capture.byteLength !== 5_294_517 ||
    artifact.capture.mediaType !== "application/octet-stream" ||
    artifact.capture.contentFormat !== "zip" ||
    artifact.capture.parserVersion !== "nbs-selected-food-v1" ||
    artifact.capture.fetchedAt !== "2026-07-18T00:42:43.000Z" ||
    artifact.capture.requestUrl !== artifact.source.downloadUrl ||
    artifact.capture.finalResolvedUrl !== artifact.source.downloadUrl
  ) {
    throw new Error("Capture metadata is incomplete or inconsistent");
  }
  if (
    artifact.capture.title !== "Selected Food Price Watch, May 2026" ||
    artifact.capture.publisher !== "National Bureau of Statistics" ||
    artifact.capture.upstreamPublicationIdentity !== "Selected Food Price Watch, May 2026" ||
    !artifact.capture.attributionText.includes("National Bureau of Statistics") ||
    artifact.capture.captureStatus !== "retained_external" ||
    artifact.capture.fetchResult !== "success" ||
    artifact.capture.outcome !== "captured" ||
    artifact.capture.databaseStagingStatus !== "ineligible_source_permission_unresolved" ||
    !artifact.capture.reviewContext.includes("not a public_source_captures")
  ) {
    throw new Error("External capture identity or review-only status is incomplete");
  }
  if (
    artifact.capture.rawPublishedDate !== "2026-06-25" ||
    artifact.capture.publicationPrecision !== "date" ||
    artifact.capture.publishedAt !== "2026-06-25T00:00:00.000Z" ||
    !artifact.capture.publicationNormalizationNote.includes("convention")
  ) {
    throw new Error("Publication date precision or normalization is not explicit");
  }
  if (
    JSON.stringify(artifact.capture.packageFiles) !==
    JSON.stringify(["Selected_Food_Report_May 26.pdf", "selected food table May 26.xlsx"])
  ) {
    throw new Error("Expected package filenames are not preserved");
  }
  if (
    artifact.source.canonicalLandingUrl !==
    "https://microdata.nigerianstat.gov.ng/index.php/catalog/162/related-materials"
  ) {
    throw new Error("Canonical source landing URL is incorrect");
  }
  if (artifact.capture.observedAt !== null) {
    throw new Error("NBS publication date must not be copied to observedAt");
  }
  if (packageArgument) {
    const packageBytes = await readFile(resolve(process.cwd(), packageArgument));
    if (packageBytes.byteLength !== artifact.capture.byteLength) {
      throw new Error("Local package byte length does not match artifact");
    }
    const actualHash = createHash("sha256").update(packageBytes).digest("hex");
    if (actualHash !== artifact.capture.contentHash) {
      throw new Error("Local package SHA-256 does not match artifact");
    }
    const filenames = new Set(zipCentralDirectoryFilenames(packageBytes));
    for (const expectedFilename of artifact.capture.packageFiles) {
      if (!filenames.has(expectedFilename)) {
        throw new Error(`Local ZIP is missing ${expectedFilename}`);
      }
    }
  }
  if (
    artifact.publicationFirewall.databaseWrites !== 0 ||
    artifact.publicationFirewall.liveObservationsPromoted !== 0 ||
    artifact.publicationFirewall.demoRecordsModified !== 0 ||
    artifact.publicationFirewall.demoRecordsDeleted !== 0 ||
    artifact.publicationFirewall.destructiveSeedExecuted ||
    artifact.publicationFirewall.productionTablesTruncated
  ) {
    throw new Error("Publication firewall or demo preservation assertion failed");
  }

  const fingerprints = new Set<string>();
  const expectedRawLabels = new Set(["Tomatoes, fresh", "Semovita, Prepacked (1kg)"]);
  for (const candidate of artifact.candidates) {
    const draft: CandidateDraft = {
      ...candidate,
      canonicalSourceIdentity: artifact.source.name,
      canonicalUrl: artifact.source.downloadUrl,
      captureContentHash: artifact.capture.contentHash,
      fetchedAt: artifact.capture.fetchedAt,
      parserVersion: artifact.capture.parserVersion,
    };
    if (
      candidate.rawPlaceName !== "Lagos" ||
      candidate.rawSurveyPeriod !== "May 2026" ||
      candidate.periodPrecision !== "month" ||
      !candidate.periodNormalizationNote.includes("conventions")
    ) {
      throw new Error(`${candidate.rawItemName}: raw place or period fidelity failed`);
    }
    if (
      candidate.rawPublishedDate !== "2026-06-25" ||
      candidate.publicationPrecision !== "date" ||
      !candidate.publicationNormalizationNote.includes("convention")
    ) {
      throw new Error(`${candidate.rawItemName}: publication-date fidelity failed`);
    }
    if (!/^₦[0-9,]+[.][0-9]{2}$/.test(candidate.rawPrice ?? "")) {
      throw new Error(`${candidate.rawItemName}: raw naira price was normalized or lost`);
    }
    if (!expectedRawLabels.delete(candidate.rawItemName)) {
      throw new Error(`${candidate.rawItemName}: unexpected or duplicate raw item label`);
    }
    const validation = validateCandidate(draft);
    if (validation.status !== candidate.candidateStatus) {
      throw new Error(
        `${candidate.rawItemName}: artifact status ${candidate.candidateStatus} does not match ${validation.status}`
      );
    }
    fingerprints.add(buildCandidateFingerprint(draft));
  }
  if (fingerprints.size !== artifact.candidates.length) {
    throw new Error("Pilot contains duplicate candidate fingerprints");
  }
  if (expectedRawLabels.size !== 0) {
    throw new Error("Pilot is missing an expected raw item label");
  }

  process.stdout.write(
    `${artifact.artifactVersion}: ${artifact.candidates.length} review-only candidates validated against ${tableNames.length} staging tables\n`
  );
}

void main();
