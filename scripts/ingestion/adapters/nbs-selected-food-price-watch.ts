import { createHash } from "node:crypto";

import { buildCandidateFingerprint, stableJson, type CandidateDraft } from "../../../src/db/ingestion/tooling";

export const NBS_SOURCE_POLICY_VERSION = "nbs-selected-food-price-watch-v1";
export const NBS_PARSER_VERSION = "nbs-selected-food-price-watch-v1";
export const NBS_PACKAGE_SHA256 = "2d46ff90f87c7bfe75cc3df30ae35cc10a9641971543243e9d885aa7a97ca466";
export const NBS_PACKAGE_BYTES = 5_294_517;
export const NBS_PACKAGE_URL =
  "https://microdata.nigerianstat.gov.ng/index.php/catalog/162/download/1427";
export const NBS_LANDING_URL =
  "https://microdata.nigerianstat.gov.ng/index.php/catalog/162/related-materials";
export const NBS_CAPTURE_FETCHED_AT = "2026-07-18T00:42:43.000Z";
export const NBS_ORIGIN_LABEL = "Official data · NBS · Lagos State · May 2026";

export type NbsCandidateArtifactId =
  | "d8d4467b4acde42f0be4bcfcc00db6b3c84611a6e83e2b24a77d61ffd7b34872"
  | "e0585afafce8ce60c359c1d3758e9410596e2a0dc685aaa5e43bd526fbbf0cc8";

export type NbsCandidateArtifact = {
  artifactVersion: "nbs-selected-food-price-watch-candidate-v1";
  candidateArtifactId: NbsCandidateArtifactId;
  provenanceType: "public_source";
  publicationMode: "review_only";
  source: {
    sourceName: string;
    sourceCategory: "government_official";
    canonicalLandingUrl: string;
    canonicalPackageUrl: string;
  };
  capture: {
    contentHash: string;
    fetchedAt: string;
    rawContentPointer: string;
  };
  originLabel: string;
  candidate: CandidateDraft & {
    rawSurveyPeriod: "May 2026";
    surveyPeriodPrecision: "month";
    rawPublishedDate: "2026-06-25";
    publicationPrecision: "date";
    extractionMethod: "manual_review";
    extractionQuality: "source-row-verified";
    candidateStatus: "needs_item_mapping";
    reviewStatus: "pending_manual_review";
  };
  effectFirewall: {
    observationsWritten: 0;
    offersCurrentEffects: 0;
    mapEffects: 0;
    searchEffects: 0;
    seoEffects: 0;
    uiEffects: 0;
  };
};

const NBS_CANDIDATE_ARTIFACT_ID_BY_FINGERPRINT = new Map<string, NbsCandidateArtifactId>([
  [
    "6d7093a265763c9443f4e5b82c8b5a840c05a80c7e43cc99482feb87c74e37df",
    "d8d4467b4acde42f0be4bcfcc00db6b3c84611a6e83e2b24a77d61ffd7b34872",
  ],
  [
    "f0ddf594ddbc6227cb57af0c8209307f49a1a6405ea942df97f6012dfe762ac3",
    "e0585afafce8ce60c359c1d3758e9410596e2a0dc685aaa5e43bd526fbbf0cc8",
  ],
]);

const source = {
  sourceName: "National Bureau of Statistics — Selected Food Price Watch",
  sourceCategory: "government_official" as const,
  canonicalLandingUrl: NBS_LANDING_URL,
  canonicalPackageUrl: NBS_PACKAGE_URL,
};

const capture = {
  contentHash: NBS_PACKAGE_SHA256,
  fetchedAt: NBS_CAPTURE_FETCHED_AT,
  rawContentPointer: NBS_PACKAGE_URL,
};

