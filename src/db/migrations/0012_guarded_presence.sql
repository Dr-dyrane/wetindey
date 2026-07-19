-- Destructive containment comes first. The application read path is already
-- fail closed; remove the unsafe durable profile state without copying it.
ALTER TABLE "user_profiles" DROP COLUMN "location_sharing";--> statement-breakpoint
ALTER TABLE "user_profiles" DROP COLUMN "latitude";--> statement-breakpoint
ALTER TABLE "user_profiles" DROP COLUMN "longitude";--> statement-breakpoint
CREATE TYPE "public"."presence_rate_dimension" AS ENUM('account', 'session', 'device', 'network');--> statement-breakpoint
CREATE TYPE "public"."presence_rate_operation" AS ENUM('activation', 'snapshot', 'disclosure', 'wave', 'report');--> statement-breakpoint
CREATE TYPE "public"."presence_report_kind" AS ENUM('safety_concern', 'unwanted_interaction', 'suspected_location_misuse', 'other');--> statement-breakpoint
CREATE TYPE "public"."presence_report_resolution" AS ENUM('open', 'closed');--> statement-breakpoint
CREATE TABLE "presence_blocks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"blocker_account_id" uuid NOT NULL,
	"blocked_account_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "presence_blocks_not_self_check" CHECK ("presence_blocks"."blocker_account_id" <> "presence_blocks"."blocked_account_id")
);
--> statement-breakpoint
CREATE TABLE "presence_control" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"operations_allowed" boolean DEFAULT false NOT NULL,
	"generation" bigint DEFAULT 1 NOT NULL,
	"allowlist_account_a" uuid,
	"allowlist_account_b" uuid,
	"pilot_boundary" "geography",
	"wave_retention_seconds" integer,
	"report_retention_seconds" integer,
	"safety_responder_account_id" uuid,
	"safety_backup_account_id" uuid,
	"activation_limit_15m" integer DEFAULT 3 NOT NULL,
	"activation_limit_day" integer DEFAULT 8 NOT NULL,
	"snapshot_limit_minute" integer DEFAULT 6 NOT NULL,
	"snapshot_limit_15m" integer DEFAULT 60 NOT NULL,
	"disclosure_limit_15m" integer DEFAULT 50 NOT NULL,
	"wave_limit_minute" integer DEFAULT 2 NOT NULL,
	"wave_limit_15m" integer DEFAULT 10 NOT NULL,
	"wave_limit_day" integer DEFAULT 30 NOT NULL,
	"report_limit_15m" integer DEFAULT 3 NOT NULL,
	"report_limit_day" integer DEFAULT 10 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "presence_control_singleton_check" CHECK ("presence_control"."id" = 1),
	CONSTRAINT "presence_control_generation_check" CHECK ("presence_control"."generation" > 0),
	CONSTRAINT "presence_control_boundary_check" CHECK ("presence_control"."pilot_boundary" is null
        or (GeometryType("presence_control"."pilot_boundary"::geometry) = 'POLYGON'
          and ST_SRID("presence_control"."pilot_boundary"::geometry) = 4326
          and ST_IsValid("presence_control"."pilot_boundary"::geometry))),
	CONSTRAINT "presence_control_allowlist_check" CHECK (("presence_control"."allowlist_account_a" is null and "presence_control"."allowlist_account_b" is null)
        or ("presence_control"."allowlist_account_a" is not null and "presence_control"."allowlist_account_b" is not null
          and "presence_control"."allowlist_account_a" <> "presence_control"."allowlist_account_b")),
	CONSTRAINT "presence_control_retention_check" CHECK (("presence_control"."wave_retention_seconds" is null or "presence_control"."wave_retention_seconds" between 1 and 900)
        and ("presence_control"."report_retention_seconds" is null or "presence_control"."report_retention_seconds" between 86400 and 31536000)),
	CONSTRAINT "presence_control_responder_check" CHECK (("presence_control"."safety_responder_account_id" is null and "presence_control"."safety_backup_account_id" is null)
        or ("presence_control"."safety_responder_account_id" is not null and "presence_control"."safety_backup_account_id" is not null
          and "presence_control"."safety_responder_account_id" <> "presence_control"."safety_backup_account_id")),
	CONSTRAINT "presence_control_budgets_check" CHECK ("presence_control"."activation_limit_15m" > 0 and "presence_control"."activation_limit_day" >= "presence_control"."activation_limit_15m"
        and "presence_control"."snapshot_limit_minute" > 0 and "presence_control"."snapshot_limit_15m" >= "presence_control"."snapshot_limit_minute"
        and "presence_control"."disclosure_limit_15m" between 1 and 50
        and "presence_control"."wave_limit_minute" > 0 and "presence_control"."wave_limit_15m" >= "presence_control"."wave_limit_minute"
        and "presence_control"."wave_limit_day" >= "presence_control"."wave_limit_15m"
        and "presence_control"."report_limit_15m" > 0 and "presence_control"."report_limit_day" >= "presence_control"."report_limit_15m")
);
--> statement-breakpoint
CREATE TABLE "presence_leases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"cell_x" integer NOT NULL,
	"cell_y" integer NOT NULL,
	"centroid" "geography" NOT NULL,
	"control_generation" bigint NOT NULL,
	"issued_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	CONSTRAINT "presence_leases_expiry_check" CHECK ("presence_leases"."expires_at" > "presence_leases"."issued_at"
        and "presence_leases"."expires_at" <= "presence_leases"."issued_at" + interval '15 minutes'
        and ("presence_leases"."revoked_at" is null or "presence_leases"."revoked_at" >= "presence_leases"."issued_at")),
	CONSTRAINT "presence_leases_centroid_check" CHECK (GeometryType("presence_leases"."centroid"::geometry) = 'POINT'
        and ST_SRID("presence_leases"."centroid"::geometry) = 4326)
);
--> statement-breakpoint
CREATE TABLE "presence_preferences" (
	"account_id" uuid PRIMARY KEY NOT NULL,
	"presence_opted_in" boolean DEFAULT false NOT NULL,
	"profile_consented" boolean DEFAULT false NOT NULL,
	"display_name" varchar(80),
	"avatar_url" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "presence_preferences_profile_check" CHECK (("presence_preferences"."profile_consented" and ("presence_preferences"."display_name" is not null or "presence_preferences"."avatar_url" is not null))
        or (not "presence_preferences"."profile_consented" and "presence_preferences"."display_name" is null and "presence_preferences"."avatar_url" is null)),
	CONSTRAINT "presence_preferences_avatar_check" CHECK ("presence_preferences"."avatar_url" is null or (length("presence_preferences"."avatar_url") <= 2048 and "presence_preferences"."avatar_url" ~ '^https://'))
);
--> statement-breakpoint
CREATE TABLE "presence_rate_buckets" (
	"dimension" "presence_rate_dimension" NOT NULL,
	"operation" "presence_rate_operation" NOT NULL,
	"key_digest" varchar(64) NOT NULL,
	"window_started_at" timestamp with time zone NOT NULL,
	"window_seconds" integer NOT NULL,
	"request_count" integer DEFAULT 0 NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	CONSTRAINT "presence_rate_buckets_pk" PRIMARY KEY("dimension","operation","key_digest","window_started_at","window_seconds"),
	CONSTRAINT "presence_rate_buckets_digest_check" CHECK ("presence_rate_buckets"."key_digest" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "presence_rate_buckets_window_check" CHECK ("presence_rate_buckets"."window_seconds" between 1 and 86400
        and "presence_rate_buckets"."request_count" >= 0
        and "presence_rate_buckets"."expires_at" >= "presence_rate_buckets"."window_started_at" + ("presence_rate_buckets"."window_seconds" * interval '1 second'))
);
--> statement-breakpoint
CREATE TABLE "presence_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reporter_account_id" uuid NOT NULL,
	"subject_account_id" uuid NOT NULL,
	"kind" "presence_report_kind" NOT NULL,
	"details" text,
	"resolution" "presence_report_resolution" DEFAULT 'open' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone,
	"purge_at" timestamp with time zone NOT NULL,
	CONSTRAINT "presence_reports_not_self_check" CHECK ("presence_reports"."reporter_account_id" <> "presence_reports"."subject_account_id"),
	CONSTRAINT "presence_reports_details_check" CHECK ("presence_reports"."details" is null or length("presence_reports"."details") between 1 and 1000),
	CONSTRAINT "presence_reports_resolution_check" CHECK (("presence_reports"."resolution" = 'open' and "presence_reports"."resolved_at" is null)
        or ("presence_reports"."resolution" = 'closed' and "presence_reports"."resolved_at" is not null and "presence_reports"."resolved_at" >= "presence_reports"."created_at")),
	CONSTRAINT "presence_reports_purge_check" CHECK ("presence_reports"."purge_at" > "presence_reports"."created_at")
);
--> statement-breakpoint
CREATE TABLE "presence_waves" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sender_account_id" uuid NOT NULL,
	"recipient_account_id" uuid NOT NULL,
	"sender_lease_id" uuid NOT NULL,
	"recipient_lease_id" uuid NOT NULL,
	"idempotency_digest" varchar(64) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"delivered_at" timestamp with time zone,
	CONSTRAINT "presence_waves_not_self_check" CHECK ("presence_waves"."sender_account_id" <> "presence_waves"."recipient_account_id"),
	CONSTRAINT "presence_waves_digest_check" CHECK ("presence_waves"."idempotency_digest" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "presence_waves_expiry_check" CHECK ("presence_waves"."expires_at" > "presence_waves"."created_at"
        and ("presence_waves"."delivered_at" is null or "presence_waves"."delivered_at" >= "presence_waves"."created_at"))
);
--> statement-breakpoint
ALTER TABLE "presence_waves" ADD CONSTRAINT "presence_waves_sender_lease_id_presence_leases_id_fk" FOREIGN KEY ("sender_lease_id") REFERENCES "public"."presence_leases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "presence_waves" ADD CONSTRAINT "presence_waves_recipient_lease_id_presence_leases_id_fk" FOREIGN KEY ("recipient_lease_id") REFERENCES "public"."presence_leases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "presence_blocks_pair_key" ON "presence_blocks" USING btree ("blocker_account_id","blocked_account_id");--> statement-breakpoint
CREATE INDEX "presence_blocks_reverse_idx" ON "presence_blocks" USING btree ("blocked_account_id","blocker_account_id");--> statement-breakpoint
CREATE UNIQUE INDEX "presence_leases_account_key" ON "presence_leases" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "presence_leases_centroid_gist_idx" ON "presence_leases" USING gist ("centroid");--> statement-breakpoint
CREATE INDEX "presence_leases_expiry_idx" ON "presence_leases" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "presence_rate_buckets_expiry_idx" ON "presence_rate_buckets" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "presence_reports_open_pair_idx" ON "presence_reports" USING btree ("reporter_account_id","subject_account_id","resolution");--> statement-breakpoint
CREATE INDEX "presence_reports_purge_idx" ON "presence_reports" USING btree ("purge_at");--> statement-breakpoint
CREATE UNIQUE INDEX "presence_waves_sender_idempotency_key" ON "presence_waves" USING btree ("sender_account_id","idempotency_digest");--> statement-breakpoint
CREATE INDEX "presence_waves_recipient_expiry_idx" ON "presence_waves" USING btree ("recipient_account_id","expires_at");--> statement-breakpoint
-- Canonical ADR-016 database service boundary for the disabled two-account pilot.
-- Exact device coordinates never enter these functions. The later server boundary
-- computes a fixed 500 m cell in foreground request memory and passes only cell keys.

