import { sql } from "drizzle-orm";
import {
  check,
  type AnyPgColumn,
  foreignKey,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { areas, items, itemVariants, places, units } from "./index";

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
};

export const publicSourceRegistry = pgTable(
  "public_source_registry",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    sourceName: varchar("source_name", { length: 255 }).notNull(),
    canonicalDomain: varchar("canonical_domain", { length: 255 }).notNull(),
    canonicalLandingUrl: text("canonical_landing_url").notNull(),
    sourceCategory: varchar("source_category", { length: 64 }).notNull(),
    publisherIdentity: varchar("publisher_identity", { length: 255 }).notNull(),
    statedGeographicScope: text("stated_geographic_scope"),
    contentFormat: varchar("content_format", { length: 64 }).notNull(),
    reliabilityTier: varchar("reliability_tier", { length: 32 }).notNull(),
    reviewRequirement: varchar("review_requirement", { length: 32 })
      .default("owner_review")
      .notNull(),
    permittedIngestionMode: varchar("permitted_ingestion_mode", { length: 32 })
      .default("discovery_only")
      .notNull(),
    attributionRequirements: text("attribution_requirements"),
    archiveRetentionRequirements: text("archive_retention_requirements"),
    lifecycleState: varchar("lifecycle_state", { length: 32 }).default("proposed").notNull(),
    policyVersion: varchar("policy_version", { length: 64 }).notNull(),
    approvalReference: text("approval_reference"),
    reviewedBy: varchar("reviewed_by", { length: 255 }),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    lastSuccessfulFetchAt: timestamp("last_successful_fetch_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("public_source_registry_domain_landing_key").on(
      table.canonicalDomain,
      table.canonicalLandingUrl
    ),
    index("public_source_registry_lifecycle_idx").on(table.lifecycleState),
    check(
      "public_source_registry_category_check",
      sql`${table.sourceCategory} in ('primary_institutional', 'government_official', 'recognized_market_association', 'approved_partner', 'named_merchant', 'reputable_secondary', 'public_social', 'unknown_unsupported')`
    ),
    check(
      "public_source_registry_reliability_check",
      sql`${table.reliabilityTier} in ('high', 'medium', 'low', 'unassessed')`
    ),
    check(
      "public_source_registry_review_check",
      sql`${table.reviewRequirement} in ('owner_review', 'manual_review', 'discovery_only')`
    ),
    check(
      "public_source_registry_mode_check",
      sql`${table.permittedIngestionMode} in ('discovery_only', 'fetch_and_stage', 'blocked')`
    ),
    check(
      "public_source_registry_lifecycle_check",
      sql`${table.lifecycleState} in ('proposed', 'active', 'suspended', 'rejected')`
    ),
    check(
      "public_source_registry_url_check",
      sql`length(trim(${table.canonicalLandingUrl})) > 0 and ${table.canonicalLandingUrl} ~ '^https?://'`
    ),
    check("public_source_registry_domain_check", sql`length(trim(${table.canonicalDomain})) > 0`),
    check(
      "public_source_registry_active_approval_check",
      sql`${table.lifecycleState} <> 'active' or (${table.permittedIngestionMode} = 'fetch_and_stage' and ${table.approvalReference} is not null and ${table.reviewedBy} is not null and ${table.reviewedAt} is not null)`
    ),
    check(
      "public_source_registry_unsupported_mode_check",
      sql`${table.sourceCategory} <> 'unknown_unsupported' or ${table.permittedIngestionMode} <> 'fetch_and_stage'`
    ),
  ]
);

