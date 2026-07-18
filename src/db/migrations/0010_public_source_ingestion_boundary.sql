CREATE TABLE "public_candidate_reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"candidate_id" uuid NOT NULL,
	"decision" varchar(32) NOT NULL,
	"reviewer_identity" varchar(255) NOT NULL,
	"reviewed_at" timestamp with time zone NOT NULL,
	"reason_codes" text[] NOT NULL,
	"notes" text,
	"candidate_fingerprint" varchar(64) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "public_candidate_reviews_decision_check" CHECK ("public_candidate_reviews"."decision" in ('approve', 'reject', 'request_changes', 'supersede')),
	CONSTRAINT "public_candidate_reviews_actor_check" CHECK (length(trim("public_candidate_reviews"."reviewer_identity")) > 0),
	CONSTRAINT "public_candidate_reviews_fingerprint_check" CHECK ("public_candidate_reviews"."candidate_fingerprint" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "public_candidate_reviews_reasons_check" CHECK (cardinality("public_candidate_reviews"."reason_codes") > 0)
);
--> statement-breakpoint
CREATE TABLE "public_food_candidates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provenance_type" varchar(32) DEFAULT 'public_source' NOT NULL,
	"source_registry_id" uuid NOT NULL,
	"source_capture_id" uuid NOT NULL,
	"ingestion_run_id" uuid NOT NULL,
	"raw_item_name" text NOT NULL,
	"normalized_item_id" uuid,
	"normalized_item_variant_id" uuid,
	"raw_variant" text,
	"raw_quantity" text,
	"quantity_value" numeric(18, 6),
	"raw_unit" text,
	"normalized_unit_id" uuid,
	"raw_price" text,
	"price_kobo" integer,
	"currency" varchar(3),
	"raw_availability" text,
	"availability" varchar(32) DEFAULT 'unknown' NOT NULL,
	"raw_place_name" text,
	"normalized_place_id" uuid,
	"area_name" text,
	"normalized_area_id" uuid,
	"geographic_precision" varchar(32) NOT NULL,
	"source_geographic_scope" text,
	"observed_at" timestamp with time zone,
	"survey_period_start" timestamp with time zone,
	"survey_period_end" timestamp with time zone,
	"published_at" timestamp with time zone,
	"fetched_at" timestamp with time zone NOT NULL,
	"evidence_reference" text NOT NULL,
	"evidence_page" varchar(64),
	"evidence_section" text,
	"evidence_row" text,
	"extraction_method" varchar(32) NOT NULL,
	"extraction_confidence" numeric(5, 4) NOT NULL,
	"candidate_status" varchar(32) NOT NULL,
	"parser_version" varchar(64) NOT NULL,
	"fingerprint_policy_version" varchar(64) NOT NULL,
	"candidate_fingerprint" varchar(64) NOT NULL,
	"related_candidate_id" uuid,
	"relationship_classification" varchar(48),
	"relationship_reason" text,
	"raw_extraction_metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "public_food_candidates_provenance_check" CHECK ("public_food_candidates"."provenance_type" = 'public_source'),
	CONSTRAINT "public_food_candidates_availability_check" CHECK ("public_food_candidates"."availability" in ('available', 'low_stock', 'unavailable', 'unknown')),
	CONSTRAINT "public_food_candidates_geography_check" CHECK ("public_food_candidates"."geographic_precision" in ('exact_place', 'market', 'neighbourhood', 'lga', 'lagos_state', 'unknown')),
	CONSTRAINT "public_food_candidates_extraction_method_check" CHECK ("public_food_candidates"."extraction_method" in ('structured_api', 'structured_table', 'html', 'pdf', 'manual_review')),
	CONSTRAINT "public_food_candidates_status_check" CHECK ("public_food_candidates"."candidate_status" in ('ready_for_review', 'needs_item_mapping', 'needs_unit_mapping', 'needs_place_mapping', 'ambiguous_date', 'possible_duplicate', 'price_anomaly', 'unsupported', 'rejected')),
	CONSTRAINT "public_food_candidates_confidence_check" CHECK ("public_food_candidates"."extraction_confidence" >= 0 and "public_food_candidates"."extraction_confidence" <= 1),
	CONSTRAINT "public_food_candidates_hash_check" CHECK ("public_food_candidates"."candidate_fingerprint" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "public_food_candidates_claim_check" CHECK (("public_food_candidates"."raw_price" is not null and length(trim("public_food_candidates"."raw_price")) > 0) or ("public_food_candidates"."raw_availability" is not null and length(trim("public_food_candidates"."raw_availability")) > 0)),
	CONSTRAINT "public_food_candidates_raw_item_check" CHECK (length(trim("public_food_candidates"."raw_item_name")) > 0),
	CONSTRAINT "public_food_candidates_raw_price_check" CHECK ("public_food_candidates"."raw_price" is null or length(trim("public_food_candidates"."raw_price")) > 0),
	CONSTRAINT "public_food_candidates_raw_availability_check" CHECK ("public_food_candidates"."raw_availability" is null or length(trim("public_food_candidates"."raw_availability")) > 0),
	CONSTRAINT "public_food_candidates_price_check" CHECK ("public_food_candidates"."price_kobo" is null or ("public_food_candidates"."price_kobo" > 0 and "public_food_candidates"."currency" = 'NGN')),
	CONSTRAINT "public_food_candidates_availability_evidence_check" CHECK ("public_food_candidates"."availability" = 'unknown' or ("public_food_candidates"."raw_availability" is not null and length(trim("public_food_candidates"."raw_availability")) > 0)),
	CONSTRAINT "public_food_candidates_survey_period_check" CHECK ("public_food_candidates"."survey_period_start" is null or "public_food_candidates"."survey_period_end" is null or "public_food_candidates"."survey_period_start" <= "public_food_candidates"."survey_period_end"),
	CONSTRAINT "public_food_candidates_evidence_check" CHECK (length(trim("public_food_candidates"."evidence_reference")) > 0),
	CONSTRAINT "public_food_candidates_place_precision_check" CHECK ("public_food_candidates"."geographic_precision" not in ('exact_place', 'market') or "public_food_candidates"."normalized_place_id" is not null),
	CONSTRAINT "public_food_candidates_area_precision_check" CHECK ("public_food_candidates"."geographic_precision" not in ('neighbourhood', 'lga') or "public_food_candidates"."normalized_area_id" is not null),
	CONSTRAINT "public_food_candidates_ready_check" CHECK ("public_food_candidates"."candidate_status" <> 'ready_for_review' or ("public_food_candidates"."normalized_item_id" is not null and "public_food_candidates"."normalized_item_variant_id" is not null and ("public_food_candidates"."raw_unit" is null or "public_food_candidates"."normalized_unit_id" is not null) and ("public_food_candidates"."raw_quantity" is null or "public_food_candidates"."quantity_value" is not null) and ("public_food_candidates"."raw_price" is null or ("public_food_candidates"."price_kobo" > 0 and "public_food_candidates"."currency" = 'NGN')) and ("public_food_candidates"."raw_availability" is null or "public_food_candidates"."availability" <> 'unknown') and "public_food_candidates"."geographic_precision" <> 'unknown' and "public_food_candidates"."source_geographic_scope" is not null and length(trim("public_food_candidates"."source_geographic_scope")) > 0 and ("public_food_candidates"."observed_at" is not null or ("public_food_candidates"."survey_period_start" is not null and "public_food_candidates"."survey_period_end" is not null)))),
	CONSTRAINT "public_food_candidates_relationship_check" CHECK (("public_food_candidates"."related_candidate_id" is null and "public_food_candidates"."relationship_classification" is null and "public_food_candidates"."relationship_reason" is null) or ("public_food_candidates"."related_candidate_id" is not null and "public_food_candidates"."relationship_classification" in ('repeated_publication', 'syndicated_copy', 'revised_source', 'independent_corroboration', 'superseded_extraction') and "public_food_candidates"."relationship_reason" is not null))
);
--> statement-breakpoint
CREATE TABLE "public_ingestion_fetches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ingestion_run_id" uuid NOT NULL,
	"source_registry_id" uuid NOT NULL,
	"request_url" text NOT NULL,
	"final_resolved_url" text,
	"fetch_status_code" integer,
	"fetch_result" varchar(64) NOT NULL,
	"fetched_at" timestamp with time zone NOT NULL,
	"safe_response_metadata" jsonb,
	"discovered_publication_identity" varchar(255),
	"source_capture_id" uuid,
	"outcome" varchar(32) NOT NULL,
	"parser_version" varchar(64) NOT NULL,
	"extracted_record_count" integer,
	"failure_summary" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "public_ingestion_fetches_outcome_check" CHECK ("public_ingestion_fetches"."outcome" in ('captured', 'unchanged', 'failed', 'blocked_by_policy', 'format_changed')),
	CONSTRAINT "public_ingestion_fetches_url_check" CHECK ("public_ingestion_fetches"."request_url" ~ '^https?://' and ("public_ingestion_fetches"."final_resolved_url" is null or "public_ingestion_fetches"."final_resolved_url" ~ '^https?://')),
	CONSTRAINT "public_ingestion_fetches_status_code_check" CHECK ("public_ingestion_fetches"."fetch_status_code" is null or ("public_ingestion_fetches"."fetch_status_code" between 100 and 599)),
	CONSTRAINT "public_ingestion_fetches_record_count_check" CHECK ("public_ingestion_fetches"."extracted_record_count" is null or "public_ingestion_fetches"."extracted_record_count" >= 0),
	CONSTRAINT "public_ingestion_fetches_capture_check" CHECK ("public_ingestion_fetches"."outcome" <> 'captured' or "public_ingestion_fetches"."source_capture_id" is not null),
	CONSTRAINT "public_ingestion_fetches_format_change_check" CHECK ("public_ingestion_fetches"."extracted_record_count" <> 0 or "public_ingestion_fetches"."outcome" in ('format_changed', 'failed', 'blocked_by_policy', 'unchanged'))
);
--> statement-breakpoint
CREATE TABLE "public_ingestion_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_key" varchar(255) NOT NULL,
	"plan_version" varchar(64) NOT NULL,
	"scheduled_at" timestamp with time zone NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"completed_at" timestamp with time zone,
	"runner_bundle_version" varchar(64) NOT NULL,
	"configuration_version" varchar(64) NOT NULL,
	"repository_commit" varchar(64) NOT NULL,
	"repository_branch" varchar(255) NOT NULL,
	"status" varchar(32) DEFAULT 'running' NOT NULL,
	"failure_summary" text,
	"sources_scheduled" integer DEFAULT 0 NOT NULL,
	"sources_fetched" integer DEFAULT 0 NOT NULL,
	"captures_added" integer DEFAULT 0 NOT NULL,
	"candidates_added" integer DEFAULT 0 NOT NULL,
	"candidates_ready_for_review" integer DEFAULT 0 NOT NULL,
	"duplicates_suppressed" integer DEFAULT 0 NOT NULL,
	"rejected_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "public_ingestion_runs_status_check" CHECK ("public_ingestion_runs"."status" in ('running', 'completed', 'completed_with_warnings', 'failed', 'blocked')),
	CONSTRAINT "public_ingestion_runs_completion_check" CHECK ("public_ingestion_runs"."status" = 'running' or "public_ingestion_runs"."completed_at" is not null),
	CONSTRAINT "public_ingestion_runs_counts_check" CHECK ("public_ingestion_runs"."sources_scheduled" >= 0 and "public_ingestion_runs"."sources_fetched" >= 0 and "public_ingestion_runs"."captures_added" >= 0 and "public_ingestion_runs"."candidates_added" >= 0 and "public_ingestion_runs"."candidates_ready_for_review" >= 0 and "public_ingestion_runs"."duplicates_suppressed" >= 0 and "public_ingestion_runs"."rejected_count" >= 0)
);
--> statement-breakpoint
CREATE TABLE "public_source_captures" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_registry_id" uuid NOT NULL,
	"effective_policy_version" varchar(64) NOT NULL,
	"effective_source_category" varchar(64) NOT NULL,
	"effective_ingestion_mode" varchar(32) NOT NULL,
	"effective_lifecycle_state" varchar(32) NOT NULL,
	"canonical_url" text NOT NULL,
	"request_url" text NOT NULL,
	"final_resolved_url" text NOT NULL,
	"title" text,
	"publisher" varchar(255) NOT NULL,
	"upstream_publication_identity" varchar(255),
	"fetched_at" timestamp with time zone NOT NULL,
	"published_at" timestamp with time zone,
	"observed_at" timestamp with time zone,
	"survey_period_start" timestamp with time zone,
	"survey_period_end" timestamp with time zone,
	"content_hash" varchar(64) NOT NULL,
	"hashing_algorithm" varchar(16) DEFAULT 'sha256' NOT NULL,
	"media_type" varchar(255) NOT NULL,
	"byte_length" integer NOT NULL,
	"content_format" varchar(64) NOT NULL,
	"stated_geographic_scope" text,
	"attribution_text" text,
	"archive_mode" varchar(32) NOT NULL,
	"raw_content_pointer" text,
	"parser_version" varchar(64) NOT NULL,
	"capture_status" varchar(32) NOT NULL,
	"notes" text,
	"revises_capture_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "public_source_captures_hash_check" CHECK ("public_source_captures"."hashing_algorithm" = 'sha256' and "public_source_captures"."content_hash" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "public_source_captures_category_check" CHECK ("public_source_captures"."effective_source_category" in ('primary_institutional', 'government_official', 'recognized_market_association', 'approved_partner', 'named_merchant', 'reputable_secondary', 'public_social', 'unknown_unsupported')),
	CONSTRAINT "public_source_captures_mode_check" CHECK ("public_source_captures"."effective_ingestion_mode" in ('discovery_only', 'fetch_and_stage', 'blocked')),
	CONSTRAINT "public_source_captures_lifecycle_check" CHECK ("public_source_captures"."effective_lifecycle_state" in ('proposed', 'active', 'suspended', 'rejected')),
	CONSTRAINT "public_source_captures_length_check" CHECK ("public_source_captures"."byte_length" >= 0),
	CONSTRAINT "public_source_captures_url_check" CHECK ("public_source_captures"."canonical_url" ~ '^https?://' and "public_source_captures"."request_url" ~ '^https?://' and "public_source_captures"."final_resolved_url" ~ '^https?://'),
	CONSTRAINT "public_source_captures_archive_check" CHECK ("public_source_captures"."archive_mode" in ('external_pointer', 'permitted_archive', 'metadata_only')),
	CONSTRAINT "public_source_captures_status_check" CHECK ("public_source_captures"."capture_status" in ('captured', 'retained_external', 'metadata_only', 'rejected')),
	CONSTRAINT "public_source_captures_survey_period_check" CHECK ("public_source_captures"."survey_period_start" is null or "public_source_captures"."survey_period_end" is null or "public_source_captures"."survey_period_start" <= "public_source_captures"."survey_period_end"),
	CONSTRAINT "public_source_captures_pointer_check" CHECK ("public_source_captures"."archive_mode" = 'metadata_only' or "public_source_captures"."raw_content_pointer" is not null)
);
--> statement-breakpoint
CREATE TABLE "public_source_registry" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_name" varchar(255) NOT NULL,
	"canonical_domain" varchar(255) NOT NULL,
	"canonical_landing_url" text NOT NULL,
	"source_category" varchar(64) NOT NULL,
	"publisher_identity" varchar(255) NOT NULL,
	"stated_geographic_scope" text,
	"content_format" varchar(64) NOT NULL,
	"reliability_tier" varchar(32) NOT NULL,
	"review_requirement" varchar(32) DEFAULT 'owner_review' NOT NULL,
	"permitted_ingestion_mode" varchar(32) DEFAULT 'discovery_only' NOT NULL,
	"attribution_requirements" text,
	"archive_retention_requirements" text,
	"lifecycle_state" varchar(32) DEFAULT 'proposed' NOT NULL,
	"policy_version" varchar(64) NOT NULL,
	"approval_reference" text,
	"reviewed_by" varchar(255),
	"reviewed_at" timestamp with time zone,
	"last_successful_fetch_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "public_source_registry_category_check" CHECK ("public_source_registry"."source_category" in ('primary_institutional', 'government_official', 'recognized_market_association', 'approved_partner', 'named_merchant', 'reputable_secondary', 'public_social', 'unknown_unsupported')),
	CONSTRAINT "public_source_registry_reliability_check" CHECK ("public_source_registry"."reliability_tier" in ('high', 'medium', 'low', 'unassessed')),
	CONSTRAINT "public_source_registry_review_check" CHECK ("public_source_registry"."review_requirement" in ('owner_review', 'manual_review', 'discovery_only')),
	CONSTRAINT "public_source_registry_mode_check" CHECK ("public_source_registry"."permitted_ingestion_mode" in ('discovery_only', 'fetch_and_stage', 'blocked')),
	CONSTRAINT "public_source_registry_lifecycle_check" CHECK ("public_source_registry"."lifecycle_state" in ('proposed', 'active', 'suspended', 'rejected')),
	CONSTRAINT "public_source_registry_url_check" CHECK (length(trim("public_source_registry"."canonical_landing_url")) > 0 and "public_source_registry"."canonical_landing_url" ~ '^https?://'),
	CONSTRAINT "public_source_registry_domain_check" CHECK (length(trim("public_source_registry"."canonical_domain")) > 0),
	CONSTRAINT "public_source_registry_active_approval_check" CHECK ("public_source_registry"."lifecycle_state" <> 'active' or ("public_source_registry"."permitted_ingestion_mode" = 'fetch_and_stage' and "public_source_registry"."approval_reference" is not null and "public_source_registry"."reviewed_by" is not null and "public_source_registry"."reviewed_at" is not null)),
	CONSTRAINT "public_source_registry_unsupported_mode_check" CHECK ("public_source_registry"."source_category" <> 'unknown_unsupported' or "public_source_registry"."permitted_ingestion_mode" <> 'fetch_and_stage')
);
--> statement-breakpoint
ALTER TABLE "public_candidate_reviews" ADD CONSTRAINT "public_candidate_reviews_candidate_id_public_food_candidates_id_fk" FOREIGN KEY ("candidate_id") REFERENCES "public"."public_food_candidates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "public_food_candidates_id_fingerprint_key" ON "public_food_candidates" USING btree ("id","candidate_fingerprint");--> statement-breakpoint
ALTER TABLE "public_candidate_reviews" ADD CONSTRAINT "public_candidate_reviews_candidate_fingerprint_fk" FOREIGN KEY ("candidate_id","candidate_fingerprint") REFERENCES "public"."public_food_candidates"("id","candidate_fingerprint") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "public_food_candidates" ADD CONSTRAINT "public_food_candidates_source_registry_id_public_source_registry_id_fk" FOREIGN KEY ("source_registry_id") REFERENCES "public"."public_source_registry"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "public_food_candidates" ADD CONSTRAINT "public_food_candidates_source_capture_id_public_source_captures_id_fk" FOREIGN KEY ("source_capture_id") REFERENCES "public"."public_source_captures"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "public_food_candidates" ADD CONSTRAINT "public_food_candidates_ingestion_run_id_public_ingestion_runs_id_fk" FOREIGN KEY ("ingestion_run_id") REFERENCES "public"."public_ingestion_runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "public_food_candidates" ADD CONSTRAINT "public_food_candidates_normalized_item_id_items_id_fk" FOREIGN KEY ("normalized_item_id") REFERENCES "public"."items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "public_food_candidates" ADD CONSTRAINT "public_food_candidates_normalized_item_variant_id_item_variants_id_fk" FOREIGN KEY ("normalized_item_variant_id") REFERENCES "public"."item_variants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "public_food_candidates" ADD CONSTRAINT "public_food_candidates_normalized_unit_id_units_id_fk" FOREIGN KEY ("normalized_unit_id") REFERENCES "public"."units"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "public_food_candidates" ADD CONSTRAINT "public_food_candidates_normalized_place_id_places_id_fk" FOREIGN KEY ("normalized_place_id") REFERENCES "public"."places"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "public_food_candidates" ADD CONSTRAINT "public_food_candidates_normalized_area_id_areas_id_fk" FOREIGN KEY ("normalized_area_id") REFERENCES "public"."areas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "public_food_candidates" ADD CONSTRAINT "public_food_candidates_related_candidate_id_public_food_candidates_id_fk" FOREIGN KEY ("related_candidate_id") REFERENCES "public"."public_food_candidates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "public_source_captures_id_source_key" ON "public_source_captures" USING btree ("id","source_registry_id");--> statement-breakpoint
ALTER TABLE "public_food_candidates" ADD CONSTRAINT "public_food_candidates_capture_source_fk" FOREIGN KEY ("source_capture_id","source_registry_id") REFERENCES "public"."public_source_captures"("id","source_registry_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "public_ingestion_fetches" ADD CONSTRAINT "public_ingestion_fetches_ingestion_run_id_public_ingestion_runs_id_fk" FOREIGN KEY ("ingestion_run_id") REFERENCES "public"."public_ingestion_runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "public_ingestion_fetches" ADD CONSTRAINT "public_ingestion_fetches_source_registry_id_public_source_registry_id_fk" FOREIGN KEY ("source_registry_id") REFERENCES "public"."public_source_registry"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "public_ingestion_fetches" ADD CONSTRAINT "public_ingestion_fetches_source_capture_id_public_source_captures_id_fk" FOREIGN KEY ("source_capture_id") REFERENCES "public"."public_source_captures"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "public_ingestion_fetches" ADD CONSTRAINT "public_ingestion_fetches_capture_source_fk" FOREIGN KEY ("source_capture_id","source_registry_id") REFERENCES "public"."public_source_captures"("id","source_registry_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "public_source_captures" ADD CONSTRAINT "public_source_captures_source_registry_id_public_source_registry_id_fk" FOREIGN KEY ("source_registry_id") REFERENCES "public"."public_source_registry"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "public_source_captures" ADD CONSTRAINT "public_source_captures_revises_capture_id_public_source_captures_id_fk" FOREIGN KEY ("revises_capture_id") REFERENCES "public"."public_source_captures"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "public_candidate_reviews_candidate_reviewed_idx" ON "public_candidate_reviews" USING btree ("candidate_id","reviewed_at" DESC NULLS LAST,"created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE UNIQUE INDEX "public_food_candidates_fingerprint_key" ON "public_food_candidates" USING btree ("candidate_fingerprint");--> statement-breakpoint
CREATE INDEX "public_food_candidates_review_queue_idx" ON "public_food_candidates" USING btree ("candidate_status","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "public_food_candidates_capture_idx" ON "public_food_candidates" USING btree ("source_capture_id");--> statement-breakpoint
CREATE INDEX "public_food_candidates_related_idx" ON "public_food_candidates" USING btree ("related_candidate_id");--> statement-breakpoint
CREATE UNIQUE INDEX "public_ingestion_fetches_run_source_key" ON "public_ingestion_fetches" USING btree ("ingestion_run_id","source_registry_id");--> statement-breakpoint
CREATE INDEX "public_ingestion_fetches_source_fetched_idx" ON "public_ingestion_fetches" USING btree ("source_registry_id","fetched_at" DESC NULLS LAST);--> statement-breakpoint
CREATE UNIQUE INDEX "public_ingestion_runs_run_key_key" ON "public_ingestion_runs" USING btree ("run_key");--> statement-breakpoint
CREATE INDEX "public_ingestion_runs_scheduled_idx" ON "public_ingestion_runs" USING btree ("scheduled_at" DESC NULLS LAST);--> statement-breakpoint
CREATE UNIQUE INDEX "public_source_captures_identity_key" ON "public_source_captures" USING btree ("source_registry_id","canonical_url",coalesce("upstream_publication_identity", ''),"content_hash");--> statement-breakpoint
CREATE INDEX "public_source_captures_source_fetched_idx" ON "public_source_captures" USING btree ("source_registry_id","fetched_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "public_source_captures_hash_idx" ON "public_source_captures" USING btree ("content_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "public_source_registry_domain_landing_key" ON "public_source_registry" USING btree ("canonical_domain","canonical_landing_url");--> statement-breakpoint
CREATE INDEX "public_source_registry_lifecycle_idx" ON "public_source_registry" USING btree ("lifecycle_state");
--> statement-breakpoint
CREATE FUNCTION "reject_public_ingestion_immutable_change"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
	RAISE EXCEPTION '% is append-only; % is forbidden', TG_TABLE_NAME, TG_OP
		USING ERRCODE = '55000';
END;
$$;
--> statement-breakpoint
CREATE TRIGGER "public_source_captures_reject_update_delete"
BEFORE UPDATE OR DELETE ON "public_source_captures"
FOR EACH ROW EXECUTE FUNCTION "reject_public_ingestion_immutable_change"();
--> statement-breakpoint
CREATE TRIGGER "public_source_captures_reject_truncate"
BEFORE TRUNCATE ON "public_source_captures"
FOR EACH STATEMENT EXECUTE FUNCTION "reject_public_ingestion_immutable_change"();
--> statement-breakpoint
CREATE TRIGGER "public_food_candidates_reject_update_delete"
BEFORE UPDATE OR DELETE ON "public_food_candidates"
FOR EACH ROW EXECUTE FUNCTION "reject_public_ingestion_immutable_change"();
--> statement-breakpoint
CREATE TRIGGER "public_food_candidates_reject_truncate"
BEFORE TRUNCATE ON "public_food_candidates"
FOR EACH STATEMENT EXECUTE FUNCTION "reject_public_ingestion_immutable_change"();
--> statement-breakpoint
CREATE TRIGGER "public_candidate_reviews_reject_update_delete"
BEFORE UPDATE OR DELETE ON "public_candidate_reviews"
FOR EACH ROW EXECUTE FUNCTION "reject_public_ingestion_immutable_change"();
--> statement-breakpoint
CREATE TRIGGER "public_candidate_reviews_reject_truncate"
BEFORE TRUNCATE ON "public_candidate_reviews"
FOR EACH STATEMENT EXECUTE FUNCTION "reject_public_ingestion_immutable_change"();
--> statement-breakpoint
CREATE FUNCTION "enforce_public_capture_policy_snapshot"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
	registry_category varchar(64);
	registry_lifecycle varchar(32);
	registry_mode varchar(32);
	registry_policy_version varchar(64);
BEGIN
	SELECT "source_category", "lifecycle_state", "permitted_ingestion_mode", "policy_version"
	INTO registry_category, registry_lifecycle, registry_mode, registry_policy_version
	FROM "public_source_registry"
	WHERE "id" = NEW."source_registry_id";

	IF registry_category IS NULL THEN
		RAISE EXCEPTION 'capture source registry does not exist'
			USING ERRCODE = '23514';
	END IF;

	IF NEW."effective_source_category" IS DISTINCT FROM registry_category
		OR NEW."effective_lifecycle_state" IS DISTINCT FROM registry_lifecycle
		OR NEW."effective_ingestion_mode" IS DISTINCT FROM registry_mode
		OR NEW."effective_policy_version" IS DISTINCT FROM registry_policy_version THEN
		RAISE EXCEPTION 'capture policy snapshot does not match source registry'
			USING ERRCODE = '23514';
	END IF;

	IF NEW."capture_status" IN ('captured', 'retained_external')
		AND (registry_lifecycle IS DISTINCT FROM 'active'
			OR registry_mode IS DISTINCT FROM 'fetch_and_stage'
			OR registry_category = 'unknown_unsupported') THEN
		RAISE EXCEPTION 'source policy does not permit retained capture'
			USING ERRCODE = '23514';
	END IF;

	RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER "public_source_captures_enforce_policy_snapshot"
BEFORE INSERT ON "public_source_captures"
FOR EACH ROW EXECUTE FUNCTION "enforce_public_capture_policy_snapshot"();
--> statement-breakpoint
CREATE FUNCTION "enforce_public_candidate_staging_policy"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
	registry_lifecycle varchar(32);
	registry_mode varchar(32);
	capture_registry uuid;
	capture_lifecycle varchar(32);
	capture_mode varchar(32);
	capture_category varchar(64);
	capture_status_value varchar(32);
BEGIN
	SELECT registry_row."lifecycle_state", registry_row."permitted_ingestion_mode"
	INTO registry_lifecycle, registry_mode
	FROM "public_source_registry" AS registry_row
	WHERE registry_row."id" = NEW."source_registry_id";

	IF registry_lifecycle IS DISTINCT FROM 'active'
		OR registry_mode IS DISTINCT FROM 'fetch_and_stage' THEN
		RAISE EXCEPTION 'candidate source is not active for fetch_and_stage'
			USING ERRCODE = '23514';
	END IF;

	SELECT capture_row."source_registry_id", capture_row."effective_lifecycle_state",
		capture_row."effective_ingestion_mode", capture_row."effective_source_category",
		capture_row."capture_status"
	INTO capture_registry, capture_lifecycle, capture_mode, capture_category, capture_status_value
	FROM "public_source_captures" AS capture_row
	WHERE capture_row."id" = NEW."source_capture_id";

	IF capture_registry IS DISTINCT FROM NEW."source_registry_id" THEN
		RAISE EXCEPTION 'candidate capture does not belong to source registry'
			USING ERRCODE = '23514';
	END IF;

	IF capture_lifecycle IS DISTINCT FROM 'active'
		OR capture_mode IS DISTINCT FROM 'fetch_and_stage'
		OR capture_category IS NULL
		OR capture_category = 'unknown_unsupported'
		OR capture_status_value NOT IN ('captured', 'retained_external') THEN
		RAISE EXCEPTION 'candidate capture policy does not permit staging'
			USING ERRCODE = '23514';
	END IF;

	RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER "public_food_candidates_enforce_staging_policy"
BEFORE INSERT ON "public_food_candidates"
FOR EACH ROW EXECUTE FUNCTION "enforce_public_candidate_staging_policy"();
