import { createHash } from "node:crypto";

export const FINGERPRINT_POLICY_VERSION = "food-candidate-v1";

export type GeographicPrecision =
  "exact_place" | "market" | "neighbourhood" | "lga" | "lagos_state" | "unknown";

export type CandidateStatus =
  | "ready_for_review"
  | "needs_item_mapping"
  | "needs_unit_mapping"
  | "needs_place_mapping"
  | "ambiguous_date"
  | "possible_duplicate"
  | "price_anomaly"
  | "unsupported"
  | "rejected";

export type CandidateDraft = {
  canonicalSourceIdentity: string;
  canonicalUrl: string;
  upstreamPublicationIdentity?: string | null;
  captureContentHash: string;
  evidenceReference: string;
  evidencePage?: string | null;
  evidenceSection?: string | null;
  evidenceRow?: string | null;
  rawItemName: string;
  normalizedItemId?: string | null;
  normalizedItemVariantId?: string | null;
  rawVariant?: string | null;
  rawQuantity?: string | null;
  quantityValue?: number | null;
  rawUnit?: string | null;
  normalizedUnitId?: string | null;
  rawPrice?: string | null;
  priceKobo?: number | null;
  currency?: "NGN" | null;
  rawAvailability?: string | null;
  availability: "available" | "low_stock" | "unavailable" | "unknown";
  rawPlaceName?: string | null;
  normalizedPlaceId?: string | null;
  areaName?: string | null;
  normalizedAreaId?: string | null;
  geographicPrecision: GeographicPrecision;
  sourceGeographicScope?: string | null;
  observedAt?: string | null;
  surveyPeriodStart?: string | null;
  surveyPeriodEnd?: string | null;
  publishedAt?: string | null;
  fetchedAt: string;
  parserVersion: string;
  fingerprintPolicyVersion?: string;
};

export type CandidateValidation = {
  status: CandidateStatus;
  errors: string[];
};

const LOCAL_MEASURES = new Set(["cup", "derica", "mudu", "paint bucket", "bag"]);

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, nested]) => [key, canonicalize(nested ?? null)])
    );
  }
  return value ?? null;
}

export function stableJson(value: unknown): string {
  return JSON.stringify(canonicalize(value));
}

export function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

export function buildRunKey(input: {
  scheduledAt: string;
  planVersion: string;
  configurationVersion: string;
}): string {
  return sha256(stableJson(input));
}

export function buildCaptureIdentity(input: {
  sourceRegistryId: string;
  canonicalUrl: string;
  upstreamPublicationIdentity?: string | null;
  contentHash: string;
}): string {
  return sha256(stableJson(input));
}

export function buildCandidateFingerprint(candidate: CandidateDraft): string {
  const fingerprintMaterial = {
    canonicalSourceIdentity: candidate.canonicalSourceIdentity,
    canonicalUrl: candidate.canonicalUrl,
    upstreamPublicationIdentity: candidate.upstreamPublicationIdentity ?? null,
    captureContentHash: candidate.captureContentHash,
    evidence: {
      reference: candidate.evidenceReference,
      page: candidate.evidencePage ?? null,
      section: candidate.evidenceSection ?? null,
      row: candidate.evidenceRow ?? null,
    },
    item: {
      raw: candidate.rawItemName,
      normalizedItemId: candidate.normalizedItemId ?? null,
      normalizedVariantId: candidate.normalizedItemVariantId ?? null,
      variant: candidate.rawVariant ?? null,
    },
    quantity: {
      raw: candidate.rawQuantity ?? null,
      value: candidate.quantityValue ?? null,
      rawUnit: candidate.rawUnit ?? null,
      normalizedUnitId: candidate.normalizedUnitId ?? null,
    },
    geography: {
      rawPlace: candidate.rawPlaceName ?? null,
      placeId: candidate.normalizedPlaceId ?? null,
      area: candidate.areaName ?? null,
      areaId: candidate.normalizedAreaId ?? null,
      precision: candidate.geographicPrecision,
      scope: candidate.sourceGeographicScope ?? null,
    },
    time: {
      observedAt: candidate.observedAt ?? null,
      surveyPeriodStart: candidate.surveyPeriodStart ?? null,
      surveyPeriodEnd: candidate.surveyPeriodEnd ?? null,
    },
    price: {
      raw: candidate.rawPrice ?? null,
      priceKobo: candidate.priceKobo ?? null,
      currency: candidate.currency ?? null,
    },
    availability: {
      raw: candidate.rawAvailability ?? null,
      normalized: candidate.availability,
    },
    fingerprintPolicyVersion: candidate.fingerprintPolicyVersion ?? FINGERPRINT_POLICY_VERSION,
  };
  return sha256(stableJson(fingerprintMaterial));
}