export const publicIngestionRuns = pgTable(
  "public_ingestion_runs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    runKey: varchar("run_key", { length: 255 }).notNull(),
    planVersion: varchar("plan_version", { length: 64 }).notNull(),
    scheduledAt: timestamp("scheduled_at", { withTimezone: true }).notNull(),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    runnerBundleVersion: varchar("runner_bundle_version", { length: 64 }).notNull(),
    configurationVersion: varchar("configuration_version", { length: 64 }).notNull(),
    repositoryCommit: varchar("repository_commit", { length: 64 }).notNull(),
    repositoryBranch: varchar("repository_branch", { length: 255 }).notNull(),
    status: varchar("status", { length: 32 }).default("running").notNull(),
    failureSummary: text("failure_summary"),
    sourcesScheduled: integer("sources_scheduled").default(0).notNull(),
    sourcesFetched: integer("sources_fetched").default(0).notNull(),
    capturesAdded: integer("captures_added").default(0).notNull(),
    candidatesAdded: integer("candidates_added").default(0).notNull(),
    candidatesReadyForReview: integer("candidates_ready_for_review").default(0).notNull(),
    duplicatesSuppressed: integer("duplicates_suppressed").default(0).notNull(),
    rejectedCount: integer("rejected_count").default(0).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("public_ingestion_runs_run_key_key").on(table.runKey),
    index("public_ingestion_runs_scheduled_idx").on(table.scheduledAt.desc()),
    check(
      "public_ingestion_runs_status_check",
      sql`${table.status} in ('running', 'completed', 'completed_with_warnings', 'failed', 'blocked')`
    ),
    check(
      "public_ingestion_runs_completion_check",
      sql`${table.status} = 'running' or ${table.completedAt} is not null`
    ),
    check(
      "public_ingestion_runs_counts_check",
      sql`${table.sourcesScheduled} >= 0 and ${table.sourcesFetched} >= 0 and ${table.capturesAdded} >= 0 and ${table.candidatesAdded} >= 0 and ${table.candidatesReadyForReview} >= 0 and ${table.duplicatesSuppressed} >= 0 and ${table.rejectedCount} >= 0`
    ),
  ]
);

export const publicSourceCaptures = pgTable(
  "public_source_captures",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    sourceRegistryId: uuid("source_registry_id")
      .references(() => publicSourceRegistry.id)
      .notNull(),
    effectivePolicyVersion: varchar("effective_policy_version", { length: 64 }).notNull(),
    effectiveSourceCategory: varchar("effective_source_category", { length: 64 }).notNull(),
    effectiveIngestionMode: varchar("effective_ingestion_mode", { length: 32 }).notNull(),
    effectiveLifecycleState: varchar("effective_lifecycle_state", { length: 32 }).notNull(),
    canonicalUrl: text("canonical_url").notNull(),
    requestUrl: text("request_url").notNull(),
    finalResolvedUrl: text("final_resolved_url").notNull(),
    title: text("title"),
    publisher: varchar("publisher", { length: 255 }).notNull(),
    upstreamPublicationIdentity: varchar("upstream_publication_identity", { length: 255 }),
    fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull(),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    observedAt: timestamp("observed_at", { withTimezone: true }),
    surveyPeriodStart: timestamp("survey_period_start", { withTimezone: true }),
    surveyPeriodEnd: timestamp("survey_period_end", { withTimezone: true }),
    contentHash: varchar("content_hash", { length: 64 }).notNull(),
    hashingAlgorithm: varchar("hashing_algorithm", { length: 16 }).default("sha256").notNull(),
    mediaType: varchar("media_type", { length: 255 }).notNull(),
    byteLength: integer("byte_length").notNull(),
    contentFormat: varchar("content_format", { length: 64 }).notNull(),
    statedGeographicScope: text("stated_geographic_scope"),
    attributionText: text("attribution_text"),
    archiveMode: varchar("archive_mode", { length: 32 }).notNull(),
    rawContentPointer: text("raw_content_pointer"),
    parserVersion: varchar("parser_version", { length: 64 }).notNull(),
    captureStatus: varchar("capture_status", { length: 32 }).notNull(),
    notes: text("notes"),
    revisesCaptureId: uuid("revises_capture_id").references(
      (): AnyPgColumn => publicSourceCaptures.id
    ),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("public_source_captures_identity_key").on(
      table.sourceRegistryId,
      table.canonicalUrl,
      sql`coalesce(${table.upstreamPublicationIdentity}, '')`,
      table.contentHash
    ),
    uniqueIndex("public_source_captures_id_source_key").on(table.id, table.sourceRegistryId),
    index("public_source_captures_source_fetched_idx").on(
      table.sourceRegistryId,
      table.fetchedAt.desc()
    ),
    index("public_source_captures_hash_idx").on(table.contentHash),
    check(
      "public_source_captures_hash_check",
      sql`${table.hashingAlgorithm} = 'sha256' and ${table.contentHash} ~ '^[0-9a-f]{64}$'`
    ),
    check(
      "public_source_captures_category_check",
      sql`${table.effectiveSourceCategory} in ('primary_institutional', 'government_official', 'recognized_market_association', 'approved_partner', 'named_merchant', 'reputable_secondary', 'public_social', 'unknown_unsupported')`
    ),
    check(
      "public_source_captures_mode_check",
      sql`${table.effectiveIngestionMode} in ('discovery_only', 'fetch_and_stage', 'blocked')`
    ),
    check(
      "public_source_captures_lifecycle_check",
      sql`${table.effectiveLifecycleState} in ('proposed', 'active', 'suspended', 'rejected')`
    ),
    check("public_source_captures_length_check", sql`${table.byteLength} >= 0`),
    check(
      "public_source_captures_url_check",
      sql`${table.canonicalUrl} ~ '^https?://' and ${table.requestUrl} ~ '^https?://' and ${table.finalResolvedUrl} ~ '^https?://'`
    ),
    check(
      "public_source_captures_archive_check",
      sql`${table.archiveMode} in ('external_pointer', 'permitted_archive', 'metadata_only')`
    ),
    check(
      "public_source_captures_status_check",
      sql`${table.captureStatus} in ('captured', 'retained_external', 'metadata_only', 'rejected')`
    ),
    check(
      "public_source_captures_survey_period_check",
      sql`${table.surveyPeriodStart} is null or ${table.surveyPeriodEnd} is null or ${table.surveyPeriodStart} <= ${table.surveyPeriodEnd}`
    ),
    check(
      "public_source_captures_pointer_check",
      sql`${table.archiveMode} = 'metadata_only' or ${table.rawContentPointer} is not null`
    ),
  ]
);

