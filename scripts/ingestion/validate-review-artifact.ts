import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { validateCandidate } from "../../src/db/ingestion/tooling";
import {
  candidateArtifactId,
  candidateFingerprint,
  NBS_CANDIDATES,
  NBS_CAPTURE_FETCHED_AT,
  NBS_LANDING_URL,
  NBS_ORIGIN_LABEL,
  NBS_PACKAGE_BYTES,
  NBS_PACKAGE_SHA256,
  NBS_PACKAGE_URL,
  NBS_PARSER_VERSION,
  stableArtifactSha256,
  type NbsCandidateArtifact,
} from "./adapters/nbs-selected-food-price-watch";

const capturePath =
  "data/ingestion/captures/nbs-selected-food-price-watch/2d46ff90f87c7bfe75cc3df30ae35cc10a9641971543243e9d885aa7a97ca466.capture.json";
const reviewPath =
  "data/ingestion/reviews/nbs-selected-food-price-watch/2026-05/2d46ff90f87c7bfe75cc3df30ae35cc10a9641971543243e9d885aa7a97ca466.review.json";
const historicalPilotPath = "data/ingestion/nbs-selected-food-may-2026.review.json";
const historicalCandidateHashes = [
  "d58d5f38e17e3b08313dd9bd3feb6ec8294f49970fa9175a53f48ac6f5cda613",
  "2beffb6d580ac691132cfe9f2d00082cf7132814a695d5bceb3bcecbd777deda",
] as const;

type CaptureArtifact = {
  artifactVersion: string;
  archiveMode: string;
  publicationMode: string;
  source: { sourceName: string; sourceCategory: string; canonicalLandingUrl: string };
  capture: Record<string, unknown>;
  effectFirewall: Record<string, number>;
};

type ReviewArtifact = {
  artifactVersion: string;
  reviewMode: string;
  publicationMode: string;
  source: Record<string, string>;
  capture: Record<string, string>;
  candidateArtifacts: Array<{
    candidateArtifactId: string;
    path: string;
    validationStatus: string;
    reviewStatus: string;
  }>;
  reviewDecisions: unknown[];
  originLabel: string;
  effectFirewall: Record<string, boolean | number>;
};

function candidatePath(candidate: NbsCandidateArtifact): string {
  return `data/ingestion/candidates/nbs-selected-food-price-watch/${candidate.candidateArtifactId}.candidate.json`;
}

function containsSample(value: unknown): boolean {
  if (typeof value === "string") return /sample/i.test(value);
  if (Array.isArray(value)) return value.some(containsSample);
  if (value !== null && typeof value === "object") return Object.values(value).some(containsSample);
  return false;
}

async function readJson<T>(path: string): Promise<T> {
  return JSON.parse(await readFile(resolve(process.cwd(), path), "utf8")) as T;
}

async function assertOptionalPackageIdentity(packageArgument: string | undefined): Promise<void> {
  if (!packageArgument) return;
  const bytes = await readFile(resolve(process.cwd(), packageArgument));
  const contentHash = createHash("sha256").update(bytes).digest("hex");
  if (bytes.byteLength !== NBS_PACKAGE_BYTES || contentHash !== NBS_PACKAGE_SHA256) {
    throw new Error("Local package does not match the approved NBS external-pointer capture");
  }
}

async function assertHistoricalPilotPreserved(): Promise<void> {
  const historical = await readJson<{
    artifactVersion: string;
    sourcePermissionStatus: string;
    capture: { contentHash: string; fetchedAt: string; byteLength: number };
    candidates: Array<{
      rawItemName: string;
      rawPrice: string;
      rawQuantity: string;
      quantityValue: number;
      rawUnit: string;
      rawAvailability: null;
      availability: string;
      rawPlaceName: string;
      geographicPrecision: string;
      rawSurveyPeriod: string;
      observedAt: null;
    }>;
  }>(historicalPilotPath);
  if (
    historical.artifactVersion !== "nbs-selected-food-may-2026-v1" ||
    historical.sourcePermissionStatus !== "unresolved" ||
    historical.capture.contentHash !== NBS_PACKAGE_SHA256 ||
    historical.capture.fetchedAt !== NBS_CAPTURE_FETCHED_AT ||
    historical.capture.byteLength !== NBS_PACKAGE_BYTES ||
    historical.candidates.length !== 2 ||
    JSON.stringify(historical.candidates.map((candidate) => candidate.rawItemName)) !==
      JSON.stringify(["Tomatoes, fresh", "Semovita, Prepacked (1kg)"]) ||
    JSON.stringify(historical.candidates.map((candidate) => candidate.rawPrice)) !==
      JSON.stringify(["₦1,974.81", "₦1,777.15"]) ||
    historical.candidates.some(
      (candidate) =>
        candidate.rawQuantity !== "1kg" ||
        candidate.quantityValue !== 1 ||
        candidate.rawUnit !== "kg" ||
        candidate.rawAvailability !== null ||
        candidate.availability !== "unknown" ||
        candidate.rawPlaceName !== "Lagos" ||
        candidate.geographicPrecision !== "lagos_state" ||
        candidate.rawSurveyPeriod !== "May 2026" ||
        candidate.observedAt !== null
    ) ||
    JSON.stringify(historical.candidates.map(stableArtifactSha256)) !==
      JSON.stringify(historicalCandidateHashes)
  ) {
    throw new Error("Historical NBS pilot artifact was altered instead of compensated forward");
  }
}

