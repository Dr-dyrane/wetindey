CREATE TYPE "public"."contribution_assignment_status" AS ENUM('active', 'suspended', 'revoked');--> statement-breakpoint
CREATE TYPE "public"."contribution_audit_action" AS ENUM('rate_allowed', 'rate_denied', 'admission', 'idempotency_conflict', 'moderation_approved', 'moderation_rejected', 'moderation_reversed', 'projection_updated', 'assignment_updated', 'control_updated');--> statement-breakpoint
CREATE TYPE "public"."contribution_decision" AS ENUM('approve', 'reject', 'reverse');--> statement-breakpoint
CREATE TYPE "public"."contribution_operation" AS ENUM('report_price', 'visit_confirmation', 'correction');--> statement-breakpoint
CREATE TYPE "public"."contribution_projection_state" AS ENUM('available', 'unavailable', 'conflict');--> statement-breakpoint
CREATE TYPE "public"."contribution_rate_dimension" AS ENUM('subject', 'network');--> statement-breakpoint
CREATE TABLE "contribution_audit_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_id" uuid NOT NULL,
	"action" "contribution_audit_action" NOT NULL,
	"actor_account_id" uuid,
	"subject_digest" varchar(64),
	"observation_id" uuid,
	"decision_id" uuid,
	"reason_code" varchar(64) NOT NULL,
	"details" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "contribution_audit_events_digest_check" CHECK ("contribution_audit_events"."subject_digest" is null or "contribution_audit_events"."subject_digest" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "contribution_audit_events_reason_check" CHECK ("contribution_audit_events"."reason_code" ~ '^[a-z0-9_]{2,64}$'),
	CONSTRAINT "contribution_audit_events_details_check" CHECK (length("contribution_audit_events"."details"::text) <= 4096)
);
--> statement-breakpoint
CREATE TABLE "contribution_control" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"reporting_allowed" boolean DEFAULT false NOT NULL,
	"moderation_allowed" boolean DEFAULT false NOT NULL,
	"subject_limit_15m" integer DEFAULT 5 NOT NULL,
	"subject_limit_day" integer DEFAULT 20 NOT NULL,
	"network_limit_15m" integer DEFAULT 30 NOT NULL,
	"network_limit_day" integer DEFAULT 100 NOT NULL,
	"unavailable_min_sources" integer DEFAULT 2 NOT NULL,
	"projection_window_hours" integer DEFAULT 72 NOT NULL,
	"policy_version" varchar(64) DEFAULT 'adr-019-v1' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "contribution_control_singleton_check" CHECK ("contribution_control"."id" = 1),
	CONSTRAINT "contribution_control_limits_check" CHECK ("contribution_control"."subject_limit_15m" > 0
        and "contribution_control"."subject_limit_day" >= "contribution_control"."subject_limit_15m"
        and "contribution_control"."network_limit_15m" > 0
        and "contribution_control"."network_limit_day" >= "contribution_control"."network_limit_15m"
        and "contribution_control"."unavailable_min_sources" >= 2
        and "contribution_control"."projection_window_hours" between 1 and 168),
	CONSTRAINT "contribution_control_policy_check" CHECK (length(trim("contribution_control"."policy_version")) between 1 and 64)
);
--> statement-breakpoint
CREATE TABLE "contribution_moderation_decisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"observation_id" uuid NOT NULL,
	"decision" "contribution_decision" NOT NULL,
	"actor_account_id" uuid NOT NULL,
	"prior_decision_id" uuid,
	"request_id" uuid NOT NULL,
	"payload_digest" varchar(64) NOT NULL,
	"reason_code" varchar(64) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "contribution_moderation_decisions_shape_check" CHECK (("contribution_moderation_decisions"."decision" = 'reverse' and "contribution_moderation_decisions"."prior_decision_id" is not null)
        or ("contribution_moderation_decisions"."decision" in ('approve', 'reject') and "contribution_moderation_decisions"."prior_decision_id" is null)),
	CONSTRAINT "contribution_moderation_decisions_digest_check" CHECK ("contribution_moderation_decisions"."payload_digest" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "contribution_moderation_decisions_reason_check" CHECK ("contribution_moderation_decisions"."reason_code" ~ '^[a-z0-9_]{2,64}$')
);
--> statement-breakpoint
CREATE TABLE "contribution_moderator_assignments" (
	"account_id" uuid PRIMARY KEY NOT NULL,
	"status" "contribution_assignment_status" DEFAULT 'suspended' NOT NULL,
	"issued_by_account_id" uuid NOT NULL,
	"reviewed_by_account_id" uuid NOT NULL,
	"effective_at" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "contribution_moderator_assignments_separation_check" CHECK ("contribution_moderator_assignments"."account_id" <> "contribution_moderator_assignments"."issued_by_account_id"
        and "contribution_moderator_assignments"."account_id" <> "contribution_moderator_assignments"."reviewed_by_account_id"
        and "contribution_moderator_assignments"."issued_by_account_id" <> "contribution_moderator_assignments"."reviewed_by_account_id"),
	CONSTRAINT "contribution_moderator_assignments_time_check" CHECK ("contribution_moderator_assignments"."expires_at" is null or "contribution_moderator_assignments"."expires_at" > "contribution_moderator_assignments"."effective_at")
);
--> statement-breakpoint
CREATE TABLE "contribution_projections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"item_variant_id" uuid NOT NULL,
	"unit_id" uuid NOT NULL,
	"place_id" uuid NOT NULL,
	"state" "contribution_projection_state" NOT NULL,
	"price_kind" varchar(50),
	"price_min" integer,
	"price_max" integer,
	"currency" varchar(10) DEFAULT 'NGN' NOT NULL,
	"last_observed_at" timestamp NOT NULL,
	"expires_at" timestamp NOT NULL,
	"supporting_observation_count" integer NOT NULL,
	"available_source_count" integer DEFAULT 0 NOT NULL,
	"unavailable_source_count" integer DEFAULT 0 NOT NULL,
	"policy_version" varchar(64) NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "contribution_projections_counts_check" CHECK ("contribution_projections"."supporting_observation_count" > 0
        and "contribution_projections"."available_source_count" >= 0
        and "contribution_projections"."unavailable_source_count" >= 0),
	CONSTRAINT "contribution_projections_price_check" CHECK ((
          "contribution_projections"."state" = 'available'
          and "contribution_projections"."price_min" is not null
          and "contribution_projections"."price_min" > 0
          and "contribution_projections"."price_kind" in ('Exact', 'Range')
          and (
            ("contribution_projections"."price_kind" = 'Exact' and "contribution_projections"."price_max" is null)
            or ("contribution_projections"."price_kind" = 'Range' and "contribution_projections"."price_max" is not null and "contribution_projections"."price_max" > "contribution_projections"."price_min")
          )
        )
        or (
          "contribution_projections"."state" = 'unavailable'
          and "contribution_projections"."price_kind" is null
          and "contribution_projections"."price_min" is null
          and "contribution_projections"."price_max" is null
          and "contribution_projections"."unavailable_source_count" >= 2
        )
        or (
          "contribution_projections"."state" = 'conflict'
          and (
            ("contribution_projections"."price_kind" is null and "contribution_projections"."price_min" is null and "contribution_projections"."price_max" is null)
            or (
              "contribution_projections"."price_min" is not null
              and "contribution_projections"."price_min" > 0
              and "contribution_projections"."price_kind" in ('Exact', 'Range')
              and (
                ("contribution_projections"."price_kind" = 'Exact' and "contribution_projections"."price_max" is null)
                or ("contribution_projections"."price_kind" = 'Range' and "contribution_projections"."price_max" is not null and "contribution_projections"."price_max" > "contribution_projections"."price_min")
              )
            )
          )
        )),
	CONSTRAINT "contribution_projections_expiry_check" CHECK ("contribution_projections"."expires_at" > "contribution_projections"."last_observed_at"),
	CONSTRAINT "contribution_projections_policy_check" CHECK (length(trim("contribution_projections"."policy_version")) between 1 and 64)
);
--> statement-breakpoint
CREATE TABLE "contribution_rate_buckets" (
	"operation" "contribution_operation" NOT NULL,
	"dimension" "contribution_rate_dimension" NOT NULL,
	"key_digest" varchar(64) NOT NULL,
	"window_started_at" timestamp with time zone NOT NULL,
	"window_seconds" integer NOT NULL,
	"used_count" integer DEFAULT 0 NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "contribution_rate_buckets_pk" PRIMARY KEY("operation","dimension","key_digest","window_started_at","window_seconds"),
	CONSTRAINT "contribution_rate_buckets_digest_check" CHECK ("contribution_rate_buckets"."key_digest" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "contribution_rate_buckets_window_check" CHECK ("contribution_rate_buckets"."window_seconds" in (900, 86400)
        and "contribution_rate_buckets"."used_count" >= 0
        and "contribution_rate_buckets"."expires_at" = "contribution_rate_buckets"."window_started_at" + make_interval(secs => "contribution_rate_buckets"."window_seconds"))
);
--> statement-breakpoint
CREATE TABLE "contribution_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"operation" "contribution_operation" NOT NULL,
	"idempotency_key" uuid NOT NULL,
	"subject_digest" varchar(64) NOT NULL,
	"payload_digest" varchar(64) NOT NULL,
	"source_id" uuid NOT NULL,
	"observation_id" uuid,
	"result_code" varchar(32) DEFAULT 'pending_review' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "contribution_requests_digest_check" CHECK ("contribution_requests"."subject_digest" ~ '^[0-9a-f]{64}$'
        and "contribution_requests"."payload_digest" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "contribution_requests_result_check" CHECK ("contribution_requests"."result_code" = 'pending_review'),
	CONSTRAINT "contribution_requests_completion_check" CHECK ("contribution_requests"."completed_at" >= "contribution_requests"."created_at")
);
--> statement-breakpoint
ALTER TABLE "observations" ADD COLUMN "admission_id" uuid;--> statement-breakpoint
ALTER TABLE "observations" ADD COLUMN "corrects_observation_id" uuid;--> statement-breakpoint
ALTER TABLE "contribution_audit_events" ADD CONSTRAINT "contribution_audit_events_observation_id_observations_id_fk" FOREIGN KEY ("observation_id") REFERENCES "public"."observations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contribution_audit_events" ADD CONSTRAINT "contribution_audit_events_decision_id_contribution_moderation_decisions_id_fk" FOREIGN KEY ("decision_id") REFERENCES "public"."contribution_moderation_decisions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contribution_moderation_decisions" ADD CONSTRAINT "contribution_moderation_decisions_observation_id_observations_id_fk" FOREIGN KEY ("observation_id") REFERENCES "public"."observations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contribution_moderation_decisions" ADD CONSTRAINT "contribution_moderation_decisions_prior_decision_id_contribution_moderation_decisions_id_fk" FOREIGN KEY ("prior_decision_id") REFERENCES "public"."contribution_moderation_decisions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contribution_projections" ADD CONSTRAINT "contribution_projections_item_variant_id_item_variants_id_fk" FOREIGN KEY ("item_variant_id") REFERENCES "public"."item_variants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contribution_projections" ADD CONSTRAINT "contribution_projections_unit_id_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contribution_projections" ADD CONSTRAINT "contribution_projections_place_id_places_id_fk" FOREIGN KEY ("place_id") REFERENCES "public"."places"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contribution_requests" ADD CONSTRAINT "contribution_requests_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "contribution_audit_events_request_idx" ON "contribution_audit_events" USING btree ("request_id","created_at");--> statement-breakpoint
CREATE INDEX "contribution_audit_events_observation_idx" ON "contribution_audit_events" USING btree ("observation_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "contribution_moderation_decisions_request_key" ON "contribution_moderation_decisions" USING btree ("request_id");--> statement-breakpoint
CREATE UNIQUE INDEX "contribution_moderation_decisions_reversal_key" ON "contribution_moderation_decisions" USING btree ("prior_decision_id");--> statement-breakpoint
CREATE INDEX "contribution_moderation_decisions_observation_created_idx" ON "contribution_moderation_decisions" USING btree ("observation_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "contribution_moderator_assignments_status_idx" ON "contribution_moderator_assignments" USING btree ("status","expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "contribution_projections_subject_key" ON "contribution_projections" USING btree ("item_variant_id","unit_id","place_id");--> statement-breakpoint
CREATE INDEX "contribution_projections_expiry_idx" ON "contribution_projections" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "contribution_rate_buckets_expiry_idx" ON "contribution_rate_buckets" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "contribution_requests_subject_idempotency_key" ON "contribution_requests" USING btree ("operation","subject_digest","idempotency_key");--> statement-breakpoint
CREATE UNIQUE INDEX "contribution_requests_observation_key" ON "contribution_requests" USING btree ("observation_id");--> statement-breakpoint
CREATE INDEX "contribution_requests_source_created_idx" ON "contribution_requests" USING btree ("source_id","created_at" DESC NULLS LAST);--> statement-breakpoint
ALTER TABLE "observations" ADD CONSTRAINT "observations_admission_id_contribution_requests_id_fk" FOREIGN KEY ("admission_id") REFERENCES "public"."contribution_requests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "observations" ADD CONSTRAINT "observations_corrects_observation_id_observations_id_fk" FOREIGN KEY ("corrects_observation_id") REFERENCES "public"."observations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "observations_admission_key" ON "observations" USING btree ("admission_id");--> statement-breakpoint
CREATE INDEX "observations_correction_idx" ON "observations" USING btree ("corrects_observation_id");--> statement-breakpoint
ALTER TABLE "observations" ADD CONSTRAINT "observations_contribution_claim_check" CHECK ("observations"."admission_id" is null
      or (
        "observations"."provenance" = 'observed'
        and "observations"."moderation_status" = 'pending'
        and (
          ("observations"."availability_state" = 'available' and "observations"."price_amount" is not null and "observations"."price_amount" > 0)
          or ("observations"."availability_state" = 'unavailable' and "observations"."price_amount" is null)
        )
      ));--> statement-breakpoint
ALTER TABLE "observations" ADD CONSTRAINT "observations_correction_not_self_check" CHECK ("observations"."corrects_observation_id" is null or "observations"."corrects_observation_id" <> "observations"."id");
--> statement-breakpoint
-- Canonical ADR-019 integrity primitives that Drizzle cannot express.
-- Existing observations remain legacy evidence. Only rows carrying admission_id
-- enter this append-only boundary.

INSERT INTO public.contribution_control (id, reporting_allowed, moderation_allowed)
VALUES (1, false, false)
ON CONFLICT (id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.contribution_assert_digest(
  p_name text,
  p_digest text
)
RETURNS void
LANGUAGE plpgsql
IMMUTABLE
SET search_path = pg_catalog
AS $$
BEGIN
  IF p_digest IS NULL OR p_digest !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION '% must be a lowercase SHA-256 HMAC digest', p_name
      USING ERRCODE = '22023';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.contribution_forbid_append_only_mutation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $$
BEGIN
  RAISE EXCEPTION '% is append-only', TG_TABLE_NAME
    USING ERRCODE = '55000';
END;
$$;

CREATE OR REPLACE FUNCTION public.contribution_protect_admitted_observation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $$
BEGIN
  IF OLD.admission_id IS NOT NULL THEN
    RAISE EXCEPTION 'admitted observations are immutable'
      USING ERRCODE = '55000';
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS contribution_requests_append_only
  ON public.contribution_requests;
CREATE TRIGGER contribution_requests_append_only
  BEFORE UPDATE OR DELETE ON public.contribution_requests
  FOR EACH ROW EXECUTE FUNCTION public.contribution_forbid_append_only_mutation();

DROP TRIGGER IF EXISTS contribution_decisions_append_only
  ON public.contribution_moderation_decisions;
CREATE TRIGGER contribution_decisions_append_only
  BEFORE UPDATE OR DELETE ON public.contribution_moderation_decisions
  FOR EACH ROW EXECUTE FUNCTION public.contribution_forbid_append_only_mutation();

DROP TRIGGER IF EXISTS contribution_audit_append_only
  ON public.contribution_audit_events;
CREATE TRIGGER contribution_audit_append_only
  BEFORE UPDATE OR DELETE ON public.contribution_audit_events
  FOR EACH ROW EXECUTE FUNCTION public.contribution_forbid_append_only_mutation();

DROP TRIGGER IF EXISTS contribution_observations_immutable
  ON public.observations;
CREATE TRIGGER contribution_observations_immutable
  BEFORE UPDATE OR DELETE ON public.observations
  FOR EACH ROW EXECUTE FUNCTION public.contribution_protect_admitted_observation();
--> statement-breakpoint
-- Canonical ADR-019 moderation and approved-only projection helpers.

CREATE OR REPLACE FUNCTION public.contribution_assert_moderator(
  p_actor uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  v_allowed boolean;
BEGIN
  IF p_actor IS NULL THEN
    RAISE EXCEPTION 'moderation requires an authenticated actor'
      USING ERRCODE = '28000';
  END IF;

  SELECT control.moderation_allowed INTO v_allowed
  FROM public.contribution_control control
  WHERE control.id = 1;

  IF v_allowed IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'contribution moderation is disabled'
      USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.contribution_moderator_assignments assignment
    WHERE assignment.account_id = p_actor
      AND assignment.status = 'active'
      AND assignment.effective_at <= clock_timestamp()
      AND (assignment.expires_at IS NULL OR assignment.expires_at > clock_timestamp())
  ) THEN
    RAISE EXCEPTION 'actor has no active contribution moderation assignment'
      USING ERRCODE = '42501';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.contribution_effective_decision_id(
  p_observation_id uuid
)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
  SELECT decision.id
  FROM public.contribution_moderation_decisions decision
  WHERE decision.observation_id = p_observation_id
    AND decision.decision IN ('approve', 'reject')
    AND NOT EXISTS (
      SELECT 1
      FROM public.contribution_moderation_decisions reversal
      WHERE reversal.prior_decision_id = decision.id
        AND reversal.decision = 'reverse'
    )
  ORDER BY decision.created_at DESC, decision.id DESC
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.contribution_recompute_projection_internal(
  p_item_variant_id uuid,
  p_unit_id uuid,
  p_place_id uuid
)
RETURNS public.contribution_projection_state
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  v_control public.contribution_control%ROWTYPE;
  v_available_rows integer;
  v_unavailable_rows integer;
  v_available_sources integer;
  v_unavailable_sources integer;
  v_price_min integer;
  v_price_max integer;
  v_available_last_observed_at timestamp;
  v_unavailable_last_observed_at timestamp;
  v_last_observed_at timestamp;
  v_state public.contribution_projection_state;
  v_price_kind text;
  v_expiration timestamp;
BEGIN
  IF p_item_variant_id IS NULL OR p_unit_id IS NULL OR p_place_id IS NULL THEN
    RAISE EXCEPTION 'projection key must be complete'
      USING ERRCODE = '22023';
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended(
      p_item_variant_id::text || ':' || p_unit_id::text || ':' || p_place_id::text,
      19019
    )
  );

  SELECT * INTO STRICT v_control
  FROM public.contribution_control control
  WHERE control.id = 1
  FOR SHARE;

  WITH approved AS (
    SELECT observation.*
    FROM public.observations observation
    JOIN public.contribution_moderation_decisions decision
      ON decision.id = public.contribution_effective_decision_id(observation.id)
     AND decision.decision = 'approve'
    WHERE observation.item_variant_id = p_item_variant_id
      AND observation.unit_id = p_unit_id
      AND observation.place_id = p_place_id
      AND observation.admission_id IS NOT NULL
      AND observation.provenance = 'observed'
      AND observation.currency = 'NGN'
      -- An approved correction supersedes, but never mutates, its predecessor.
      -- Pending or rejected corrections cannot hide approved evidence.
      AND NOT EXISTS (
        SELECT 1
        FROM public.observations correction
        JOIN public.contribution_moderation_decisions correction_decision
          ON correction_decision.id =
            public.contribution_effective_decision_id(correction.id)
         AND correction_decision.decision = 'approve'
        WHERE correction.corrects_observation_id = observation.id
          AND correction.admission_id IS NOT NULL
          -- An unavailable correction is contradictory evidence, not authority
          -- for one source to erase a previously available price. It may
          -- supersede unavailable evidence; available corrections supersede
          -- either shape.
          AND (
            correction.availability_state <> 'unavailable'
            OR observation.availability_state = 'unavailable'
          )
      )
      AND observation.observed_at >=
        (clock_timestamp() AT TIME ZONE 'UTC')
          - make_interval(hours => v_control.projection_window_hours)
      AND observation.observed_at <= (clock_timestamp() AT TIME ZONE 'UTC')
  )
  SELECT
    (count(*) FILTER (WHERE approved.availability_state = 'available'))::integer,
    (count(*) FILTER (WHERE approved.availability_state = 'unavailable'))::integer,
    (count(DISTINCT approved.source_id)
      FILTER (WHERE approved.availability_state = 'available'))::integer,
    (count(DISTINCT approved.source_id)
      FILTER (WHERE approved.availability_state = 'unavailable'))::integer,
    (min(approved.price_amount)
      FILTER (WHERE approved.availability_state = 'available'))::integer,
    (max(approved.price_amount)
      FILTER (WHERE approved.availability_state = 'available'))::integer,
    max(approved.observed_at)
      FILTER (WHERE approved.availability_state = 'available'),
    max(approved.observed_at)
      FILTER (WHERE approved.availability_state = 'unavailable')
  INTO
    v_available_rows,
    v_unavailable_rows,
    v_available_sources,
    v_unavailable_sources,
    v_price_min,
    v_price_max,
    v_available_last_observed_at,
    v_unavailable_last_observed_at
  FROM approved;

  v_available_rows := coalesce(v_available_rows, 0);
  v_unavailable_rows := coalesce(v_unavailable_rows, 0);
  v_available_sources := coalesce(v_available_sources, 0);
  v_unavailable_sources := coalesce(v_unavailable_sources, 0);

  IF v_available_rows + v_unavailable_rows = 0 THEN
    DELETE FROM public.contribution_projections projection
    WHERE projection.item_variant_id = p_item_variant_id
      AND projection.unit_id = p_unit_id
      AND projection.place_id = p_place_id;
    RETURN NULL;
  END IF;

  IF v_available_rows > 0 AND v_unavailable_rows > 0 THEN
    v_state := 'conflict';
  ELSIF v_available_rows > 0 THEN
    v_state := 'available';
  ELSIF v_unavailable_sources >= v_control.unavailable_min_sources THEN
    v_state := 'unavailable';
  ELSE
    -- One unavailable source is reviewable evidence, never a destructive state.
    v_state := 'conflict';
  END IF;

  IF v_available_rows > 0 THEN
    -- A contradiction changes state, never the freshness of the retained
    -- available price. `updated_at` records the projection transition itself.
    v_last_observed_at := v_available_last_observed_at;
    v_price_kind := CASE WHEN v_price_max > v_price_min THEN 'Range' ELSE 'Exact' END;
    IF v_price_kind = 'Exact' THEN
      v_price_max := NULL;
    END IF;
  ELSE
    v_last_observed_at := v_unavailable_last_observed_at;
    v_price_kind := NULL;
    v_price_min := NULL;
    v_price_max := NULL;
  END IF;

  v_expiration := v_last_observed_at
    + make_interval(hours => v_control.projection_window_hours);

  INSERT INTO public.contribution_projections (
    item_variant_id,
    unit_id,
    place_id,
    state,
    price_kind,
    price_min,
    price_max,
    currency,
    last_observed_at,
    expires_at,
    supporting_observation_count,
    available_source_count,
    unavailable_source_count,
    policy_version,
    updated_at
  )
  VALUES (
    p_item_variant_id,
    p_unit_id,
    p_place_id,
    v_state,
    v_price_kind,
    v_price_min,
    v_price_max,
    'NGN',
    v_last_observed_at,
    v_expiration,
    v_available_rows + v_unavailable_rows,
    v_available_sources,
    v_unavailable_sources,
    v_control.policy_version,
    clock_timestamp()
  )
  ON CONFLICT (item_variant_id, unit_id, place_id)
  DO UPDATE SET
    state = EXCLUDED.state,
    price_kind = EXCLUDED.price_kind,
    price_min = EXCLUDED.price_min,
    price_max = EXCLUDED.price_max,
    currency = EXCLUDED.currency,
    last_observed_at = EXCLUDED.last_observed_at,
    expires_at = EXCLUDED.expires_at,
    supporting_observation_count = EXCLUDED.supporting_observation_count,
    available_source_count = EXCLUDED.available_source_count,
    unavailable_source_count = EXCLUDED.unavailable_source_count,
    policy_version = EXCLUDED.policy_version,
    updated_at = EXCLUDED.updated_at;

  RETURN v_state;
END;
$$;
--> statement-breakpoint
-- Canonical ADR-019 service boundary. Browser callers never execute these
-- functions directly; a later Server Action supplies server-derived subject and
-- network HMAC digests and the authenticated actor, when present.

CREATE OR REPLACE FUNCTION public.contribution_admit(
  p_operation public.contribution_operation,
  p_idempotency_key uuid,
  p_subject_digest text,
  p_network_digest text,
  p_payload_digest text,
  p_actor uuid,
  p_item_variant_id uuid,
  p_unit_id uuid,
  p_place_id uuid,
  p_availability_state text,
  p_price_amount integer,
  p_observed_at timestamp,
  p_did_buy boolean DEFAULT NULL,
  p_corrects_observation_id uuid DEFAULT NULL
)
RETURNS TABLE (
  request_id uuid,
  observation_id uuid,
  result_code text,
  replayed boolean,
  retry_after_seconds integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  v_now timestamptz := clock_timestamp();
  v_now_utc timestamp := clock_timestamp() AT TIME ZONE 'UTC';
  v_attempt_id uuid := gen_random_uuid();
  v_observation_id uuid := gen_random_uuid();
  v_existing public.contribution_requests%ROWTYPE;
  v_control public.contribution_control%ROWTYPE;
  v_source_id uuid;
  v_collection_method text;
  v_subject_15_start timestamptz;
  v_day_start timestamptz;
  v_subject_15_count integer;
  v_subject_day_count integer;
  v_network_15_count integer;
  v_network_day_count integer;
  v_retry integer := 0;
  v_original_subject text;
  v_original public.observations%ROWTYPE;
BEGIN
  IF p_operation IS NULL OR p_idempotency_key IS NULL THEN
    RAISE EXCEPTION 'operation and idempotency key are required'
      USING ERRCODE = '22023';
  END IF;
  PERFORM public.contribution_assert_digest('subject digest', p_subject_digest);
  PERFORM public.contribution_assert_digest('network digest', p_network_digest);
  PERFORM public.contribution_assert_digest('payload digest', p_payload_digest);

  -- Same subject/key requests serialize before any policy or rate effect.
  PERFORM pg_advisory_xact_lock(
    hashtextextended(
      p_operation::text || ':' || p_subject_digest || ':' || p_idempotency_key::text,
      19019
    )
  );

  SELECT request.* INTO v_existing
  FROM public.contribution_requests request
  WHERE request.operation = p_operation
    AND request.subject_digest = p_subject_digest
    AND request.idempotency_key = p_idempotency_key;

  IF FOUND THEN
    IF v_existing.payload_digest = p_payload_digest THEN
      RETURN QUERY SELECT
        v_existing.id,
        v_existing.observation_id,
        v_existing.result_code::text,
        true,
        NULL::integer;
      RETURN;
    END IF;

    INSERT INTO public.contribution_audit_events (
      request_id,
      action,
      actor_account_id,
      subject_digest,
      observation_id,
      reason_code,
      details
    )
    VALUES (
      v_attempt_id,
      'idempotency_conflict',
      p_actor,
      p_subject_digest,
      v_existing.observation_id,
      'payload_digest_mismatch',
      jsonb_build_object('operation', p_operation::text)
    );

    RETURN QUERY SELECT
      v_attempt_id,
      NULL::uuid,
      'idempotency_conflict'::text,
      false,
      NULL::integer;
    RETURN;
  END IF;

  SELECT * INTO STRICT v_control
  FROM public.contribution_control control
  WHERE control.id = 1
  FOR SHARE;

  IF NOT v_control.reporting_allowed THEN
    RETURN QUERY SELECT
      v_attempt_id,
      NULL::uuid,
      'reporting_disabled'::text,
      false,
      NULL::integer;
    RETURN;
  END IF;

  -- Time-dependent and claim validation applies only to a genuinely new
  -- admission. A durable replay remains stable after its original claim ages.
  IF p_item_variant_id IS NULL OR p_unit_id IS NULL OR p_place_id IS NULL THEN
    RAISE EXCEPTION 'item variant, unit and place are required'
      USING ERRCODE = '22023';
  END IF;
  IF p_availability_state NOT IN ('available', 'unavailable') THEN
    RAISE EXCEPTION 'availability must be available or unavailable'
      USING ERRCODE = '22023';
  END IF;
  IF (p_availability_state = 'available' AND (p_price_amount IS NULL OR p_price_amount <= 0))
     OR (p_availability_state = 'unavailable' AND p_price_amount IS NOT NULL) THEN
    RAISE EXCEPTION 'unavailable forbids price and available requires a positive price'
      USING ERRCODE = '23514';
  END IF;
  IF p_availability_state = 'unavailable' AND p_did_buy IS NOT NULL THEN
    RAISE EXCEPTION 'an unavailable item cannot have a purchase outcome'
      USING ERRCODE = '23514';
  END IF;
  IF p_observed_at IS NULL
     OR p_observed_at > v_now_utc + interval '5 minutes'
     OR p_observed_at < v_now_utc - interval '24 hours' THEN
    RAISE EXCEPTION 'observed_at is outside the accepted contribution window'
      USING ERRCODE = '22023';
  END IF;
  IF (p_operation = 'correction') <> (p_corrects_observation_id IS NOT NULL) THEN
    RAISE EXCEPTION 'correction operation and corrected observation must appear together'
      USING ERRCODE = '22023';
  END IF;

  IF p_corrects_observation_id IS NOT NULL THEN
    SELECT observation.* INTO v_original
    FROM public.observations observation
    WHERE observation.id = p_corrects_observation_id
      AND observation.admission_id IS NOT NULL;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'corrected observation is not an admitted contribution'
        USING ERRCODE = '22023';
    END IF;

    SELECT request.subject_digest INTO v_original_subject
    FROM public.contribution_requests request
    WHERE request.id = v_original.admission_id;

    IF v_original_subject IS DISTINCT FROM p_subject_digest
       OR v_original.item_variant_id <> p_item_variant_id
       OR v_original.unit_id <> p_unit_id
       OR v_original.place_id <> p_place_id THEN
      RAISE EXCEPTION 'correction must retain its subject and offer key'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  -- Lock dimensions in one global order. No counter moves until every
  -- applicable fixed window is known to have capacity.
  PERFORM pg_advisory_xact_lock(
    hashtextextended(p_operation::text || ':subject:' || p_subject_digest, 19019)
  );
  PERFORM pg_advisory_xact_lock(
    hashtextextended(p_operation::text || ':network:' || p_network_digest, 19019)
  );

  v_subject_15_start := date_bin(
    interval '15 minutes',
    v_now,
    timestamptz '1970-01-01 00:00:00+00'
  );
  v_day_start := date_trunc('day', v_now AT TIME ZONE 'UTC') AT TIME ZONE 'UTC';

  SELECT coalesce(max(bucket.used_count), 0) INTO v_subject_15_count
  FROM public.contribution_rate_buckets bucket
  WHERE bucket.operation = p_operation
    AND bucket.dimension = 'subject'
    AND bucket.key_digest = p_subject_digest
    AND bucket.window_started_at = v_subject_15_start
    AND bucket.window_seconds = 900;

  SELECT coalesce(max(bucket.used_count), 0) INTO v_subject_day_count
  FROM public.contribution_rate_buckets bucket
  WHERE bucket.operation = p_operation
    AND bucket.dimension = 'subject'
    AND bucket.key_digest = p_subject_digest
    AND bucket.window_started_at = v_day_start
    AND bucket.window_seconds = 86400;

  SELECT coalesce(max(bucket.used_count), 0) INTO v_network_15_count
  FROM public.contribution_rate_buckets bucket
  WHERE bucket.operation = p_operation
    AND bucket.dimension = 'network'
    AND bucket.key_digest = p_network_digest
    AND bucket.window_started_at = v_subject_15_start
    AND bucket.window_seconds = 900;

  SELECT coalesce(max(bucket.used_count), 0) INTO v_network_day_count
  FROM public.contribution_rate_buckets bucket
  WHERE bucket.operation = p_operation
    AND bucket.dimension = 'network'
    AND bucket.key_digest = p_network_digest
    AND bucket.window_started_at = v_day_start
    AND bucket.window_seconds = 86400;

  IF v_subject_15_count >= v_control.subject_limit_15m THEN
    v_retry := greatest(
      v_retry,
      ceil(extract(epoch FROM v_subject_15_start + interval '15 minutes' - v_now))::integer
    );
  END IF;
  IF v_subject_day_count >= v_control.subject_limit_day THEN
    v_retry := greatest(
      v_retry,
      ceil(extract(epoch FROM v_day_start + interval '1 day' - v_now))::integer
    );
  END IF;
  IF v_network_15_count >= v_control.network_limit_15m THEN
    v_retry := greatest(
      v_retry,
      ceil(extract(epoch FROM v_subject_15_start + interval '15 minutes' - v_now))::integer
    );
  END IF;
  IF v_network_day_count >= v_control.network_limit_day THEN
    v_retry := greatest(
      v_retry,
      ceil(extract(epoch FROM v_day_start + interval '1 day' - v_now))::integer
    );
  END IF;

  IF v_retry > 0 THEN
    INSERT INTO public.contribution_audit_events (
      request_id,
      action,
      actor_account_id,
      subject_digest,
      reason_code,
      details
    )
    VALUES (
      v_attempt_id,
      'rate_denied',
      p_actor,
      p_subject_digest,
      'rate_limit',
      jsonb_build_object(
        'operation', p_operation::text,
        'retry_after_seconds', v_retry
      )
    );

    RETURN QUERY SELECT
      v_attempt_id,
      NULL::uuid,
      'rate_limited'::text,
      false,
      v_retry;
    RETURN;
  END IF;

  INSERT INTO public.contribution_rate_buckets (
    operation, dimension, key_digest, window_started_at,
    window_seconds, used_count, expires_at, updated_at
  )
  VALUES
    (p_operation, 'subject', p_subject_digest, v_subject_15_start, 900, 1,
      v_subject_15_start + interval '15 minutes', v_now),
    (p_operation, 'subject', p_subject_digest, v_day_start, 86400, 1,
      v_day_start + interval '1 day', v_now),
    (p_operation, 'network', p_network_digest, v_subject_15_start, 900, 1,
      v_subject_15_start + interval '15 minutes', v_now),
    (p_operation, 'network', p_network_digest, v_day_start, 86400, 1,
      v_day_start + interval '1 day', v_now)
  ON CONFLICT (
    operation, dimension, key_digest, window_started_at, window_seconds
  )
  DO UPDATE SET
    used_count = public.contribution_rate_buckets.used_count + 1,
    updated_at = EXCLUDED.updated_at;

  INSERT INTO public.contribution_audit_events (
    request_id,
    action,
    actor_account_id,
    subject_digest,
    reason_code,
    details
  )
  VALUES (
    v_attempt_id,
    'rate_allowed',
    p_actor,
    p_subject_digest,
    'within_limit',
    jsonb_build_object('operation', p_operation::text)
  );

  IF p_actor IS NULL THEN
    PERFORM pg_advisory_xact_lock(hashtextextended('anonymous-contributor-source', 19019));
    SELECT source.id INTO v_source_id
    FROM public.sources source
    WHERE source.source_type = 'Contributor'
      AND source.user_id IS NULL
    ORDER BY source.created_at, source.id
    LIMIT 1;

    IF v_source_id IS NULL THEN
      INSERT INTO public.sources (source_type, user_id, reliability_score_internal)
      VALUES ('Contributor', NULL, 70)
      RETURNING id INTO v_source_id;
    END IF;
  ELSE
    PERFORM pg_advisory_xact_lock(hashtextextended(p_actor::text, 19019));
    SELECT source.id INTO v_source_id
    FROM public.sources source
    WHERE source.user_id = p_actor
    ORDER BY source.created_at, source.id
    LIMIT 1;

    IF v_source_id IS NULL THEN
      INSERT INTO public.sources (source_type, user_id, reliability_score_internal)
      VALUES ('Contributor', p_actor, 70)
      RETURNING id INTO v_source_id;
    END IF;
  END IF;

  v_collection_method := CASE
    WHEN p_operation = 'visit_confirmation' THEN 'visit_confirmation'
    ELSE 'app_entry'
  END;

  INSERT INTO public.contribution_requests (
    id,
    operation,
    idempotency_key,
    subject_digest,
    payload_digest,
    source_id,
    observation_id,
    result_code,
    created_at,
    completed_at
  )
  VALUES (
    v_attempt_id,
    p_operation,
    p_idempotency_key,
    p_subject_digest,
    p_payload_digest,
    v_source_id,
    v_observation_id,
    'pending_review',
    v_now,
    v_now
  );

  INSERT INTO public.observations (
    id,
    item_variant_id,
    unit_id,
    place_id,
    availability_state,
    price_amount,
    currency,
    observed_at,
    submitted_at,
    source_id,
    collection_method,
    provenance,
    moderation_status,
    admission_id,
    corrects_observation_id,
    did_buy,
    raw_payload
  )
  VALUES (
    v_observation_id,
    p_item_variant_id,
    p_unit_id,
    p_place_id,
    p_availability_state,
    p_price_amount,
    'NGN',
    p_observed_at,
    v_now_utc,
    v_source_id,
    v_collection_method,
    'observed',
    'pending',
    v_attempt_id,
    p_corrects_observation_id,
    p_did_buy,
    jsonb_build_object('kind', p_operation::text)
  );

  INSERT INTO public.contribution_audit_events (
    request_id,
    action,
    actor_account_id,
    subject_digest,
    observation_id,
    reason_code,
    details
  )
  VALUES (
    v_attempt_id,
    'admission',
    p_actor,
    p_subject_digest,
    v_observation_id,
    'pending_review',
    jsonb_build_object('operation', p_operation::text)
  );

  RETURN QUERY SELECT
    v_attempt_id,
    v_observation_id,
    'pending_review'::text,
    false,
    NULL::integer;
END;
$$;

CREATE OR REPLACE FUNCTION public.contribution_moderate(
  p_actor uuid,
  p_request_id uuid,
  p_payload_digest text,
  p_observation_id uuid,
  p_decision public.contribution_decision,
  p_reason_code text,
  p_prior_decision_id uuid DEFAULT NULL
)
RETURNS TABLE (
  decision_id uuid,
  projection_state public.contribution_projection_state,
  replayed boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  v_existing public.contribution_moderation_decisions%ROWTYPE;
  v_observation public.observations%ROWTYPE;
  v_active_decision_id uuid;
  v_active_actor uuid;
  v_created_id uuid := gen_random_uuid();
  v_projection_state public.contribution_projection_state;
  v_action public.contribution_audit_action;
BEGIN
  IF p_request_id IS NULL OR p_observation_id IS NULL OR p_decision IS NULL THEN
    RAISE EXCEPTION 'moderation request, observation and decision are required'
      USING ERRCODE = '22023';
  END IF;
  PERFORM public.contribution_assert_digest('moderation payload digest', p_payload_digest);
  IF p_reason_code IS NULL OR p_reason_code !~ '^[a-z0-9_]{2,64}$' THEN
    RAISE EXCEPTION 'moderation reason code is invalid'
      USING ERRCODE = '22023';
  END IF;

  PERFORM public.contribution_assert_moderator(p_actor);
  PERFORM pg_advisory_xact_lock(hashtextextended(p_request_id::text, 19019));

  SELECT decision.* INTO v_existing
  FROM public.contribution_moderation_decisions decision
  WHERE decision.request_id = p_request_id;

  IF FOUND THEN
    IF v_existing.payload_digest <> p_payload_digest THEN
      RAISE EXCEPTION 'moderation idempotency key was reused with another payload'
        USING ERRCODE = '23505';
    END IF;

    SELECT projection.state INTO v_projection_state
    FROM public.observations observation
    LEFT JOIN public.contribution_projections projection
      ON projection.item_variant_id = observation.item_variant_id
     AND projection.unit_id = observation.unit_id
     AND projection.place_id = observation.place_id
    WHERE observation.id = v_existing.observation_id;

    RETURN QUERY SELECT v_existing.id, v_projection_state, true;
    RETURN;
  END IF;

  -- Different idempotency keys deciding the same observation must serialize.
  PERFORM pg_advisory_xact_lock(
    hashtextextended('moderation:' || p_observation_id::text, 19019)
  );

  SELECT observation.* INTO v_observation
  FROM public.observations observation
  WHERE observation.id = p_observation_id
    AND observation.admission_id IS NOT NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'moderation target is not an admitted observation'
      USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.sources source
    WHERE source.id = v_observation.source_id
      AND source.user_id = p_actor
  ) THEN
    RAISE EXCEPTION 'moderators cannot decide their own contribution'
      USING ERRCODE = '42501';
  END IF;

  v_active_decision_id := public.contribution_effective_decision_id(p_observation_id);

  IF p_decision IN ('approve', 'reject') THEN
    IF p_prior_decision_id IS NOT NULL OR v_active_decision_id IS NOT NULL THEN
      RAISE EXCEPTION 'observation already has an effective moderation decision'
        USING ERRCODE = '23514';
    END IF;
  ELSE
    IF p_prior_decision_id IS NULL
       OR p_prior_decision_id IS DISTINCT FROM v_active_decision_id THEN
      RAISE EXCEPTION 'reversal must name the effective decision'
        USING ERRCODE = '23514';
    END IF;

    SELECT decision.actor_account_id INTO v_active_actor
    FROM public.contribution_moderation_decisions decision
    WHERE decision.id = p_prior_decision_id
      AND decision.observation_id = p_observation_id;

    IF v_active_actor IS NULL OR v_active_actor = p_actor THEN
      RAISE EXCEPTION 'reversal requires a different active moderator'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  INSERT INTO public.contribution_moderation_decisions (
    id,
    observation_id,
    decision,
    actor_account_id,
    prior_decision_id,
    request_id,
    payload_digest,
    reason_code
  )
  VALUES (
    v_created_id,
    p_observation_id,
    p_decision,
    p_actor,
    p_prior_decision_id,
    p_request_id,
    p_payload_digest,
    p_reason_code
  );

  v_action := CASE p_decision
    WHEN 'approve' THEN 'moderation_approved'
    WHEN 'reject' THEN 'moderation_rejected'
    ELSE 'moderation_reversed'
  END;

  INSERT INTO public.contribution_audit_events (
    request_id,
    action,
    actor_account_id,
    observation_id,
    decision_id,
    reason_code,
    details
  )
  VALUES (
    p_request_id,
    v_action,
    p_actor,
    p_observation_id,
    v_created_id,
    p_reason_code,
    CASE
      WHEN p_prior_decision_id IS NULL THEN '{}'::jsonb
      ELSE jsonb_build_object('prior_decision_id', p_prior_decision_id)
    END
  );

  v_projection_state := public.contribution_recompute_projection_internal(
    v_observation.item_variant_id,
    v_observation.unit_id,
    v_observation.place_id
  );

  INSERT INTO public.contribution_audit_events (
    request_id,
    action,
    actor_account_id,
    observation_id,
    decision_id,
    reason_code,
    details
  )
  VALUES (
    p_request_id,
    'projection_updated',
    p_actor,
    p_observation_id,
    v_created_id,
    'effective_evidence_changed',
    jsonb_build_object('state', v_projection_state)
  );

  RETURN QUERY SELECT v_created_id, v_projection_state, false;
END;
$$;

CREATE OR REPLACE FUNCTION public.contribution_pending_queue(
  p_actor uuid,
  p_limit integer DEFAULT 50
)
RETURNS TABLE (
  observation_id uuid,
  item_variant_id uuid,
  unit_id uuid,
  place_id uuid,
  availability_state text,
  price_amount integer,
  observed_at timestamp,
  collection_method text,
  corrects_observation_id uuid,
  attributed boolean,
  submitted_at timestamp
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
BEGIN
  PERFORM public.contribution_assert_moderator(p_actor);
  IF p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 100 THEN
    RAISE EXCEPTION 'queue limit must be between 1 and 100'
      USING ERRCODE = '22023';
  END IF;

  RETURN QUERY
  SELECT
    observation.id,
    observation.item_variant_id,
    observation.unit_id,
    observation.place_id,
    observation.availability_state,
    observation.price_amount,
    observation.observed_at,
    observation.collection_method,
    observation.corrects_observation_id,
    source.user_id IS NOT NULL,
    observation.submitted_at
  FROM public.observations observation
  JOIN public.sources source ON source.id = observation.source_id
  WHERE observation.admission_id IS NOT NULL
    AND public.contribution_effective_decision_id(observation.id) IS NULL
  ORDER BY observation.submitted_at, observation.id
  LIMIT p_limit;
END;
$$;

CREATE OR REPLACE FUNCTION public.contribution_audit_for_observation(
  p_actor uuid,
  p_observation_id uuid,
  p_limit integer DEFAULT 100
)
RETURNS TABLE (
  request_id uuid,
  action public.contribution_audit_action,
  actor_account_id uuid,
  decision_id uuid,
  reason_code text,
  details jsonb,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
BEGIN
  PERFORM public.contribution_assert_moderator(p_actor);
  IF p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 200 THEN
    RAISE EXCEPTION 'audit limit must be between 1 and 200'
      USING ERRCODE = '22023';
  END IF;

  RETURN QUERY
  SELECT
    audit.request_id,
    audit.action,
    audit.actor_account_id,
    audit.decision_id,
    audit.reason_code,
    audit.details,
    audit.created_at
  FROM public.contribution_audit_events audit
  WHERE audit.observation_id = p_observation_id
  ORDER BY audit.created_at, audit.id
  LIMIT p_limit;
END;
$$;

-- Safe read model for the later disjoint Server Action phase. Pending,
-- rejected and expired evidence never crosses this boundary, and callers
-- receive no contributor, moderator, digest or internal-risk fields.
CREATE OR REPLACE FUNCTION public.contribution_public_projections(
  p_item_variant_id uuid DEFAULT NULL,
  p_place_id uuid DEFAULT NULL
)
RETURNS TABLE (
  item_variant_id uuid,
  unit_id uuid,
  place_id uuid,
  state public.contribution_projection_state,
  price_kind text,
  price_min integer,
  price_max integer,
  currency text,
  last_observed_at timestamp,
  expires_at timestamp,
  supporting_observation_count integer,
  available_source_count integer,
  unavailable_source_count integer,
  policy_version text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
  SELECT
    projection.item_variant_id,
    projection.unit_id,
    projection.place_id,
    projection.state,
    projection.price_kind::text,
    projection.price_min,
    projection.price_max,
    projection.currency::text,
    projection.last_observed_at,
    projection.expires_at,
    projection.supporting_observation_count,
    projection.available_source_count,
    projection.unavailable_source_count,
    projection.policy_version::text
  FROM public.contribution_projections projection
  WHERE projection.expires_at > statement_timestamp() AT TIME ZONE 'UTC'
    AND (
      p_item_variant_id IS NULL
      OR projection.item_variant_id = p_item_variant_id
    )
    AND (p_place_id IS NULL OR projection.place_id = p_place_id)
  ORDER BY
    projection.last_observed_at DESC,
    projection.item_variant_id,
    projection.unit_id,
    projection.place_id;
$$;

CREATE OR REPLACE FUNCTION public.contribution_set_moderator_assignment(
  p_request_id uuid,
  p_account_id uuid,
  p_status public.contribution_assignment_status,
  p_effective_at timestamptz,
  p_expires_at timestamptz,
  p_issued_by_account_id uuid,
  p_reviewed_by_account_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
BEGIN
  IF p_request_id IS NULL OR p_account_id IS NULL OR p_status IS NULL
     OR p_effective_at IS NULL OR p_issued_by_account_id IS NULL
     OR p_reviewed_by_account_id IS NULL THEN
    RAISE EXCEPTION 'complete assignment evidence is required'
      USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.contribution_moderator_assignments (
    account_id,
    status,
    issued_by_account_id,
    reviewed_by_account_id,
    effective_at,
    expires_at,
    updated_at
  )
  VALUES (
    p_account_id,
    p_status,
    p_issued_by_account_id,
    p_reviewed_by_account_id,
    p_effective_at,
    p_expires_at,
    clock_timestamp()
  )
  ON CONFLICT (account_id)
  DO UPDATE SET
    status = EXCLUDED.status,
    issued_by_account_id = EXCLUDED.issued_by_account_id,
    reviewed_by_account_id = EXCLUDED.reviewed_by_account_id,
    effective_at = EXCLUDED.effective_at,
    expires_at = EXCLUDED.expires_at,
    updated_at = EXCLUDED.updated_at;

  INSERT INTO public.contribution_audit_events (
    request_id,
    action,
    actor_account_id,
    reason_code,
    details
  )
  VALUES (
    p_request_id,
    'assignment_updated',
    p_issued_by_account_id,
    'assignment_lifecycle',
    jsonb_build_object(
      'account_id', p_account_id,
      'status', p_status::text,
      'reviewed_by_account_id', p_reviewed_by_account_id
    )
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.contribution_set_control(
  p_request_id uuid,
  p_actor uuid,
  p_reporting_allowed boolean,
  p_moderation_allowed boolean,
  p_subject_limit_15m integer,
  p_subject_limit_day integer,
  p_network_limit_15m integer,
  p_network_limit_day integer,
  p_unavailable_min_sources integer,
  p_projection_window_hours integer,
  p_policy_version text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
BEGIN
  IF p_request_id IS NULL OR p_actor IS NULL THEN
    RAISE EXCEPTION 'control update requires request and actor'
      USING ERRCODE = '22023';
  END IF;

  UPDATE public.contribution_control
  SET
    reporting_allowed = p_reporting_allowed,
    moderation_allowed = p_moderation_allowed,
    subject_limit_15m = p_subject_limit_15m,
    subject_limit_day = p_subject_limit_day,
    network_limit_15m = p_network_limit_15m,
    network_limit_day = p_network_limit_day,
    unavailable_min_sources = p_unavailable_min_sources,
    projection_window_hours = p_projection_window_hours,
    policy_version = p_policy_version,
    updated_at = clock_timestamp()
  WHERE id = 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'contribution control row is missing'
      USING ERRCODE = '55000';
  END IF;

  INSERT INTO public.contribution_audit_events (
    request_id,
    action,
    actor_account_id,
    reason_code,
    details
  )
  VALUES (
    p_request_id,
    'control_updated',
    p_actor,
    'control_policy',
    jsonb_build_object(
      'reporting_allowed', p_reporting_allowed,
      'moderation_allowed', p_moderation_allowed,
      'policy_version', p_policy_version
    )
  );
END;
$$;
--> statement-breakpoint
-- Least-privilege ADR-019 boundary. Application identities receive EXECUTE on
-- narrowly scoped SECURITY DEFINER services, never direct contribution-table
-- privileges. The later Server Action owns session and digest derivation.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'wetindey_contribution_owner') THEN
    CREATE ROLE wetindey_contribution_owner NOLOGIN NOBYPASSRLS;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'wetindey_contribution_runtime') THEN
    CREATE ROLE wetindey_contribution_runtime NOLOGIN NOBYPASSRLS;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'wetindey_contribution_moderator') THEN
    CREATE ROLE wetindey_contribution_moderator NOLOGIN NOBYPASSRLS;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'wetindey_contribution_control') THEN
    CREATE ROLE wetindey_contribution_control NOLOGIN NOBYPASSRLS;
  END IF;
END;
$$;

ALTER ROLE wetindey_contribution_owner NOLOGIN NOBYPASSRLS;
ALTER ROLE wetindey_contribution_runtime NOLOGIN NOBYPASSRLS;
ALTER ROLE wetindey_contribution_moderator NOLOGIN NOBYPASSRLS;
ALTER ROLE wetindey_contribution_control NOLOGIN NOBYPASSRLS;

-- PostgreSQL 17 requires SET TRUE for a non-superuser migration principal to
-- transfer ownership. Both this membership and schema CREATE are removed and
-- independently asserted absent before the migration can commit.
GRANT wetindey_contribution_owner TO SESSION_USER WITH INHERIT FALSE;
GRANT wetindey_contribution_owner TO SESSION_USER WITH SET TRUE;
GRANT CREATE ON SCHEMA public TO wetindey_contribution_owner;

ALTER TABLE public.contribution_control ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contribution_control FORCE ROW LEVEL SECURITY;
ALTER TABLE public.contribution_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contribution_requests FORCE ROW LEVEL SECURITY;
ALTER TABLE public.contribution_rate_buckets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contribution_rate_buckets FORCE ROW LEVEL SECURITY;
ALTER TABLE public.contribution_moderator_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contribution_moderator_assignments FORCE ROW LEVEL SECURITY;
ALTER TABLE public.contribution_moderation_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contribution_moderation_decisions FORCE ROW LEVEL SECURITY;
ALTER TABLE public.contribution_audit_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contribution_audit_events FORCE ROW LEVEL SECURITY;
ALTER TABLE public.contribution_projections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contribution_projections FORCE ROW LEVEL SECURITY;

CREATE POLICY contribution_control_owner_policy ON public.contribution_control
  FOR ALL TO wetindey_contribution_owner USING (true) WITH CHECK (true);
CREATE POLICY contribution_requests_owner_policy ON public.contribution_requests
  FOR ALL TO wetindey_contribution_owner USING (true) WITH CHECK (true);
CREATE POLICY contribution_rate_buckets_owner_policy ON public.contribution_rate_buckets
  FOR ALL TO wetindey_contribution_owner USING (true) WITH CHECK (true);
CREATE POLICY contribution_assignments_owner_policy
  ON public.contribution_moderator_assignments
  FOR ALL TO wetindey_contribution_owner USING (true) WITH CHECK (true);
CREATE POLICY contribution_decisions_owner_policy
  ON public.contribution_moderation_decisions
  FOR ALL TO wetindey_contribution_owner USING (true) WITH CHECK (true);
CREATE POLICY contribution_audit_owner_policy ON public.contribution_audit_events
  FOR ALL TO wetindey_contribution_owner USING (true) WITH CHECK (true);
CREATE POLICY contribution_projections_owner_policy ON public.contribution_projections
  FOR ALL TO wetindey_contribution_owner USING (true) WITH CHECK (true);

REVOKE ALL ON TABLE
  public.contribution_control,
  public.contribution_requests,
  public.contribution_rate_buckets,
  public.contribution_moderator_assignments,
  public.contribution_moderation_decisions,
  public.contribution_audit_events,
  public.contribution_projections
FROM PUBLIC, wetindey_contribution_runtime, wetindey_contribution_moderator,
  wetindey_contribution_control;

REVOKE ALL ON FUNCTION public.contribution_assert_digest(text, text)
  FROM PUBLIC, wetindey_contribution_runtime, wetindey_contribution_moderator,
    wetindey_contribution_control;
REVOKE ALL ON FUNCTION public.contribution_forbid_append_only_mutation()
  FROM PUBLIC, wetindey_contribution_runtime, wetindey_contribution_moderator,
    wetindey_contribution_control;
REVOKE ALL ON FUNCTION public.contribution_protect_admitted_observation()
  FROM PUBLIC, wetindey_contribution_runtime, wetindey_contribution_moderator,
    wetindey_contribution_control;
REVOKE ALL ON FUNCTION public.contribution_assert_moderator(uuid)
  FROM PUBLIC, wetindey_contribution_runtime, wetindey_contribution_moderator,
    wetindey_contribution_control;
REVOKE ALL ON FUNCTION public.contribution_effective_decision_id(uuid)
  FROM PUBLIC, wetindey_contribution_runtime, wetindey_contribution_moderator,
    wetindey_contribution_control;
REVOKE ALL ON FUNCTION public.contribution_recompute_projection_internal(uuid, uuid, uuid)
  FROM PUBLIC, wetindey_contribution_runtime, wetindey_contribution_moderator,
    wetindey_contribution_control;

REVOKE ALL ON FUNCTION public.contribution_admit(
  public.contribution_operation, uuid, text, text, text, uuid, uuid, uuid,
  uuid, text, integer, timestamp, boolean, uuid
) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.contribution_moderate(
  uuid, uuid, text, uuid, public.contribution_decision, text, uuid
) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.contribution_pending_queue(uuid, integer)
  FROM PUBLIC;
REVOKE ALL ON FUNCTION public.contribution_audit_for_observation(uuid, uuid, integer)
  FROM PUBLIC;
REVOKE ALL ON FUNCTION public.contribution_public_projections(uuid, uuid)
  FROM PUBLIC;
REVOKE ALL ON FUNCTION public.contribution_set_moderator_assignment(
  uuid, uuid, public.contribution_assignment_status, timestamptz, timestamptz,
  uuid, uuid
) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.contribution_set_control(
  uuid, uuid, boolean, boolean, integer, integer, integer, integer, integer,
  integer, text
) FROM PUBLIC;

REVOKE USAGE ON TYPE
  public.contribution_operation,
  public.contribution_rate_dimension,
  public.contribution_decision,
  public.contribution_assignment_status,
  public.contribution_projection_state,
  public.contribution_audit_action
FROM PUBLIC;

GRANT USAGE ON SCHEMA public
  TO wetindey_contribution_runtime, wetindey_contribution_moderator,
    wetindey_contribution_control;
GRANT USAGE ON TYPE public.contribution_operation
  TO wetindey_contribution_runtime;
GRANT USAGE ON TYPE
  public.contribution_decision,
  public.contribution_projection_state,
  public.contribution_audit_action
TO wetindey_contribution_moderator;
GRANT USAGE ON TYPE public.contribution_assignment_status
  TO wetindey_contribution_control;

GRANT EXECUTE ON FUNCTION public.contribution_admit(
  public.contribution_operation, uuid, text, text, text, uuid, uuid, uuid,
  uuid, text, integer, timestamp, boolean, uuid
) TO wetindey_contribution_runtime;
GRANT EXECUTE ON FUNCTION public.contribution_public_projections(uuid, uuid)
  TO wetindey_contribution_runtime;
GRANT EXECUTE ON FUNCTION public.contribution_moderate(
  uuid, uuid, text, uuid, public.contribution_decision, text, uuid
) TO wetindey_contribution_moderator;
GRANT EXECUTE ON FUNCTION public.contribution_pending_queue(uuid, integer)
  TO wetindey_contribution_moderator;
GRANT EXECUTE ON FUNCTION public.contribution_audit_for_observation(uuid, uuid, integer)
  TO wetindey_contribution_moderator;
GRANT EXECUTE ON FUNCTION public.contribution_set_moderator_assignment(
  uuid, uuid, public.contribution_assignment_status, timestamptz, timestamptz,
  uuid, uuid
) TO wetindey_contribution_control;
GRANT EXECUTE ON FUNCTION public.contribution_set_control(
  uuid, uuid, boolean, boolean, integer, integer, integer, integer, integer,
  integer, text
) TO wetindey_contribution_control;

-- The owner services resolve or create sources and append observations. They
-- cannot mutate legacy evidence or any catalogue row.
GRANT SELECT, INSERT ON TABLE public.sources, public.observations
  TO wetindey_contribution_owner;

ALTER TABLE public.contribution_control OWNER TO wetindey_contribution_owner;
ALTER TABLE public.contribution_requests OWNER TO wetindey_contribution_owner;
ALTER TABLE public.contribution_rate_buckets OWNER TO wetindey_contribution_owner;
ALTER TABLE public.contribution_moderator_assignments OWNER TO wetindey_contribution_owner;
ALTER TABLE public.contribution_moderation_decisions OWNER TO wetindey_contribution_owner;
ALTER TABLE public.contribution_audit_events OWNER TO wetindey_contribution_owner;
ALTER TABLE public.contribution_projections OWNER TO wetindey_contribution_owner;

ALTER TYPE public.contribution_operation OWNER TO wetindey_contribution_owner;
ALTER TYPE public.contribution_rate_dimension OWNER TO wetindey_contribution_owner;
ALTER TYPE public.contribution_decision OWNER TO wetindey_contribution_owner;
ALTER TYPE public.contribution_assignment_status OWNER TO wetindey_contribution_owner;
ALTER TYPE public.contribution_projection_state OWNER TO wetindey_contribution_owner;
ALTER TYPE public.contribution_audit_action OWNER TO wetindey_contribution_owner;

ALTER FUNCTION public.contribution_assert_digest(text, text)
  OWNER TO wetindey_contribution_owner;
ALTER FUNCTION public.contribution_forbid_append_only_mutation()
  OWNER TO wetindey_contribution_owner;
ALTER FUNCTION public.contribution_protect_admitted_observation()
  OWNER TO wetindey_contribution_owner;
ALTER FUNCTION public.contribution_assert_moderator(uuid)
  OWNER TO wetindey_contribution_owner;
ALTER FUNCTION public.contribution_effective_decision_id(uuid)
  OWNER TO wetindey_contribution_owner;
ALTER FUNCTION public.contribution_recompute_projection_internal(uuid, uuid, uuid)
  OWNER TO wetindey_contribution_owner;
ALTER FUNCTION public.contribution_admit(
  public.contribution_operation, uuid, text, text, text, uuid, uuid, uuid,
  uuid, text, integer, timestamp, boolean, uuid
) OWNER TO wetindey_contribution_owner;
ALTER FUNCTION public.contribution_moderate(
  uuid, uuid, text, uuid, public.contribution_decision, text, uuid
) OWNER TO wetindey_contribution_owner;
ALTER FUNCTION public.contribution_pending_queue(uuid, integer)
  OWNER TO wetindey_contribution_owner;
ALTER FUNCTION public.contribution_audit_for_observation(uuid, uuid, integer)
  OWNER TO wetindey_contribution_owner;
ALTER FUNCTION public.contribution_public_projections(uuid, uuid)
  OWNER TO wetindey_contribution_owner;
ALTER FUNCTION public.contribution_set_moderator_assignment(
  uuid, uuid, public.contribution_assignment_status, timestamptz, timestamptz,
  uuid, uuid
) OWNER TO wetindey_contribution_owner;
ALTER FUNCTION public.contribution_set_control(
  uuid, uuid, boolean, boolean, integer, integer, integer, integer, integer,
  integer, text
) OWNER TO wetindey_contribution_owner;

REVOKE CREATE ON SCHEMA public FROM wetindey_contribution_owner;
REVOKE wetindey_contribution_owner FROM SESSION_USER
  GRANTED BY SESSION_USER;

DO $$
BEGIN
  IF pg_has_role(session_user, 'wetindey_contribution_owner', 'SET') THEN
    RAISE EXCEPTION 'migration principal retains a SET path to the contribution owner'
      USING ERRCODE = '42501';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_auth_members membership
    JOIN pg_roles granted_role ON granted_role.oid = membership.roleid
    JOIN pg_roles member_role ON member_role.oid = membership.member
    WHERE granted_role.rolname = 'wetindey_contribution_owner'
      AND member_role.rolname = session_user
      AND (membership.set_option OR membership.inherit_option)
  ) THEN
    RAISE EXCEPTION 'migration principal retains privileged contribution owner membership'
      USING ERRCODE = '42501';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_auth_members membership
    JOIN pg_roles granted_role ON granted_role.oid = membership.roleid
    JOIN pg_roles member_role ON member_role.oid = membership.member
    JOIN pg_roles grantor_role ON grantor_role.oid = membership.grantor
    WHERE granted_role.rolname = 'wetindey_contribution_owner'
      AND member_role.rolname = session_user
      AND grantor_role.rolname = session_user
  ) THEN
    RAISE EXCEPTION 'migration principal retains its transient contribution owner grant'
      USING ERRCODE = '42501';
  END IF;

  IF has_schema_privilege(
    'wetindey_contribution_owner',
    'public',
    'CREATE'
  ) THEN
    RAISE EXCEPTION 'contribution owner retains CREATE on schema public'
      USING ERRCODE = '42501';
  END IF;
END;
$$;