export const publicIngestionFetches = pgTable(
  "public_ingestion_fetches",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    ingestionRunId: uuid("ingestion_run_id")
      .references(() => publicIngestionRuns.id)
      .notNull(),
    sourceRegistryId: uuid("source_registry_id")
      .references(() => publicSourceRegistry.id)
      .notNull(),
    requestUrl: text("request_url").notNull(),
    finalResolvedUrl: text("final_resolved_url"),
    fetchStatusCode: integer("fetch_status_code"),
    fetchResult: varchar("fetch_result", { length: 64 }).notNull(),
    fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull(),
    safeResponseMetadata: jsonb("safe_response_metadata"),
    discoveredPublicationIdentity: varchar("discovered_publication_identity", { length: 255 }),
    sourceCaptureId: uuid("source_capture_id").references(() => publicSourceCaptures.id),
    outcome: varchar("outcome", { length: 32 }).notNull(),
    parserVersion: varchar("parser_version", { length: 64 }).notNull(),
    extractedRecordCount: integer("extracted_record_count"),
    failureSummary: text("failure_summary"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("public_ingestion_fetches_run_source_key").on(
      table.ingestionRunId,
      table.sourceRegistryId
    ),
    foreignKey({
      columns: [table.sourceCaptureId, table.sourceRegistryId],
      foreignColumns: [publicSourceCaptures.id, publicSourceCaptures.sourceRegistryId],
      name: "public_ingestion_fetches_capture_source_fk",
    }),
    index("public_ingestion_fetches_source_fetched_idx").on(
      table.sourceRegistryId,
      table.fetchedAt.desc()
    ),
    check(
      "public_ingestion_fetches_outcome_check",
      sql`${table.outcome} in ('captured', 'unchanged', 'failed', 'blocked_by_policy', 'format_changed')`
    ),
    check(
      "public_ingestion_fetches_url_check",
      sql`${table.requestUrl} ~ '^https?://' and (${table.finalResolvedUrl} is null or ${table.finalResolvedUrl} ~ '^https?://')`
    ),
    check(
      "public_ingestion_fetches_status_code_check",
      sql`${table.fetchStatusCode} is null or (${table.fetchStatusCode} between 100 and 599)`
    ),
    check(
      "public_ingestion_fetches_record_count_check",
      sql`${table.extractedRecordCount} is null or ${table.extractedRecordCount} >= 0`
    ),
    check(
      "public_ingestion_fetches_capture_check",
      sql`${table.outcome} <> 'captured' or ${table.sourceCaptureId} is not null`
    ),
    check(
      "public_ingestion_fetches_format_change_check",
      sql`${table.extractedRecordCount} <> 0 or ${table.outcome} in ('format_changed', 'failed', 'blocked_by_policy', 'unchanged')`
    ),
  ]
);