async function main(): Promise<void> {
  const nbsSelected = process.argv.includes("--nbs");
  const packageFlagIndex = process.argv.indexOf("--package");
  const packageArgument = packageFlagIndex < 0 ? undefined : process.argv[packageFlagIndex + 1];
  if (packageFlagIndex >= 0 && !packageArgument) throw new Error("--package requires a local ZIP path");
  if (!nbsSelected) {
    await assertHistoricalPilotPreserved();
    await assertOptionalPackageIdentity(packageArgument);
    process.stdout.write("historical NBS May 2026 pilot artifact validated\n");
    return;
  }

  const capture = await readJson<CaptureArtifact>(capturePath);
  const review = await readJson<ReviewArtifact>(reviewPath);
  const artifacts = await Promise.all(
    NBS_CANDIDATES.map((candidate) => readJson<NbsCandidateArtifact>(candidatePath(candidate)))
  );

  if (
    capture.artifactVersion !== "nbs-selected-food-price-watch-capture-v1" ||
    capture.archiveMode !== "external_pointer" ||
    capture.publicationMode !== "review_only" ||
    capture.source.sourceName !== "National Bureau of Statistics — Selected Food Price Watch" ||
    capture.source.sourceCategory !== "government_official" ||
    capture.source.canonicalLandingUrl !== NBS_LANDING_URL ||
    capture.capture.requestUrl !== NBS_PACKAGE_URL ||
    capture.capture.finalResolvedUrl !== NBS_PACKAGE_URL ||
    capture.capture.rawContentPointer !== NBS_PACKAGE_URL ||
    capture.capture.fetchedAt !== NBS_CAPTURE_FETCHED_AT ||
    capture.capture.byteLength !== NBS_PACKAGE_BYTES ||
    capture.capture.hashingAlgorithm !== "sha256" ||
    capture.capture.contentHash !== NBS_PACKAGE_SHA256 ||
    capture.capture.parserVersion !== NBS_PARSER_VERSION ||
    capture.capture.observedAt !== null ||
    capture.capture.rawGeographicScope !== "Lagos" ||
    capture.capture.geographicPrecision !== "lagos_state" ||
    capture.capture.originLabel !== NBS_ORIGIN_LABEL ||
    capture.capture.rawContentStoredInRepository !== false ||
    capture.capture.rawContentStoredInDatabase !== false ||
    Object.values(capture.effectFirewall).some((value) => value !== 0)
  ) {
    throw new Error("NBS external-pointer capture is incomplete or violates the review firewall");
  }
  if (containsSample(capture)) throw new Error("Source-backed NBS capture must never use Sample");

  for (const [index, artifact] of artifacts.entries()) {
    const expected = NBS_CANDIDATES[index];
    if (stableArtifactSha256(artifact) !== stableArtifactSha256(expected)) {
      throw new Error(`${expected.candidateArtifactId}: candidate artifact is not deterministic`);
    }
    const validation = validateCandidate(artifact.candidate);
    if (
      validation.status !== artifact.candidate.candidateStatus ||
      candidateFingerprint(artifact) !== candidateFingerprint(expected) ||
      candidateArtifactId(artifact) !== artifact.candidateArtifactId ||
      artifact.provenanceType !== "public_source" ||
      artifact.publicationMode !== "review_only" ||
      artifact.source.sourceCategory !== "government_official" ||
      artifact.originLabel !== NBS_ORIGIN_LABEL ||
      artifact.candidate.rawAvailability !== null ||
      artifact.candidate.availability !== "unknown" ||
      artifact.candidate.observedAt !== null ||
      artifact.candidate.geographicPrecision !== "lagos_state" ||
      artifact.candidate.rawPlaceName !== "Lagos" ||
      containsSample(artifact) ||
      Object.values(artifact.effectFirewall).some((value) => value !== 0)
    ) {
      throw new Error(`${expected.candidateArtifactId}: candidate violates source fidelity or firewall`);
    }
  }

  if (
    review.artifactVersion !== "nbs-selected-food-price-watch-review-v1" ||
    review.reviewMode !== "append_only" ||
    review.publicationMode !== "review_only" ||
    review.source.sourceCategory !== "government_official" ||
    review.source.lifecycleState !== "active" ||
    review.source.permittedIngestionMode !== "fetch_and_stage" ||
    review.capture.contentHash !== NBS_PACKAGE_SHA256 ||
    review.capture.rawContentPointer !== NBS_PACKAGE_URL ||
    review.capture.fetchedAt !== NBS_CAPTURE_FETCHED_AT ||
    review.originLabel !== NBS_ORIGIN_LABEL ||
    review.reviewDecisions.length !== 0 ||
    JSON.stringify(review.candidateArtifacts) !==
      JSON.stringify(
        NBS_CANDIDATES.map((candidate) => ({
          candidateArtifactId: candidate.candidateArtifactId,
          path: candidatePath(candidate),
          validationStatus: candidate.candidate.candidateStatus,
          reviewStatus: candidate.candidate.reviewStatus,
        }))
      ) ||
    containsSample(review) ||
    Object.values(review.effectFirewall).some((value) => value !== 0 && value !== false)
  ) {
    throw new Error("NBS append-only review artifact is incomplete or unsafe");
  }

  await assertOptionalPackageIdentity(packageArgument);
  process.stdout.write(`NBS review artifacts validated: ${artifacts.length} source-backed candidates\n`);
}

void main();