const sharedCandidate = {
  canonicalSourceIdentity: source.sourceName,
  canonicalUrl: NBS_PACKAGE_URL,
  upstreamPublicationIdentity: "Selected Food Price Watch, May 2026",
  captureContentHash: NBS_PACKAGE_SHA256,
  rawAvailability: null,
  availability: "unknown" as const,
  rawPlaceName: "Lagos",
  normalizedPlaceId: null,
  geographicPrecision: "lagos_state" as const,
  sourceGeographicScope: "Lagos",
  observedAt: null,
  surveyPeriodStart: "2026-05-01T00:00:00.000Z",
  surveyPeriodEnd: "2026-05-31T23:59:59.999Z",
  publishedAt: "2026-06-25T00:00:00.000Z",
  fetchedAt: NBS_CAPTURE_FETCHED_AT,
  parserVersion: NBS_PARSER_VERSION,
  rawSurveyPeriod: "May 2026" as const,
  surveyPeriodPrecision: "month" as const,
  rawPublishedDate: "2026-06-25" as const,
  publicationPrecision: "date" as const,
  extractionMethod: "manual_review" as const,
  extractionQuality: "source-row-verified" as const,
  candidateStatus: "needs_item_mapping" as const,
  reviewStatus: "pending_manual_review" as const,
};

export const NBS_CANDIDATES: readonly NbsCandidateArtifact[] = [
  {
    artifactVersion: "nbs-selected-food-price-watch-candidate-v1",
    candidateArtifactId: "d8d4467b4acde42f0be4bcfcc00db6b3c84611a6e83e2b24a77d61ffd7b34872",
    provenanceType: "public_source",
    publicationMode: "review_only",
    source,
    capture,
    originLabel: NBS_ORIGIN_LABEL,
    candidate: {
      ...sharedCandidate,
      evidenceReference: "Selected_Food_Report_May 26.pdf, page 3 Lagos summary and page 16 Tomatoes, fresh row",
      evidencePage: "3, 16",
      rawItemName: "Tomatoes, fresh",
      rawVariant: null,
      rawQuantity: "1kg",
      quantityValue: 1,
      rawUnit: "kg",
      normalizedItemId: null,
      normalizedItemVariantId: null,
      normalizedUnitId: null,
      rawPrice: "₦1,974.81",
      priceKobo: 197481,
      currency: "NGN",
    },
    effectFirewall: {
      observationsWritten: 0,
      offersCurrentEffects: 0,
      mapEffects: 0,
      searchEffects: 0,
      seoEffects: 0,
      uiEffects: 0,
    },
  },
  {
    artifactVersion: "nbs-selected-food-price-watch-candidate-v1",
    candidateArtifactId: "e0585afafce8ce60c359c1d3758e9410596e2a0dc685aaa5e43bd526fbbf0cc8",
    provenanceType: "public_source",
    publicationMode: "review_only",
    source,
    capture,
    originLabel: NBS_ORIGIN_LABEL,
    candidate: {
      ...sharedCandidate,
      evidenceReference: "Selected_Food_Report_May 26.pdf, Lagos State lowest for Semovita Prepacked 1kg",
      evidencePage: "16",
      rawItemName: "Semovita, Prepacked (1kg)",
      rawVariant: "Prepacked",
      rawQuantity: "1kg",
      quantityValue: 1,
      rawUnit: "kg",
      normalizedItemId: null,
      normalizedItemVariantId: null,
      normalizedUnitId: null,
      rawPrice: "₦1,777.15",
      priceKobo: 177715,
      currency: "NGN",
    },
    effectFirewall: {
      observationsWritten: 0,
      offersCurrentEffects: 0,
      mapEffects: 0,
      searchEffects: 0,
      seoEffects: 0,
      uiEffects: 0,
    },
  },
];

export function candidateFingerprint(artifact: NbsCandidateArtifact): string {
  return buildCandidateFingerprint(artifact.candidate);
}

export function candidateArtifactId(artifact: NbsCandidateArtifact): NbsCandidateArtifactId {
  const fingerprint = candidateFingerprint(artifact);
  const artifactId = NBS_CANDIDATE_ARTIFACT_ID_BY_FINGERPRINT.get(fingerprint);
  if (!artifactId) {
    throw new Error(`No reserved NBS candidate artifact ID for fingerprint ${fingerprint}`);
  }
  return artifactId;
}

for (const artifact of NBS_CANDIDATES) {
  if (candidateArtifactId(artifact) !== artifact.candidateArtifactId) {
    throw new Error("NBS candidate artifact ID does not match its frozen fingerprint");
  }
}

export function stableArtifactSha256(value: unknown): string {
  return createHash("sha256").update(stableJson(value), "utf8").digest("hex");
}