export const publicFoodCandidates = pgTable(
  "public_food_candidates",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    provenanceType: varchar("provenance_type", { length: 32 }).default("public_source").notNull(),
    sourceRegistryId: uuid("source_registry_id")
      .references(() => publicSourceRegistry.id)
      .notNull(),
    sourceCaptureId: uuid("source_capture_id")
      .references(() => publicSourceCaptures.id)
      .notNull(),
    ingestionRunId: uuid("ingestion_run_id")
      .references(() => publicIngestionRuns.id)
      .notNull(),
    rawItemName: text("raw_item_name").notNull(),
    normalizedItemId: uuid("normalized_item_id").references(() => items.id),
    normalizedItemVariantId: uuid("normalized_item_variant_id").references(() => itemVariants.id),
    rawVariant: text("raw_variant"),
    rawQuantity: text("raw_quantity"),
    quantityValue: numeric("quantity_value", { precision: 18, scale: 6 }),
    rawUnit: text("raw_unit"),
    normalizedUnitId: uuid("normalized_unit_id").references(() => units.id),
    rawPrice: text("raw_price"),
    priceKobo: integer("price_kobo"),
    currency: varchar("currency", { length: 3 }),
    rawAvailability: text("raw_availability"),
    availability: varchar("availability", { length: 32 }).default("unknown").notNull(),
    rawPlaceName: text("raw_place_name"),
    normalizedPlaceId: uuid("normalized_place_id").references(() => places.id),
    areaName: text("area_name"),
    normalizedAreaId: uuid("normalized_area_id").references(() => areas.id),
    geographicPrecision: varchar("geographic_precision", { length: 32 }).notNull(),
    sourceGeographicScope: text("source_geographic_scope"),
    observedAt: timestamp("observed_at", { withTimezone: true }),
    surveyPeriodStart: timestamp("survey_period_start", { withTimezone: true }),
    surveyPeriodEnd: timestamp("survey_period_end", { withTimezone: true }),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull(),
    evidenceReference: text("evidence_reference").notNull(),
    evidencePage: varchar("evidence_page", { length: 64 }),
    evidenceSection: text("evidence_section"),
    evidenceRow: text("evidence_row"),
    extractionMethod: varchar("extraction_method", { length: 32 }).notNull(),
    extractionConfidence: numeric("extraction_confidence", { precision: 5, scale: 4 }).notNull(),
    candidateStatus: varchar("candidate_status", { length: 32 }).notNull(),
    parserVersion: varchar("parser_version", { length: 64 }).notNull(),
    fingerprintPolicyVersion: varchar("fingerprint_policy_version", { length: 64 }).notNull(),
    candidateFingerprint: varchar("candidate_fingerprint", { length: 64 }).notNull(),
    relatedCandidateId: uuid("related_candidate_id").references(
      (): AnyPgColumn => publicFoodCandidates.id
    ),
    relationshipClassification: varchar("relationship_classification", { length: 48 }),
    relationshipReason: text("relationship_reason"),
    rawExtractionMetadata: jsonb("raw_extraction_metadata"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("public_food_candidates_fingerprint_key").on(table.candidateFingerprint),
    uniqueIndex("public_food_candidates_id_fingerprint_key").on(
      table.id,
      table.candidateFingerprint
    ),
    foreignKey({
      columns: [table.sourceCaptureId, table.sourceRegistryId],
      foreignColumns: [publicSourceCaptures.id, publicSourceCaptures.sourceRegistryId],
      name: "public_food_candidates_capture_source_fk",
    }),
    index("public_food_candidates_review_queue_idx").on(
      table.candidateStatus,
      table.createdAt.desc()
    ),
    index("public_food_candidates_capture_idx").on(table.sourceCaptureId),
    index("public_food_candidates_related_idx").on(table.relatedCandidateId),
    check(
      "public_food_candidates_provenance_check",
      sql`${table.provenanceType} = 'public_source'`
    ),
    check(
      "public_food_candidates_availability_check",
      sql`${table.availability} in ('available', 'low_stock', 'unavailable', 'unknown')`
    ),
    check(
      "public_food_candidates_geography_check",
      sql`${table.geographicPrecision} in ('exact_place', 'market', 'neighbourhood', 'lga', 'lagos_state', 'unknown')`
    ),
    check(
      "public_food_candidates_extraction_method_check",
      sql`${table.extractionMethod} in ('structured_api', 'structured_table', 'html', 'pdf', 'manual_review')`
    ),
    check(
      "public_food_candidates_status_check",
      sql`${table.candidateStatus} in ('ready_for_review', 'needs_item_mapping', 'needs_unit_mapping', 'needs_place_mapping', 'ambiguous_date', 'possible_duplicate', 'price_anomaly', 'unsupported', 'rejected')`
    ),
    check(
      "public_food_candidates_confidence_check",
      sql`${table.extractionConfidence} >= 0 and ${table.extractionConfidence} <= 1`
    ),
    check(
      "public_food_candidates_hash_check",
      sql`${table.candidateFingerprint} ~ '^[0-9a-f]{64}$'`
    ),
    check(
      "public_food_candidates_claim_check",
      sql`(${table.rawPrice} is not null and length(trim(${table.rawPrice})) > 0) or (${table.rawAvailability} is not null and length(trim(${table.rawAvailability})) > 0)`
    ),
    check("public_food_candidates_raw_item_check", sql`length(trim(${table.rawItemName})) > 0`),
    check(
      "public_food_candidates_raw_price_check",
      sql`${table.rawPrice} is null or length(trim(${table.rawPrice})) > 0`
    ),
    check(
      "public_food_candidates_raw_availability_check",
      sql`${table.rawAvailability} is null or length(trim(${table.rawAvailability})) > 0`
    ),
    check(
      "public_food_candidates_price_check",
      sql`${table.priceKobo} is null or (${table.priceKobo} > 0 and ${table.currency} = 'NGN')`
    ),
    check(
      "public_food_candidates_availability_evidence_check",
      sql`${table.availability} = 'unknown' or (${table.rawAvailability} is not null and length(trim(${table.rawAvailability})) > 0)`
    ),
    check(
      "public_food_candidates_survey_period_check",
      sql`${table.surveyPeriodStart} is null or ${table.surveyPeriodEnd} is null or ${table.surveyPeriodStart} <= ${table.surveyPeriodEnd}`
    ),
    check(
      "public_food_candidates_evidence_check",
      sql`length(trim(${table.evidenceReference})) > 0`
    ),
    check(
      "public_food_candidates_place_precision_check",
      sql`${table.geographicPrecision} not in ('exact_place', 'market') or ${table.normalizedPlaceId} is not null`
    ),
    check(
      "public_food_candidates_area_precision_check",
      sql`${table.geographicPrecision} not in ('neighbourhood', 'lga') or ${table.normalizedAreaId} is not null`
    ),
    check(
      "public_food_candidates_ready_check",
      sql`${table.candidateStatus} <> 'ready_for_review' or (${table.normalizedItemId} is not null and ${table.normalizedItemVariantId} is not null and (${table.rawUnit} is null or ${table.normalizedUnitId} is not null) and (${table.rawQuantity} is null or ${table.quantityValue} is not null) and (${table.rawPrice} is null or (${table.priceKobo} > 0 and ${table.currency} = 'NGN')) and (${table.rawAvailability} is null or ${table.availability} <> 'unknown') and ${table.geographicPrecision} <> 'unknown' and ${table.sourceGeographicScope} is not null and length(trim(${table.sourceGeographicScope})) > 0 and (${table.observedAt} is not null or (${table.surveyPeriodStart} is not null and ${table.surveyPeriodEnd} is not null)))`
    ),
    check(
      "public_food_candidates_relationship_check",
      sql`(${table.relatedCandidateId} is null and ${table.relationshipClassification} is null and ${table.relationshipReason} is null) or (${table.relatedCandidateId} is not null and ${table.relationshipClassification} in ('repeated_publication', 'syndicated_copy', 'revised_source', 'independent_corroboration', 'superseded_extraction') and ${table.relationshipReason} is not null)`
    ),
  ]
);