export function validateCandidate(candidate: CandidateDraft): CandidateValidation {
  const errors: string[] = [];

  if (!/^https?:\/\//.test(candidate.canonicalUrl)) errors.push("missing_stable_source_url");
  if (!candidate.evidenceReference.trim()) errors.push("missing_evidence_reference");
  if (!candidate.rawPrice && !candidate.rawAvailability) errors.push("missing_primary_claim");
  if (candidate.rawPrice && (candidate.priceKobo === null || candidate.priceKobo === undefined)) {
    errors.push("unparsed_price");
  }
  if (
    candidate.priceKobo !== null &&
    candidate.priceKobo !== undefined &&
    (!Number.isInteger(candidate.priceKobo) || candidate.priceKobo <= 0)
  ) {
    errors.push("invalid_price");
  }
  if (
    candidate.priceKobo !== null &&
    candidate.priceKobo !== undefined &&
    candidate.currency !== "NGN"
  ) {
    errors.push("unknown_currency");
  }
  if (candidate.availability !== "unknown" && !candidate.rawAvailability) {
    errors.push("invented_availability");
  }
  if (candidate.rawAvailability && candidate.availability === "unknown") {
    errors.push("unmapped_availability");
  }
  if (
    candidate.rawQuantity &&
    (candidate.quantityValue === null || candidate.quantityValue === undefined)
  ) {
    errors.push("unparsed_quantity");
  }
  if (
    (candidate.geographicPrecision === "exact_place" ||
      candidate.geographicPrecision === "market") &&
    !candidate.normalizedPlaceId
  ) {
    errors.push("unsupported_place_precision");
  }
  if (
    (candidate.geographicPrecision === "neighbourhood" ||
      candidate.geographicPrecision === "lga") &&
    !candidate.normalizedAreaId
  ) {
    errors.push("unsupported_area_precision");
  }
  if (!candidate.sourceGeographicScope?.trim()) {
    errors.push("missing_source_geographic_scope");
  }
  if (candidate.observedAt && candidate.publishedAt === candidate.observedAt) {
    errors.push("publication_copied_to_observation");
  }
  if (
    candidate.surveyPeriodStart &&
    candidate.surveyPeriodEnd &&
    candidate.surveyPeriodStart > candidate.surveyPeriodEnd
  ) {
    errors.push("invalid_survey_period");
  }

  const normalizedRawUnit = candidate.rawUnit?.trim().toLowerCase();
  if (
    normalizedRawUnit &&
    LOCAL_MEASURES.has(normalizedRawUnit) &&
    candidate.normalizedUnitId &&
    candidate.rawQuantity?.toLowerCase().includes("kg")
  ) {
    errors.push("invented_local_unit_conversion");
  }

  if (errors.length > 0) return { status: "rejected", errors };
  if (!candidate.normalizedItemId || !candidate.normalizedItemVariantId) {
    return { status: "needs_item_mapping", errors };
  }
  if (candidate.rawUnit && !candidate.normalizedUnitId) {
    return { status: "needs_unit_mapping", errors };
  }
  if (candidate.geographicPrecision === "unknown") {
    return { status: "needs_place_mapping", errors };
  }
  if (!candidate.observedAt && !(candidate.surveyPeriodStart && candidate.surveyPeriodEnd)) {
    return { status: "ambiguous_date", errors };
  }
  return { status: "ready_for_review", errors };
}

export function isPriceAnomaly(
  priceKobo: number,
  comparableMedianKobo: number,
  threshold = 0.4
): boolean {
  if (priceKobo <= 0 || comparableMedianKobo <= 0) return false;
  if (threshold < 0) throw new Error("Anomaly threshold must be non-negative");
  return Math.abs(priceKobo - comparableMedianKobo) / comparableMedianKobo > threshold;
}

export function canStageCandidate(input: {
  registryLifecycleState: "proposed" | "active" | "suspended" | "rejected";
  registryIngestionMode: "discovery_only" | "fetch_and_stage" | "blocked";
  captureLifecycleState: "proposed" | "active" | "suspended" | "rejected";
  captureIngestionMode: "discovery_only" | "fetch_and_stage" | "blocked";
  captureStatus: "captured" | "retained_external" | "metadata_only" | "rejected";
}): boolean {
  return (
    input.registryLifecycleState === "active" &&
    input.registryIngestionMode === "fetch_and_stage" &&
    input.captureLifecycleState === "active" &&
    input.captureIngestionMode === "fetch_and_stage" &&
    (input.captureStatus === "captured" || input.captureStatus === "retained_external")
  );
}

export function canRetainCapture(input: {
  registryLifecycleState: "proposed" | "active" | "suspended" | "rejected";
  registryIngestionMode: "discovery_only" | "fetch_and_stage" | "blocked";
  registrySourceCategory:
    | "primary_institutional"
    | "government_official"
    | "recognized_market_association"
    | "approved_partner"
    | "named_merchant"
    | "reputable_secondary"
    | "public_social"
    | "unknown_unsupported";
  captureStatus: "captured" | "retained_external" | "metadata_only" | "rejected";
}): boolean {
  if (input.captureStatus === "captured" || input.captureStatus === "retained_external") {
    return (
      input.registryLifecycleState === "active" &&
      input.registryIngestionMode === "fetch_and_stage" &&
      input.registrySourceCategory !== "unknown_unsupported"
    );
  }
  return true;
}

export type PublicationLineage = {
  namedUpstreamPublisher?: string | null;
  upstreamPublicationIdentity?: string | null;
  surveyPeriodStart?: string | null;
  surveyPeriodEnd?: string | null;
  evidenceLineage?: string | null;
  contentHash: string;
};

export function classifyPublicationRelationship(
  first: PublicationLineage,
  next: PublicationLineage
):
  | "exact_duplicate"
  | "syndicated_copy"
  | "revised_source"
  | "potentially_independent_corroboration" {
  if (first.contentHash === next.contentHash) return "exact_duplicate";
  const sameLineage =
    first.namedUpstreamPublisher === next.namedUpstreamPublisher &&
    first.upstreamPublicationIdentity === next.upstreamPublicationIdentity &&
    first.surveyPeriodStart === next.surveyPeriodStart &&
    first.surveyPeriodEnd === next.surveyPeriodEnd &&
    first.evidenceLineage === next.evidenceLineage;
  if (sameLineage) return "syndicated_copy";
  if (
    first.namedUpstreamPublisher === next.namedUpstreamPublisher &&
    first.upstreamPublicationIdentity === next.upstreamPublicationIdentity
  ) {
    return "revised_source";
  }
  return "potentially_independent_corroboration";
}

export function classifyParserOutcome(input: {
  previousSuccessfulRecordCount: number;
  currentRecordCount: number;
  emptyResultExplicitlyValid?: boolean;
}): "captured" | "format_changed" {
  if (
    input.previousSuccessfulRecordCount > 0 &&
    input.currentRecordCount === 0 &&
    !input.emptyResultExplicitlyValid
  ) {
    return "format_changed";
  }
  return "captured";
}

export function appendUnique<T>(
  current: readonly T[],
  additions: readonly T[],
  identity: (record: T) => string
): { records: T[]; appended: number; duplicates: number } {
  const seen = new Set(current.map(identity));
  const records = [...current];
  let duplicates = 0;
  for (const record of additions) {
    const key = identity(record);
    if (seen.has(key)) {
      duplicates += 1;
      continue;
    }
    seen.add(key);
    records.push(record);
  }
  return { records, appended: records.length - current.length, duplicates };
}

export function latestReview<T extends { reviewedAt: string; createdAt: string }>(
  reviews: readonly T[]
): T | null {
  return (
    [...reviews].sort(
      (left, right) =>
        right.reviewedAt.localeCompare(left.reviewedAt) ||
        right.createdAt.localeCompare(left.createdAt)
    )[0] ?? null
  );
}