INSERT INTO public.presence_control (id, operations_allowed)
VALUES (1, false)
ON CONFLICT (id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.presence_cleanup_internal()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
BEGIN
  DELETE FROM public.presence_leases
  WHERE revoked_at IS NOT NULL OR expires_at <= clock_timestamp();

  DELETE FROM public.presence_waves
  WHERE expires_at <= clock_timestamp();

  DELETE FROM public.presence_rate_buckets
  WHERE expires_at <= clock_timestamp();

  DELETE FROM public.presence_reports
  WHERE purge_at <= clock_timestamp();
END;
$$;

-- Maintenance-only retention entrypoint. A target-owned scheduler invokes this
-- even when the pilot has no foreground traffic; runtime callers cannot.
CREATE OR REPLACE FUNCTION public.presence_run_retention_cleanup()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
BEGIN
  PERFORM public.presence_cleanup_internal();
END;
$$;

CREATE OR REPLACE FUNCTION public.presence_assert_digest(
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

CREATE OR REPLACE FUNCTION public.presence_erasure_uuid(
  p_report_id uuid,
  p_role text
)
RETURNS uuid
LANGUAGE sql
IMMUTABLE
STRICT
SET search_path = pg_catalog
AS $$
  WITH digest AS (
    SELECT encode(
      sha256(convert_to(p_report_id::text || ':' || p_role, 'UTF8')),
      'hex'
    ) AS value
  )
  SELECT (
    substr(value, 1, 8) || '-' ||
    substr(value, 9, 4) || '-4' ||
    substr(value, 14, 3) || '-a' ||
    substr(value, 18, 3) || '-' ||
    substr(value, 21, 12)
  )::uuid
  FROM digest;
$$;

-- Account lifecycle boundary. Operational presence state is purged. Retained
-- safety reports keep only their policy-owned kind/timestamps/resolution:
-- both account keys become unlinkable per-report tombstones and free text is
-- removed. Non-account rate keys supplied by the trusted lifecycle provider
-- are purged immediately; any older unlinkable keys remain bounded by their
-- existing window expiry and the deterministic retention runner above.
CREATE OR REPLACE FUNCTION public.presence_delete_account(
  p_actor uuid,
  p_session_digest text DEFAULT NULL,
  p_device_digest text DEFAULT NULL,
  p_network_digest text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  v_control public.presence_control%ROWTYPE;
  v_control_principal boolean;
  v_account_digest text;
BEGIN
  IF p_actor IS NULL THEN
    RAISE EXCEPTION 'account deletion requires an actor'
      USING ERRCODE = '22023';
  END IF;
  IF p_session_digest IS NOT NULL THEN
    PERFORM public.presence_assert_digest('session digest', p_session_digest);
  END IF;
  IF p_device_digest IS NOT NULL THEN
    PERFORM public.presence_assert_digest('device digest', p_device_digest);
  END IF;
  IF p_network_digest IS NOT NULL THEN
    PERFORM public.presence_assert_digest('network digest', p_network_digest);
  END IF;

  SELECT * INTO STRICT v_control
  FROM public.presence_control
  WHERE id = 1
  FOR UPDATE;

  v_control_principal :=
    p_actor IN (
      v_control.allowlist_account_a,
      v_control.allowlist_account_b,
      v_control.safety_responder_account_id,
      v_control.safety_backup_account_id
    );

  IF v_control_principal THEN
    UPDATE public.presence_control
    SET
      operations_allowed = false,
      allowlist_account_a = CASE
        WHEN p_actor IN (allowlist_account_a, allowlist_account_b) THEN NULL
        ELSE allowlist_account_a
      END,
      allowlist_account_b = CASE
        WHEN p_actor IN (allowlist_account_a, allowlist_account_b) THEN NULL
        ELSE allowlist_account_b
      END,
      safety_responder_account_id = CASE
        WHEN p_actor IN (safety_responder_account_id, safety_backup_account_id) THEN NULL
        ELSE safety_responder_account_id
      END,
      safety_backup_account_id = CASE
        WHEN p_actor IN (safety_responder_account_id, safety_backup_account_id) THEN NULL
        ELSE safety_backup_account_id
      END,
      generation = generation + 1,
      updated_at = clock_timestamp()
    WHERE id = 1;

    DELETE FROM public.presence_leases;
    DELETE FROM public.presence_waves;
  ELSE
    DELETE FROM public.presence_leases
    WHERE account_id = p_actor;
  END IF;

  DELETE FROM public.presence_preferences
  WHERE account_id = p_actor;

  DELETE FROM public.presence_blocks
  WHERE blocker_account_id = p_actor OR blocked_account_id = p_actor;

  v_account_digest := encode(sha256(convert_to(p_actor::text, 'UTF8')), 'hex');
  DELETE FROM public.presence_rate_buckets
  WHERE (dimension = 'account' AND key_digest = v_account_digest)
     OR (p_session_digest IS NOT NULL
       AND dimension = 'session' AND key_digest = p_session_digest)
     OR (p_device_digest IS NOT NULL
       AND dimension = 'device' AND key_digest = p_device_digest)
     OR (p_network_digest IS NOT NULL
       AND dimension = 'network' AND key_digest = p_network_digest);

  UPDATE public.presence_reports report
  SET
    reporter_account_id = public.presence_erasure_uuid(report.id, 'deleted-reporter'),
    details = NULL
  WHERE report.reporter_account_id = p_actor;

  UPDATE public.presence_reports report
  SET
    subject_account_id = public.presence_erasure_uuid(report.id, 'deleted-subject'),
    details = NULL
  WHERE report.subject_account_id = p_actor;
END;
$$;

CREATE OR REPLACE FUNCTION public.presence_consume_bucket(
  p_dimension public.presence_rate_dimension,
  p_operation public.presence_rate_operation,
  p_key_digest text,
  p_window_seconds integer,
  p_limit integer,
  p_amount integer DEFAULT 1
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  v_window_start timestamptz;
  v_count integer;
BEGIN
  PERFORM public.presence_assert_digest('rate key', p_key_digest);
  IF p_window_seconds NOT BETWEEN 1 AND 86400 OR p_limit <= 0 OR p_amount < 0 THEN
    RAISE EXCEPTION 'invalid presence rate policy'
      USING ERRCODE = '22023';
  END IF;
  IF p_amount = 0 THEN
    RETURN;
  END IF;

  v_window_start := to_timestamp(
    floor(extract(epoch FROM clock_timestamp()) / p_window_seconds) * p_window_seconds
  );

  INSERT INTO public.presence_rate_buckets (
    dimension,
    operation,
    key_digest,
    window_started_at,
    window_seconds,
    request_count,
    expires_at
  )
  VALUES (
    p_dimension,
    p_operation,
    p_key_digest,
    v_window_start,
    p_window_seconds,
    p_amount,
    v_window_start + (p_window_seconds * interval '1 second')
  )
  ON CONFLICT (
    dimension,
    operation,
    key_digest,
    window_started_at,
    window_seconds
  )
  DO UPDATE SET request_count =
    public.presence_rate_buckets.request_count + EXCLUDED.request_count
  RETURNING request_count INTO v_count;

  IF v_count > p_limit THEN
    RAISE EXCEPTION 'presence rate limit exceeded'
      USING ERRCODE = 'P0001';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.presence_consume_budgets(
  p_actor uuid,
  p_operation public.presence_rate_operation,
  p_session_digest text,
  p_device_digest text,
  p_network_digest text,
  p_amount integer DEFAULT 1
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  v_control public.presence_control%ROWTYPE;
  v_account_digest text;
  v_short_window integer;
  v_short_limit integer;
  v_long_window integer;
  v_long_limit integer;
  v_day_window integer;
  v_day_limit integer;
BEGIN
  SELECT * INTO STRICT v_control
  FROM public.presence_control
  WHERE id = 1;

  PERFORM public.presence_assert_digest('session digest', p_session_digest);
  PERFORM public.presence_assert_digest('device digest', p_device_digest);
  PERFORM public.presence_assert_digest('network digest', p_network_digest);

  v_account_digest := encode(sha256(convert_to(p_actor::text, 'UTF8')), 'hex');

  CASE p_operation
    WHEN 'activation' THEN
      v_short_window := 900;
      v_short_limit := v_control.activation_limit_15m;
      v_long_window := 86400;
      v_long_limit := v_control.activation_limit_day;
    WHEN 'snapshot' THEN
      v_short_window := 60;
      v_short_limit := v_control.snapshot_limit_minute;
      v_long_window := 900;
      v_long_limit := v_control.snapshot_limit_15m;
    WHEN 'disclosure' THEN
      v_short_window := 900;
      v_short_limit := v_control.disclosure_limit_15m;
      v_long_window := 900;
      v_long_limit := v_control.disclosure_limit_15m;
    WHEN 'wave' THEN
      v_short_window := 60;
      v_short_limit := v_control.wave_limit_minute;
      v_long_window := 900;
      v_long_limit := v_control.wave_limit_15m;
      v_day_window := 86400;
      v_day_limit := v_control.wave_limit_day;
    WHEN 'report' THEN
      v_short_window := 900;
      v_short_limit := v_control.report_limit_15m;
      v_long_window := 86400;
      v_long_limit := v_control.report_limit_day;
    ELSE
      RAISE EXCEPTION 'unsupported presence rate operation'
        USING ERRCODE = '22023';
  END CASE;

  PERFORM public.presence_consume_bucket(
    'account', p_operation, v_account_digest, v_short_window, v_short_limit, p_amount
  );
  PERFORM public.presence_consume_bucket(
    'session', p_operation, p_session_digest, v_short_window, v_short_limit, p_amount
  );
  PERFORM public.presence_consume_bucket(
    'device', p_operation, p_device_digest, v_short_window, v_short_limit, p_amount
  );
  PERFORM public.presence_consume_bucket(
    'network', p_operation, p_network_digest, v_short_window, v_short_limit, p_amount
  );

  IF v_long_window <> v_short_window THEN
    PERFORM public.presence_consume_bucket(
      'account', p_operation, v_account_digest, v_long_window, v_long_limit, p_amount
    );
    PERFORM public.presence_consume_bucket(
      'session', p_operation, p_session_digest, v_long_window, v_long_limit, p_amount
    );
    PERFORM public.presence_consume_bucket(
      'device', p_operation, p_device_digest, v_long_window, v_long_limit, p_amount
    );
    PERFORM public.presence_consume_bucket(
      'network', p_operation, p_network_digest, v_long_window, v_long_limit, p_amount
    );
  END IF;

  IF v_day_window IS NOT NULL THEN
    PERFORM public.presence_consume_bucket(
      'account', p_operation, v_account_digest, v_day_window, v_day_limit, p_amount
    );
    PERFORM public.presence_consume_bucket(
      'session', p_operation, p_session_digest, v_day_window, v_day_limit, p_amount
    );
    PERFORM public.presence_consume_bucket(
      'device', p_operation, p_device_digest, v_day_window, v_day_limit, p_amount
    );
    PERFORM public.presence_consume_bucket(
      'network', p_operation, p_network_digest, v_day_window, v_day_limit, p_amount
    );
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.presence_assert_allowed_account(p_actor uuid)
RETURNS public.presence_control
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  v_control public.presence_control%ROWTYPE;
BEGIN
  SELECT * INTO STRICT v_control
  FROM public.presence_control
  WHERE id = 1;

  IF NOT v_control.operations_allowed THEN
    RAISE EXCEPTION 'presence operations are disabled'
      USING ERRCODE = '42501';
  END IF;
  IF v_control.allowlist_account_a IS NULL
    OR v_control.allowlist_account_b IS NULL
    OR p_actor NOT IN (v_control.allowlist_account_a, v_control.allowlist_account_b) THEN
    RAISE EXCEPTION 'account is not eligible for presence'
      USING ERRCODE = '42501';
  END IF;
  IF v_control.pilot_boundary IS NULL
    OR v_control.wave_retention_seconds IS NULL
    OR v_control.report_retention_seconds IS NULL
    OR v_control.safety_responder_account_id IS NULL
    OR v_control.safety_backup_account_id IS NULL THEN
    RAISE EXCEPTION 'presence controls are incomplete'
      USING ERRCODE = '55000';
  END IF;

  RETURN v_control;
END;
$$;

CREATE OR REPLACE FUNCTION public.presence_pair_is_safe(
  p_viewer uuid,
  p_subject uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
  SELECT NOT EXISTS (
    SELECT 1
    FROM public.presence_blocks b
    WHERE (b.blocker_account_id = p_viewer AND b.blocked_account_id = p_subject)
       OR (b.blocker_account_id = p_subject AND b.blocked_account_id = p_viewer)
  )
  AND NOT EXISTS (
    SELECT 1
    FROM public.presence_reports r
    WHERE r.resolution = 'open'
      AND (
        (r.reporter_account_id = p_viewer AND r.subject_account_id = p_subject)
        OR (r.reporter_account_id = p_subject AND r.subject_account_id = p_viewer)
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.presence_pair_is_reciprocal(
  p_viewer uuid,
  p_subject uuid,
  p_generation bigint
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
  SELECT p_viewer <> p_subject AND EXISTS (
    SELECT 1
    FROM public.presence_leases viewer
    JOIN public.presence_preferences viewer_preference
      ON viewer_preference.account_id = viewer.account_id
     AND viewer_preference.presence_opted_in
    JOIN public.presence_leases subject
      ON subject.account_id = p_subject
    JOIN public.presence_preferences subject_preference
      ON subject_preference.account_id = subject.account_id
     AND subject_preference.presence_opted_in
    WHERE viewer.account_id = p_viewer
      AND viewer.revoked_at IS NULL
      AND subject.revoked_at IS NULL
      AND viewer.expires_at > clock_timestamp()
      AND subject.expires_at > clock_timestamp()
      AND viewer.control_generation = p_generation
      AND subject.control_generation = p_generation
      AND public.ST_DWithin(viewer.centroid, subject.centroid, 5000)
  );
$$;

-- RPC 1/9: preference and presence-profile consent remain independent.
CREATE OR REPLACE FUNCTION public.presence_set_preferences(
  p_actor uuid,
  p_presence_opted_in boolean,
  p_profile_consented boolean,
  p_display_name text DEFAULT NULL,
  p_avatar_url text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  v_control public.presence_control%ROWTYPE;
BEGIN
  SELECT * INTO STRICT v_control FROM public.presence_control WHERE id = 1;
  IF v_control.allowlist_account_a IS NULL
    OR v_control.allowlist_account_b IS NULL
    OR p_actor NOT IN (v_control.allowlist_account_a, v_control.allowlist_account_b) THEN
    RAISE EXCEPTION 'account is not allowlisted for presence'
      USING ERRCODE = '42501';
  END IF;
  IF p_profile_consented
    AND nullif(btrim(coalesce(p_display_name, '')), '') IS NULL
    AND p_avatar_url IS NULL THEN
    RAISE EXCEPTION 'profile consent requires a chosen display field'
      USING ERRCODE = '22023';
  END IF;
  IF p_display_name IS NOT NULL AND length(btrim(p_display_name)) > 80 THEN
    RAISE EXCEPTION 'presence display name is too long'
      USING ERRCODE = '22001';
  END IF;
  IF p_avatar_url IS NOT NULL
    AND (length(p_avatar_url) > 2048 OR p_avatar_url !~ '^https://') THEN
    RAISE EXCEPTION 'presence avatar URL is invalid'
      USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.presence_preferences (
    account_id,
    presence_opted_in,
    profile_consented,
    display_name,
    avatar_url,
    updated_at
  )
  VALUES (
    p_actor,
    p_presence_opted_in,
    p_profile_consented,
    CASE WHEN p_profile_consented THEN nullif(btrim(p_display_name), '') ELSE NULL END,
    CASE WHEN p_profile_consented THEN p_avatar_url ELSE NULL END,
    clock_timestamp()
  )
  ON CONFLICT (account_id) DO UPDATE SET
    presence_opted_in = EXCLUDED.presence_opted_in,
    profile_consented = EXCLUDED.profile_consented,
    display_name = EXCLUDED.display_name,
    avatar_url = EXCLUDED.avatar_url,
    updated_at = EXCLUDED.updated_at;

  IF NOT p_presence_opted_in THEN
    DELETE FROM public.presence_leases WHERE account_id = p_actor;
  END IF;
END;
$$;

-- RPC 2/9: only a trusted foreground server may derive and submit cell keys.
CREATE OR REPLACE FUNCTION public.presence_activate(
  p_actor uuid,
  p_cell_x integer,
  p_cell_y integer,
  p_session_digest text,
  p_device_digest text,
  p_network_digest text
)
RETURNS TABLE (
  lease_id uuid,
  centroid_latitude double precision,
  centroid_longitude double precision,
  expires_at timestamptz,
  control_generation bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  v_control public.presence_control%ROWTYPE;
  v_centroid public.geography;
  v_lease_id uuid;
  v_expires_at timestamptz;
BEGIN
  PERFORM public.presence_cleanup_internal();
  v_control := public.presence_assert_allowed_account(p_actor);

  IF NOT EXISTS (
    SELECT 1 FROM public.presence_preferences
    WHERE account_id = p_actor AND presence_opted_in
  ) THEN
    RAISE EXCEPTION 'presence preference is off'
      USING ERRCODE = '42501';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM public.presence_leases existing_lease
    WHERE existing_lease.account_id = p_actor
      AND existing_lease.revoked_at IS NULL
      AND existing_lease.expires_at > clock_timestamp()
  ) THEN
    RAISE EXCEPTION 'active presence leases cannot renew'
      USING ERRCODE = '55000';
  END IF;

  PERFORM public.presence_consume_budgets(
    p_actor, 'activation', p_session_digest, p_device_digest, p_network_digest
  );

  v_centroid := public.ST_Transform(
    public.ST_SetSRID(
      public.ST_MakePoint(
        (p_cell_x::double precision + 0.5) * 500,
        (p_cell_y::double precision + 0.5) * 500
      ),
      3857
    ),
    4326
  )::public.geography;

  IF NOT public.ST_Covers(
    v_control.pilot_boundary::public.geometry,
    v_centroid::public.geometry
  ) THEN
    RAISE EXCEPTION 'presence cell is outside the pilot geography'
      USING ERRCODE = '22023';
  END IF;

  v_lease_id := gen_random_uuid();
  v_expires_at := clock_timestamp() + interval '15 minutes';

  INSERT INTO public.presence_leases (
    id,
    account_id,
    cell_x,
    cell_y,
    centroid,
    control_generation,
    issued_at,
    expires_at
  )
  VALUES (
    v_lease_id,
    p_actor,
    p_cell_x,
    p_cell_y,
    v_centroid,
    v_control.generation,
    clock_timestamp(),
    v_expires_at
  );

  RETURN QUERY SELECT
    v_lease_id,
    public.ST_Y(v_centroid::public.geometry),
    public.ST_X(v_centroid::public.geometry),
    v_expires_at,
    v_control.generation;
END;
$$;

-- RPC 3/9: stopping is available even while the global control is off.
CREATE OR REPLACE FUNCTION public.presence_stop(p_actor uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
BEGIN
  DELETE FROM public.presence_leases WHERE account_id = p_actor;
END;
$$;

-- RPC 4/9: snapshots are derived; there is no snapshot or capability table.
-- row_kind='marker' returns eligible subjects. row_kind='wave' returns a pending
-- ephemeral acknowledgement and no coordinate.
CREATE OR REPLACE FUNCTION public.presence_snapshot(
  p_actor uuid,
  p_session_digest text,
  p_device_digest text,
  p_network_digest text
)
RETURNS TABLE (
  row_kind text,
  subject_account_id uuid,
  subject_lease_id uuid,
  centroid_latitude double precision,
  centroid_longitude double precision,
  display_name text,
  avatar_url text,
  wave_id uuid,
  response_expires_at timestamptz,
  control_generation bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  v_control public.presence_control%ROWTYPE;
  v_viewer public.presence_leases%ROWTYPE;
  v_subject_count integer;
BEGIN
  PERFORM public.presence_cleanup_internal();
  v_control := public.presence_assert_allowed_account(p_actor);

  SELECT * INTO STRICT v_viewer
  FROM public.presence_leases viewer_lease
  WHERE viewer_lease.account_id = p_actor
    AND viewer_lease.revoked_at IS NULL
    AND viewer_lease.expires_at > clock_timestamp()
    AND viewer_lease.control_generation = v_control.generation;

  IF NOT EXISTS (
    SELECT 1 FROM public.presence_preferences
    WHERE account_id = p_actor AND presence_opted_in
  ) THEN
    RAISE EXCEPTION 'viewer is not actively opted in'
      USING ERRCODE = '42501';
  END IF;

  PERFORM public.presence_consume_budgets(
    p_actor, 'snapshot', p_session_digest, p_device_digest, p_network_digest
  );

  SELECT count(*) INTO v_subject_count
  FROM (
    SELECT subject.id
    FROM public.presence_leases subject
    JOIN public.presence_preferences preference
      ON preference.account_id = subject.account_id
     AND preference.presence_opted_in
    WHERE subject.account_id <> p_actor
      AND subject.account_id IN (
        v_control.allowlist_account_a,
        v_control.allowlist_account_b
      )
      AND subject.revoked_at IS NULL
      AND subject.expires_at > clock_timestamp()
      AND subject.control_generation = v_control.generation
      AND public.ST_DWithin(subject.centroid, v_viewer.centroid, 5000)
      AND public.presence_pair_is_safe(p_actor, subject.account_id)
    ORDER BY encode(
      sha256(convert_to(subject.id::text || v_viewer.id::text, 'UTF8')),
      'hex'
    )
    LIMIT 50
  ) eligible;

  PERFORM public.presence_consume_budgets(
    p_actor,
    'disclosure',
    p_session_digest,
    p_device_digest,
    p_network_digest,
    v_subject_count
  );

  RETURN QUERY
  WITH eligible AS (
    SELECT
      subject.account_id,
      subject.id,
      subject.centroid,
      subject.expires_at,
      preference.profile_consented,
      preference.display_name,
      preference.avatar_url
    FROM public.presence_leases subject
    JOIN public.presence_preferences preference
      ON preference.account_id = subject.account_id
     AND preference.presence_opted_in
    WHERE subject.account_id <> p_actor
      AND subject.account_id IN (
        v_control.allowlist_account_a,
        v_control.allowlist_account_b
      )
      AND subject.revoked_at IS NULL
      AND subject.expires_at > clock_timestamp()
      AND subject.control_generation = v_control.generation
      AND public.ST_DWithin(subject.centroid, v_viewer.centroid, 5000)
      AND public.presence_pair_is_safe(p_actor, subject.account_id)
    ORDER BY encode(
      sha256(convert_to(subject.id::text || v_viewer.id::text, 'UTF8')),
      'hex'
    )
    LIMIT 50
  ),
  bounded AS (
    SELECT
      eligible.*,
      least(
        v_viewer.expires_at,
        min(eligible.expires_at) OVER ()
      ) AS snapshot_expires_at
    FROM eligible
  )
  SELECT
    'marker'::text,
    bounded.account_id,
    bounded.id,
    public.ST_Y(bounded.centroid::public.geometry),
    public.ST_X(bounded.centroid::public.geometry),
    CASE WHEN bounded.profile_consented THEN bounded.display_name::text ELSE NULL::text END,
    CASE WHEN bounded.profile_consented THEN bounded.avatar_url ELSE NULL END,
    NULL::uuid,
    bounded.snapshot_expires_at,
    v_control.generation
  FROM bounded;

  RETURN QUERY
  WITH selected_waves AS (
    SELECT wave.id
    FROM public.presence_waves wave
    WHERE wave.recipient_account_id = p_actor
      AND wave.delivered_at IS NULL
      AND wave.expires_at > clock_timestamp()
      AND public.presence_pair_is_safe(p_actor, wave.sender_account_id)
      AND public.presence_pair_is_reciprocal(
        p_actor,
        wave.sender_account_id,
        v_control.generation
      )
    ORDER BY wave.created_at
    LIMIT 20
  ),
  delivered_waves AS (
    UPDATE public.presence_waves wave
    SET delivered_at = clock_timestamp()
    FROM selected_waves selected
    WHERE wave.id = selected.id
      AND wave.delivered_at IS NULL
    RETURNING wave.*
  )
  SELECT
    'wave'::text,
    wave.sender_account_id,
    wave.sender_lease_id,
    NULL::double precision,
    NULL::double precision,
    CASE WHEN preference.profile_consented THEN preference.display_name::text ELSE NULL::text END,
    CASE WHEN preference.profile_consented THEN preference.avatar_url ELSE NULL END,
    wave.id,
    least(v_viewer.expires_at, wave.expires_at),
    v_control.generation
  FROM delivered_waves wave
  JOIN public.presence_preferences preference
    ON preference.account_id = wave.sender_account_id
  ORDER BY wave.created_at;
END;
$$;

-- RPC 5/9: one Wave per sender/idempotency digest; retries return the same row.
CREATE OR REPLACE FUNCTION public.presence_wave(
  p_actor uuid,
  p_recipient uuid,
  p_idempotency_digest text,
  p_session_digest text,
  p_device_digest text,
  p_network_digest text
)
RETURNS TABLE (wave_id uuid, expires_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  v_control public.presence_control%ROWTYPE;
  v_sender public.presence_leases%ROWTYPE;
  v_recipient public.presence_leases%ROWTYPE;
  v_existing public.presence_waves%ROWTYPE;
  v_wave_id uuid;
  v_expires_at timestamptz;
BEGIN
  PERFORM public.presence_cleanup_internal();
  v_control := public.presence_assert_allowed_account(p_actor);
  IF p_recipient NOT IN (
    v_control.allowlist_account_a,
    v_control.allowlist_account_b
  ) OR p_recipient = p_actor THEN
    RAISE EXCEPTION 'Wave recipient is not eligible'
      USING ERRCODE = '42501';
  END IF;
  PERFORM public.presence_assert_digest('idempotency digest', p_idempotency_digest);

  SELECT * INTO v_existing
  FROM public.presence_waves
  WHERE sender_account_id = p_actor
    AND idempotency_digest = p_idempotency_digest;

  IF FOUND THEN
    IF v_existing.recipient_account_id <> p_recipient THEN
      RAISE EXCEPTION 'idempotency digest is bound to another recipient'
        USING ERRCODE = '22023';
    END IF;
    RETURN QUERY SELECT v_existing.id, v_existing.expires_at;
    RETURN;
  END IF;

  SELECT * INTO STRICT v_sender
  FROM public.presence_leases sender_lease
  WHERE sender_lease.account_id = p_actor
    AND sender_lease.revoked_at IS NULL
    AND sender_lease.expires_at > clock_timestamp()
    AND sender_lease.control_generation = v_control.generation;

  SELECT * INTO STRICT v_recipient
  FROM public.presence_leases recipient_lease
  WHERE recipient_lease.account_id = p_recipient
    AND recipient_lease.revoked_at IS NULL
    AND recipient_lease.expires_at > clock_timestamp()
    AND recipient_lease.control_generation = v_control.generation;

  IF NOT public.presence_pair_is_reciprocal(
    p_actor,
    p_recipient,
    v_control.generation
  ) OR NOT public.presence_pair_is_safe(p_actor, p_recipient) THEN
    RAISE EXCEPTION 'Wave requires reciprocal active presence'
      USING ERRCODE = '42501';
  END IF;

  PERFORM public.presence_consume_budgets(
    p_actor, 'wave', p_session_digest, p_device_digest, p_network_digest
  );

  v_expires_at := least(
    v_sender.expires_at,
    v_recipient.expires_at,
    clock_timestamp() + (v_control.wave_retention_seconds * interval '1 second')
  );

  INSERT INTO public.presence_waves (
    sender_account_id,
    recipient_account_id,
    sender_lease_id,
    recipient_lease_id,
    idempotency_digest,
    created_at,
    expires_at
  )
  VALUES (
    p_actor,
    p_recipient,
    v_sender.id,
    v_recipient.id,
    p_idempotency_digest,
    clock_timestamp(),
    v_expires_at
  )
  ON CONFLICT (sender_account_id, idempotency_digest)
  DO UPDATE SET idempotency_digest = EXCLUDED.idempotency_digest
  RETURNING id, presence_waves.expires_at INTO v_wave_id, v_expires_at;

  RETURN QUERY SELECT v_wave_id, v_expires_at;
END;
$$;

-- RPC 6/9: a block takes effect before success and clears pair Waves.
CREATE OR REPLACE FUNCTION public.presence_block(
  p_actor uuid,
  p_subject uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  v_control public.presence_control%ROWTYPE;
BEGIN
  v_control := public.presence_assert_allowed_account(p_actor);
  IF p_subject NOT IN (
    v_control.allowlist_account_a,
    v_control.allowlist_account_b
  ) OR p_subject = p_actor THEN
    RAISE EXCEPTION 'block subject is not eligible'
      USING ERRCODE = '42501';
  END IF;
  IF NOT public.presence_pair_is_reciprocal(
    p_actor,
    p_subject,
    v_control.generation
  ) OR NOT public.presence_pair_is_safe(p_actor, p_subject) THEN
    RAISE EXCEPTION 'block capability is stale'
      USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.presence_blocks (blocker_account_id, blocked_account_id)
  VALUES (p_actor, p_subject)
  ON CONFLICT (blocker_account_id, blocked_account_id) DO NOTHING;

  DELETE FROM public.presence_waves
  WHERE (sender_account_id = p_actor AND recipient_account_id = p_subject)
     OR (sender_account_id = p_subject AND recipient_account_id = p_actor);
END;
$$;

-- RPC 7/9: filing privately also creates the durable one-way block, so report
-- retention never causes the bilateral safety stop to disappear.
CREATE OR REPLACE FUNCTION public.presence_report(
  p_actor uuid,
  p_subject uuid,
  p_kind public.presence_report_kind,
  p_details text,
  p_session_digest text,
  p_device_digest text,
  p_network_digest text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  v_control public.presence_control%ROWTYPE;
  v_report_id uuid;
BEGIN
  v_control := public.presence_assert_allowed_account(p_actor);
  IF p_subject NOT IN (
    v_control.allowlist_account_a,
    v_control.allowlist_account_b
  ) OR p_subject = p_actor THEN
    RAISE EXCEPTION 'report subject is not eligible'
      USING ERRCODE = '42501';
  END IF;
  IF NOT public.presence_pair_is_reciprocal(
    p_actor,
    p_subject,
    v_control.generation
  ) THEN
    RAISE EXCEPTION 'report capability is stale'
      USING ERRCODE = '42501';
  END IF;
  IF p_details IS NOT NULL
    AND length(btrim(p_details)) NOT BETWEEN 1 AND 1000 THEN
    RAISE EXCEPTION 'report details are invalid'
      USING ERRCODE = '22023';
  END IF;

  PERFORM public.presence_consume_budgets(
    p_actor, 'report', p_session_digest, p_device_digest, p_network_digest
  );

  INSERT INTO public.presence_blocks (blocker_account_id, blocked_account_id)
  VALUES (p_actor, p_subject)
  ON CONFLICT (blocker_account_id, blocked_account_id) DO NOTHING;

  DELETE FROM public.presence_waves
  WHERE (sender_account_id = p_actor AND recipient_account_id = p_subject)
     OR (sender_account_id = p_subject AND recipient_account_id = p_actor);

  INSERT INTO public.presence_reports (
    reporter_account_id,
    subject_account_id,
    kind,
    details,
    purge_at
  )
  VALUES (
    p_actor,
    p_subject,
    p_kind,
    nullif(btrim(p_details), ''),
    clock_timestamp() + (v_control.report_retention_seconds * interval '1 second')
  )
  RETURNING id INTO v_report_id;

  RETURN v_report_id;
END;
$$;

-- RPC 8/9: safety-only read/close boundary. Reports never reach runtime callers.
CREATE OR REPLACE FUNCTION public.presence_review_reports(
  p_report_id uuid DEFAULT NULL,
  p_close boolean DEFAULT false
)
RETURNS TABLE (
  report_id uuid,
  reporter_account_id uuid,
  subject_account_id uuid,
  kind public.presence_report_kind,
  details text,
  resolution public.presence_report_resolution,
  created_at timestamptz,
  purge_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
BEGIN
  PERFORM public.presence_cleanup_internal();

  IF p_close AND p_report_id IS NULL THEN
    RAISE EXCEPTION 'closing a report requires its id'
      USING ERRCODE = '22023';
  END IF;
  IF p_close THEN
    UPDATE public.presence_reports report
    SET resolution = 'closed', resolved_at = clock_timestamp()
    WHERE report.id = p_report_id AND report.resolution = 'open';
  END IF;

  RETURN QUERY
  SELECT
    report.id,
    report.reporter_account_id,
    report.subject_account_id,
    report.kind,
    report.details,
    report.resolution,
    report.created_at,
    report.purge_at
  FROM public.presence_reports report
  WHERE (p_report_id IS NULL AND report.resolution = 'open')
     OR report.id = p_report_id
  ORDER BY report.created_at;
END;
$$;

-- RPC 9/9: safety-only configuration and kill switch. Turning off always
-- increments generation and purges leases and Waves. Turning on restores none.
CREATE OR REPLACE FUNCTION public.presence_set_control(
  p_operations_allowed boolean,
  p_replace_configuration boolean DEFAULT false,
  p_allowlist_account_a uuid DEFAULT NULL,
  p_allowlist_account_b uuid DEFAULT NULL,
  p_pilot_boundary public.geography DEFAULT NULL,
  p_wave_retention_seconds integer DEFAULT NULL,
  p_report_retention_seconds integer DEFAULT NULL,
  p_safety_responder_account_id uuid DEFAULT NULL,
  p_safety_backup_account_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  v_control public.presence_control%ROWTYPE;
BEGIN
  SELECT * INTO STRICT v_control FROM public.presence_control WHERE id = 1;
  IF p_replace_configuration AND v_control.operations_allowed THEN
    RAISE EXCEPTION 'disable and purge presence before replacing configuration'
      USING ERRCODE = '55000';
  END IF;

  IF p_replace_configuration THEN
    IF p_pilot_boundary IS NOT NULL
      AND public.GeometryType(p_pilot_boundary::public.geometry) <> 'POLYGON' THEN
      RAISE EXCEPTION 'pilot boundary must be one polygon'
        USING ERRCODE = '22023';
    END IF;

    UPDATE public.presence_control
    SET
      allowlist_account_a = p_allowlist_account_a,
      allowlist_account_b = p_allowlist_account_b,
      pilot_boundary = p_pilot_boundary,
      wave_retention_seconds = p_wave_retention_seconds,
      report_retention_seconds = p_report_retention_seconds,
      safety_responder_account_id = p_safety_responder_account_id,
      safety_backup_account_id = p_safety_backup_account_id,
      generation = generation + 1,
      updated_at = clock_timestamp()
    WHERE id = 1;
  END IF;

  SELECT * INTO STRICT v_control FROM public.presence_control WHERE id = 1;
  IF p_operations_allowed AND (
    v_control.allowlist_account_a IS NULL
    OR v_control.allowlist_account_b IS NULL
    OR v_control.allowlist_account_a = v_control.allowlist_account_b
    OR v_control.pilot_boundary IS NULL
    OR v_control.wave_retention_seconds IS NULL
    OR v_control.report_retention_seconds IS NULL
    OR v_control.safety_responder_account_id IS NULL
    OR v_control.safety_backup_account_id IS NULL
    OR v_control.safety_responder_account_id = v_control.safety_backup_account_id
  ) THEN
    RAISE EXCEPTION 'presence cannot be enabled with incomplete controls'
      USING ERRCODE = '55000';
  END IF;

  UPDATE public.presence_control
  SET
    operations_allowed = p_operations_allowed,
    generation = generation + CASE WHEN p_operations_allowed THEN 0 ELSE 1 END,
    updated_at = clock_timestamp()
  WHERE id = 1;

  IF NOT p_operations_allowed THEN
    DELETE FROM public.presence_leases;
    DELETE FROM public.presence_waves;
  END IF;
END;
$$;


-- SECURITY-PILLAR-BOUNDARY
-- Least-privilege ADR-016 boundary. These are cluster roles, not application
-- identities. The runtime still derives the account from the authenticated
-- server session; browser payloads never choose p_actor.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'wetindey_presence_owner') THEN
    CREATE ROLE wetindey_presence_owner NOLOGIN NOBYPASSRLS;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'wetindey_presence_runtime') THEN
    CREATE ROLE wetindey_presence_runtime NOLOGIN NOBYPASSRLS;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'wetindey_presence_safety') THEN
    CREATE ROLE wetindey_presence_safety NOLOGIN NOBYPASSRLS;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'wetindey_presence_lifecycle') THEN
    CREATE ROLE wetindey_presence_lifecycle NOLOGIN NOBYPASSRLS;
  END IF;
END;
$$;

ALTER ROLE wetindey_presence_owner NOLOGIN NOBYPASSRLS;
ALTER ROLE wetindey_presence_runtime NOLOGIN NOBYPASSRLS;
ALTER ROLE wetindey_presence_safety NOLOGIN NOBYPASSRLS;
ALTER ROLE wetindey_presence_lifecycle NOLOGIN NOBYPASSRLS;

-- PostgreSQL 17 grants a non-superuser CREATEROLE principal ADMIN TRUE but
-- SET FALSE on a role it creates. Ownership transfer requires SET TRUE and
-- CREATE on the containing schema. Both capabilities are transaction-local:
-- the migration fails closed if they cannot be granted or fully removed.
GRANT wetindey_presence_owner TO SESSION_USER WITH INHERIT FALSE;
GRANT wetindey_presence_owner TO SESSION_USER WITH SET TRUE;
GRANT CREATE ON SCHEMA public TO wetindey_presence_owner;

ALTER TABLE public.presence_control ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.presence_control FORCE ROW LEVEL SECURITY;
ALTER TABLE public.presence_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.presence_preferences FORCE ROW LEVEL SECURITY;
ALTER TABLE public.presence_leases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.presence_leases FORCE ROW LEVEL SECURITY;
ALTER TABLE public.presence_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.presence_blocks FORCE ROW LEVEL SECURITY;
ALTER TABLE public.presence_waves ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.presence_waves FORCE ROW LEVEL SECURITY;
ALTER TABLE public.presence_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.presence_reports FORCE ROW LEVEL SECURITY;
ALTER TABLE public.presence_rate_buckets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.presence_rate_buckets FORCE ROW LEVEL SECURITY;

CREATE POLICY presence_control_owner_policy ON public.presence_control
  FOR ALL TO wetindey_presence_owner USING (true) WITH CHECK (true);
CREATE POLICY presence_preferences_owner_policy ON public.presence_preferences
  FOR ALL TO wetindey_presence_owner USING (true) WITH CHECK (true);
CREATE POLICY presence_leases_owner_policy ON public.presence_leases
  FOR ALL TO wetindey_presence_owner USING (true) WITH CHECK (true);
CREATE POLICY presence_blocks_owner_policy ON public.presence_blocks
  FOR ALL TO wetindey_presence_owner USING (true) WITH CHECK (true);
CREATE POLICY presence_waves_owner_policy ON public.presence_waves
  FOR ALL TO wetindey_presence_owner USING (true) WITH CHECK (true);
CREATE POLICY presence_reports_owner_policy ON public.presence_reports
  FOR ALL TO wetindey_presence_owner USING (true) WITH CHECK (true);
CREATE POLICY presence_rate_buckets_owner_policy ON public.presence_rate_buckets
  FOR ALL TO wetindey_presence_owner USING (true) WITH CHECK (true);

REVOKE ALL ON TABLE
  public.presence_control,
  public.presence_preferences,
  public.presence_leases,
  public.presence_blocks,
  public.presence_waves,
  public.presence_reports,
  public.presence_rate_buckets
FROM PUBLIC, wetindey_presence_runtime, wetindey_presence_safety,
  wetindey_presence_lifecycle;

REVOKE ALL ON FUNCTION public.presence_cleanup_internal()
  FROM PUBLIC, wetindey_presence_runtime, wetindey_presence_safety,
    wetindey_presence_lifecycle;
REVOKE ALL ON FUNCTION public.presence_run_retention_cleanup()
  FROM PUBLIC, wetindey_presence_runtime, wetindey_presence_safety,
    wetindey_presence_lifecycle;
REVOKE ALL ON FUNCTION public.presence_assert_digest(text, text)
  FROM PUBLIC, wetindey_presence_runtime, wetindey_presence_safety,
    wetindey_presence_lifecycle;
REVOKE ALL ON FUNCTION public.presence_erasure_uuid(uuid, text)
  FROM PUBLIC, wetindey_presence_runtime, wetindey_presence_safety,
    wetindey_presence_lifecycle;
REVOKE ALL ON FUNCTION public.presence_delete_account(uuid, text, text, text)
  FROM PUBLIC;
REVOKE ALL ON FUNCTION public.presence_consume_bucket(
  public.presence_rate_dimension,
  public.presence_rate_operation,
  text,
  integer,
  integer,
  integer
) FROM PUBLIC, wetindey_presence_runtime, wetindey_presence_safety;
REVOKE ALL ON FUNCTION public.presence_consume_budgets(
  uuid,
  public.presence_rate_operation,
  text,
  text,
  text,
  integer
) FROM PUBLIC, wetindey_presence_runtime, wetindey_presence_safety;
REVOKE ALL ON FUNCTION public.presence_assert_allowed_account(uuid)
  FROM PUBLIC, wetindey_presence_runtime, wetindey_presence_safety;
REVOKE ALL ON FUNCTION public.presence_pair_is_safe(uuid, uuid)
  FROM PUBLIC, wetindey_presence_runtime, wetindey_presence_safety;
REVOKE ALL ON FUNCTION public.presence_pair_is_reciprocal(uuid, uuid, bigint)
  FROM PUBLIC, wetindey_presence_runtime, wetindey_presence_safety;

REVOKE ALL ON FUNCTION public.presence_set_preferences(
  uuid, boolean, boolean, text, text
) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.presence_activate(
  uuid, integer, integer, text, text, text
) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.presence_stop(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.presence_snapshot(uuid, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.presence_wave(
  uuid, uuid, text, text, text, text
) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.presence_block(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.presence_report(
  uuid, uuid, public.presence_report_kind, text, text, text, text
) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.presence_review_reports(uuid, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.presence_set_control(
  boolean, boolean, uuid, uuid, public.geography, integer, integer, uuid, uuid
) FROM PUBLIC;

REVOKE USAGE ON TYPE
  public.presence_rate_dimension,
  public.presence_rate_operation,
  public.presence_report_kind,
  public.presence_report_resolution
FROM PUBLIC;

GRANT USAGE ON SCHEMA public
  TO wetindey_presence_runtime, wetindey_presence_safety,
    wetindey_presence_lifecycle;
GRANT USAGE ON TYPE
  public.presence_rate_dimension,
  public.presence_rate_operation,
  public.presence_report_kind,
  public.presence_report_resolution
TO wetindey_presence_runtime, wetindey_presence_safety;

GRANT EXECUTE ON FUNCTION public.presence_set_preferences(
  uuid, boolean, boolean, text, text
) TO wetindey_presence_runtime;
GRANT EXECUTE ON FUNCTION public.presence_activate(
  uuid, integer, integer, text, text, text
) TO wetindey_presence_runtime;
GRANT EXECUTE ON FUNCTION public.presence_stop(uuid)
  TO wetindey_presence_runtime;
GRANT EXECUTE ON FUNCTION public.presence_snapshot(uuid, text, text, text)
  TO wetindey_presence_runtime;
GRANT EXECUTE ON FUNCTION public.presence_wave(
  uuid, uuid, text, text, text, text
) TO wetindey_presence_runtime;
GRANT EXECUTE ON FUNCTION public.presence_block(uuid, uuid)
  TO wetindey_presence_runtime;
GRANT EXECUTE ON FUNCTION public.presence_report(
  uuid, uuid, public.presence_report_kind, text, text, text, text
) TO wetindey_presence_runtime;

GRANT EXECUTE ON FUNCTION public.presence_review_reports(uuid, boolean)
  TO wetindey_presence_safety;
GRANT EXECUTE ON FUNCTION public.presence_set_control(
  boolean, boolean, uuid, uuid, public.geography, integer, integer, uuid, uuid
) TO wetindey_presence_safety;
GRANT EXECUTE ON FUNCTION public.presence_run_retention_cleanup()
  TO wetindey_presence_safety;

GRANT EXECUTE ON FUNCTION public.presence_delete_account(uuid, text, text, text)
  TO wetindey_presence_lifecycle;

-- Transfer ownership last. The migration role creates the policies and grants
-- while it still owns the objects; runtime and safety roles never acquire direct
-- table privileges or ownership.
ALTER TABLE public.presence_control OWNER TO wetindey_presence_owner;
ALTER TABLE public.presence_preferences OWNER TO wetindey_presence_owner;
ALTER TABLE public.presence_leases OWNER TO wetindey_presence_owner;
ALTER TABLE public.presence_blocks OWNER TO wetindey_presence_owner;
ALTER TABLE public.presence_waves OWNER TO wetindey_presence_owner;
ALTER TABLE public.presence_reports OWNER TO wetindey_presence_owner;
ALTER TABLE public.presence_rate_buckets OWNER TO wetindey_presence_owner;

ALTER TYPE public.presence_rate_dimension OWNER TO wetindey_presence_owner;
ALTER TYPE public.presence_rate_operation OWNER TO wetindey_presence_owner;
ALTER TYPE public.presence_report_kind OWNER TO wetindey_presence_owner;
ALTER TYPE public.presence_report_resolution OWNER TO wetindey_presence_owner;

ALTER FUNCTION public.presence_cleanup_internal() OWNER TO wetindey_presence_owner;
ALTER FUNCTION public.presence_run_retention_cleanup() OWNER TO wetindey_presence_owner;
ALTER FUNCTION public.presence_assert_digest(text, text) OWNER TO wetindey_presence_owner;
ALTER FUNCTION public.presence_erasure_uuid(uuid, text) OWNER TO wetindey_presence_owner;
ALTER FUNCTION public.presence_delete_account(
  uuid, text, text, text
) OWNER TO wetindey_presence_owner;
ALTER FUNCTION public.presence_consume_bucket(
  public.presence_rate_dimension,
  public.presence_rate_operation,
  text,
  integer,
  integer,
  integer
) OWNER TO wetindey_presence_owner;
ALTER FUNCTION public.presence_consume_budgets(
  uuid,
  public.presence_rate_operation,
  text,
  text,
  text,
  integer
) OWNER TO wetindey_presence_owner;
ALTER FUNCTION public.presence_assert_allowed_account(uuid) OWNER TO wetindey_presence_owner;
ALTER FUNCTION public.presence_pair_is_safe(uuid, uuid) OWNER TO wetindey_presence_owner;
ALTER FUNCTION public.presence_pair_is_reciprocal(
  uuid, uuid, bigint
) OWNER TO wetindey_presence_owner;
ALTER FUNCTION public.presence_set_preferences(
  uuid, boolean, boolean, text, text
) OWNER TO wetindey_presence_owner;
ALTER FUNCTION public.presence_activate(
  uuid, integer, integer, text, text, text
) OWNER TO wetindey_presence_owner;
ALTER FUNCTION public.presence_stop(uuid) OWNER TO wetindey_presence_owner;
ALTER FUNCTION public.presence_snapshot(
  uuid, text, text, text
) OWNER TO wetindey_presence_owner;
ALTER FUNCTION public.presence_wave(
  uuid, uuid, text, text, text, text
) OWNER TO wetindey_presence_owner;
ALTER FUNCTION public.presence_block(uuid, uuid) OWNER TO wetindey_presence_owner;
ALTER FUNCTION public.presence_report(
  uuid, uuid, public.presence_report_kind, text, text, text, text
) OWNER TO wetindey_presence_owner;
ALTER FUNCTION public.presence_review_reports(
  uuid, boolean
) OWNER TO wetindey_presence_owner;
ALTER FUNCTION public.presence_set_control(
  boolean, boolean, uuid, uuid, public.geography, integer, integer, uuid, uuid
) OWNER TO wetindey_presence_owner;

REVOKE CREATE ON SCHEMA public FROM wetindey_presence_owner;
REVOKE wetindey_presence_owner FROM SESSION_USER
  GRANTED BY SESSION_USER;

DO $$
BEGIN
  IF pg_has_role(
    session_user,
    'wetindey_presence_owner',
    'SET'
  ) THEN
    RAISE EXCEPTION 'migration principal retains a SET path to the presence owner'
      USING ERRCODE = '42501';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_auth_members membership
    JOIN pg_roles granted_role ON granted_role.oid = membership.roleid
    JOIN pg_roles member_role ON member_role.oid = membership.member
    WHERE granted_role.rolname = 'wetindey_presence_owner'
      AND member_role.rolname = session_user
      AND (membership.set_option OR membership.inherit_option)
  ) THEN
    RAISE EXCEPTION 'migration principal retains privileged presence owner membership'
      USING ERRCODE = '42501';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_auth_members membership
    JOIN pg_roles granted_role ON granted_role.oid = membership.roleid
    JOIN pg_roles member_role ON member_role.oid = membership.member
    JOIN pg_roles grantor_role ON grantor_role.oid = membership.grantor
    WHERE granted_role.rolname = 'wetindey_presence_owner'
      AND member_role.rolname = session_user
      AND grantor_role.rolname = session_user
  ) THEN
    RAISE EXCEPTION 'migration principal retains its transient owner grant'
      USING ERRCODE = '42501';
  END IF;

  IF has_schema_privilege(
    'wetindey_presence_owner',
    'public',
    'CREATE'
  ) THEN
    RAISE EXCEPTION 'presence owner retains CREATE on schema public'
      USING ERRCODE = '42501';
  END IF;
END;
$$;