export const publicCandidateReviews = pgTable(
  "public_candidate_reviews",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    candidateId: uuid("candidate_id")
      .references(() => publicFoodCandidates.id)
      .notNull(),
    decision: varchar("decision", { length: 32 }).notNull(),
    reviewerIdentity: varchar("reviewer_identity", { length: 255 }).notNull(),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }).notNull(),
    reasonCodes: text("reason_codes").array().notNull(),
    notes: text("notes"),
    candidateFingerprint: varchar("candidate_fingerprint", { length: 64 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("public_candidate_reviews_candidate_reviewed_idx").on(
      table.candidateId,
      table.reviewedAt.desc(),
      table.createdAt.desc()
    ),
    foreignKey({
      columns: [table.candidateId, table.candidateFingerprint],
      foreignColumns: [publicFoodCandidates.id, publicFoodCandidates.candidateFingerprint],
      name: "public_candidate_reviews_candidate_fingerprint_fk",
    }),
    check(
      "public_candidate_reviews_decision_check",
      sql`${table.decision} in ('approve', 'reject', 'request_changes', 'supersede')`
    ),
    check("public_candidate_reviews_actor_check", sql`length(trim(${table.reviewerIdentity})) > 0`),
    check(
      "public_candidate_reviews_fingerprint_check",
      sql`${table.candidateFingerprint} ~ '^[0-9a-f]{64}$'`
    ),
    check("public_candidate_reviews_reasons_check", sql`cardinality(${table.reasonCodes}) > 0`),
  ]
);

export const ingestionSchema = {
  publicSourceRegistry,
  publicIngestionRuns,
  publicIngestionFetches,
  publicSourceCaptures,
  publicFoodCandidates,
  publicCandidateReviews,
} as const;
