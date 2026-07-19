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
  SELECT * INTO STRICT v_control FROM public.presence_control WHERE id = 1;
  IF NOT v_control.runtime_allowed OR NOT v_control.operations_allowed THEN
    RAISE EXCEPTION 'presence runtime is disabled' USING ERRCODE = '42501';
  END IF;
  IF p_actor NOT IN (v_control.allowlist_account_a, v_control.allowlist_account_b) THEN
    RAISE EXCEPTION 'account is not eligible for presence' USING ERRCODE = '42501';
  END IF;
  IF v_control.pilot_boundary IS NULL
    OR v_control.wave_retention_seconds IS NULL
    OR v_control.report_retention_seconds IS NULL
    OR v_control.safety_responder_account_id IS NULL
    OR v_control.safety_backup_account_id IS NULL THEN
    RAISE EXCEPTION 'presence controls are incomplete' USING ERRCODE = '55000';
  END IF;
  RETURN v_control;
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

-- 0014 forward security boundary. The 0012 functions remain in the historical
-- pillar for lineage, but runtime grants are replaced by these opaque-token
-- contracts. Raw account, lease, Wave, report, and profile-Blob identifiers never
-- cross this boundary.

CREATE OR REPLACE FUNCTION public.presence_v2_digest(p_value text)
RETURNS text
LANGUAGE sql
IMMUTABLE
STRICT
SET search_path = pg_catalog
AS $$
  SELECT encode(sha256(convert_to(p_value, 'UTF8')), 'hex')
$$;

CREATE OR REPLACE FUNCTION public.presence_v2_pair_lock(
  p_left uuid,
  p_right uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
BEGIN
  IF p_left IS NULL OR p_right IS NULL OR p_left = p_right THEN
    RAISE EXCEPTION 'presence pair is invalid' USING ERRCODE = '22023';
  END IF;
  PERFORM pg_advisory_xact_lock(
    hashtextextended(
      least(p_left::text, p_right::text) || ':' || greatest(p_left::text, p_right::text),
      0
    )
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.presence_v2_revoke_account(
  p_actor uuid,
  p_reason text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
BEGIN
  UPDATE public.presence_capabilities
  SET state = 'revoked',
      revoked_at = coalesce(revoked_at, clock_timestamp()),
      revocation_reason = left(p_reason, 64)
  WHERE state = 'active'
    AND (viewer_account_id = p_actor OR subject_account_id = p_actor);
END;
$$;

CREATE OR REPLACE FUNCTION public.presence_v2_revoke_pair(
  p_left uuid,
  p_right uuid,
  p_reason text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
BEGIN
  PERFORM public.presence_v2_pair_lock(p_left, p_right);
  UPDATE public.presence_capabilities
  SET state = 'revoked',
      revoked_at = coalesce(revoked_at, clock_timestamp()),
      revocation_reason = left(p_reason, 64)
  WHERE state = 'active'
    AND ((viewer_account_id = p_left AND subject_account_id = p_right)
      OR (viewer_account_id = p_right AND subject_account_id = p_left));
END;
$$;

CREATE OR REPLACE FUNCTION public.presence_v2_lease_revoke_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
BEGIN
  UPDATE public.presence_capabilities
  SET state = 'revoked',
      revoked_at = coalesce(revoked_at, clock_timestamp()),
      revocation_reason = 'lease-revoked'
  WHERE state = 'active'
    AND (viewer_lease_id = OLD.id OR subject_lease_id = OLD.id);
  RETURN OLD;
END;
$$;

CREATE OR REPLACE FUNCTION public.presence_v2_issue_capability(
  p_viewer uuid,
  p_subject uuid,
  p_purpose public.presence_capability_purpose,
  p_snapshot_digest text,
  p_avatar_projection_token text,
  p_viewer_lease uuid,
  p_subject_lease uuid,
  p_expires_at timestamptz
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  v_token text;
  v_token_digest text;
BEGIN
  PERFORM public.presence_assert_digest('snapshot digest', p_snapshot_digest);
  PERFORM public.presence_assert_digest('avatar projection token', p_avatar_projection_token);
  LOOP
    v_token := encode(gen_random_bytes(32), 'hex');
    v_token_digest := public.presence_v2_digest(v_token);
    EXIT WHEN NOT EXISTS (
      SELECT 1 FROM public.presence_capabilities
      WHERE token_digest = v_token_digest
    );
  END LOOP;
  INSERT INTO public.presence_capabilities (
    token_digest,
    viewer_account_id,
    subject_account_id,
    purpose,
    state,
    snapshot_digest,
    avatar_projection_digest,
    viewer_lease_id,
    subject_lease_id,
    issued_at,
    expires_at
  )
  VALUES (
    v_token_digest,
    p_viewer,
    p_subject,
    p_purpose,
    'active',
    p_snapshot_digest,
    public.presence_v2_digest(p_avatar_projection_token),
    p_viewer_lease,
    p_subject_lease,
    clock_timestamp(),
    p_expires_at
  );
  RETURN v_token;
END;
$$;

CREATE OR REPLACE FUNCTION public.presence_cleanup_internal()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
BEGIN
  UPDATE public.presence_capabilities
  SET state = 'revoked',
      revoked_at = coalesce(revoked_at, clock_timestamp()),
      revocation_reason = 'expired'
  WHERE state = 'active' AND expires_at <= clock_timestamp();

  UPDATE public.presence_activation_requests
  SET status = 'expired',
      failure_code = coalesce(failure_code, 'expired'),
      updated_at = clock_timestamp()
  WHERE status = 'accepted' AND expires_at <= clock_timestamp();

  DELETE FROM public.presence_leases
  WHERE revoked_at IS NOT NULL OR expires_at <= clock_timestamp();
  DELETE FROM public.presence_waves
  WHERE expires_at <= clock_timestamp();
  DELETE FROM public.presence_rate_buckets
  WHERE expires_at <= clock_timestamp();
  DELETE FROM public.presence_reports
  WHERE purge_at <= clock_timestamp();
  DELETE FROM public.presence_capabilities
  WHERE state <> 'active'
    AND revoked_at < clock_timestamp() - interval '1 day';
  DELETE FROM public.presence_activation_requests
  WHERE status <> 'accepted'
    AND updated_at < clock_timestamp() - interval '1 day';
END;
$$;

CREATE OR REPLACE FUNCTION public.presence_set_preferences_v2(
  p_actor uuid,
  p_presence_opted_in boolean,
  p_name_consented boolean,
  p_avatar_consented boolean,
  p_display_name text DEFAULT NULL
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
  IF p_actor NOT IN (v_control.allowlist_account_a, v_control.allowlist_account_b) THEN
    RAISE EXCEPTION 'account is not allowlisted for presence' USING ERRCODE = '42501';
  END IF;
  IF p_name_consented AND nullif(btrim(p_display_name), '') IS NULL THEN
    RAISE EXCEPTION 'name consent requires a display name' USING ERRCODE = '22023';
  END IF;
  IF p_display_name IS NOT NULL AND length(btrim(p_display_name)) > 80 THEN
    RAISE EXCEPTION 'presence display name is too long' USING ERRCODE = '22001';
  END IF;

  PERFORM public.presence_v2_revoke_account(p_actor, 'preference-rekey');
  INSERT INTO public.presence_preferences (
    account_id,
    presence_opted_in,
    name_consented,
    avatar_consented,
    display_name,
    avatar_projection_epoch,
    updated_at
  )
  VALUES (
    p_actor,
    p_presence_opted_in,
    p_name_consented,
    p_avatar_consented,
    CASE WHEN p_name_consented THEN nullif(btrim(p_display_name), '') ELSE NULL END,
    1,
    clock_timestamp()
  )
  ON CONFLICT (account_id) DO UPDATE SET
    presence_opted_in = EXCLUDED.presence_opted_in,
    name_consented = EXCLUDED.name_consented,
    avatar_consented = EXCLUDED.avatar_consented,
    display_name = EXCLUDED.display_name,
    avatar_projection_epoch = public.presence_preferences.avatar_projection_epoch + 1,
    updated_at = EXCLUDED.updated_at;

  IF NOT p_presence_opted_in THEN
    DELETE FROM public.presence_leases WHERE account_id = p_actor;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.presence_activate_v2(
  p_actor uuid,
  p_request_digest text,
  p_cell_x integer,
  p_cell_y integer,
  p_session_digest text,
  p_device_digest text,
  p_network_digest text
)
RETURNS TABLE (activation_status text, expires_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  v_control public.presence_control%ROWTYPE;
  v_existing public.presence_activation_requests%ROWTYPE;
  v_centroid public.geography;
  v_lease_id uuid;
  v_expires_at timestamptz;
BEGIN
  PERFORM public.presence_assert_digest('activation request digest', p_request_digest);
  PERFORM public.presence_cleanup_internal();
  v_control := public.presence_assert_allowed_account(p_actor);
  PERFORM pg_advisory_xact_lock(hashtextextended('presence-activation:' || p_actor::text, 0));

  SELECT * INTO v_existing
  FROM public.presence_activation_requests
  WHERE account_id = p_actor AND request_digest = p_request_digest
  FOR UPDATE;
  IF FOUND THEN
    RETURN QUERY SELECT v_existing.status::text,
      CASE WHEN v_existing.lease_id IS NULL THEN NULL ELSE v_existing.expires_at END;
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.presence_leases
    WHERE account_id = p_actor AND revoked_at IS NULL AND expires_at > clock_timestamp()
  ) THEN
    INSERT INTO public.presence_activation_requests (
      account_id, request_digest, cell_x, cell_y, status, failure_code, expires_at
    ) VALUES (
      p_actor, p_request_digest, p_cell_x, p_cell_y, 'rejected', 'active-lease',
      clock_timestamp() + interval '15 minutes'
    );
    RETURN QUERY SELECT 'rejected'::text, NULL::timestamptz;
    RETURN;
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
  IF NOT public.ST_Covers(v_control.pilot_boundary::public.geometry, v_centroid::public.geometry) THEN
    INSERT INTO public.presence_activation_requests (
      account_id, request_digest, cell_x, cell_y, status, failure_code, expires_at
    ) VALUES (
      p_actor, p_request_digest, p_cell_x, p_cell_y, 'rejected', 'outside-boundary',
      clock_timestamp() + interval '15 minutes'
    );
    RETURN QUERY SELECT 'rejected'::text, NULL::timestamptz;
    RETURN;
  END IF;

  v_expires_at := clock_timestamp() + interval '15 minutes';
  INSERT INTO public.presence_leases (
    account_id, cell_x, cell_y, centroid, control_generation, issued_at, expires_at
  ) VALUES (
    p_actor, p_cell_x, p_cell_y, v_centroid, v_control.generation, clock_timestamp(), v_expires_at
  ) RETURNING id INTO v_lease_id;
  INSERT INTO public.presence_activation_requests (
    account_id, request_digest, cell_x, cell_y, status, lease_id, created_at, updated_at, expires_at
  ) VALUES (
    p_actor, p_request_digest, p_cell_x, p_cell_y, 'accepted', v_lease_id,
    clock_timestamp(), clock_timestamp(), v_expires_at
  );
  RETURN QUERY SELECT 'accepted'::text, v_expires_at;
END;
$$;

CREATE OR REPLACE FUNCTION public.presence_stop_v2(p_actor uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
BEGIN
  PERFORM public.presence_v2_revoke_account(p_actor, 'stop');
  DELETE FROM public.presence_leases WHERE account_id = p_actor;
  DELETE FROM public.presence_waves
  WHERE sender_account_id = p_actor OR recipient_account_id = p_actor;
END;
$$;

CREATE OR REPLACE FUNCTION public.presence_snapshot_v2(
  p_actor uuid,
  p_session_digest text,
  p_device_digest text,
  p_network_digest text
)
RETURNS TABLE (
  row_kind text,
  marker_capability text,
  coarse_latitude double precision,
  coarse_longitude double precision,
  display_name text,
  avatar_projection_token text,
  wave_capability text,
  block_capability text,
  report_capability text,
  expires_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  v_control public.presence_control%ROWTYPE;
  v_viewer public.presence_leases%ROWTYPE;
  v_subject record;
  v_snapshot_digest text := public.presence_v2_digest(encode(gen_random_bytes(32), 'hex'));
  v_avatar_projection_token text;
  v_wave_token text;
  v_block_token text;
  v_report_token text;
  v_expires_at timestamptz;
  v_count integer := 0;
BEGIN
  PERFORM public.presence_cleanup_internal();
  v_control := public.presence_assert_allowed_account(p_actor);
  SELECT * INTO STRICT v_viewer
  FROM public.presence_leases
  WHERE account_id = p_actor
    AND revoked_at IS NULL
    AND expires_at > clock_timestamp()
    AND control_generation = v_control.generation;
  IF NOT EXISTS (
    SELECT 1 FROM public.presence_preferences
    WHERE account_id = p_actor AND presence_opted_in
  ) THEN
    RAISE EXCEPTION 'viewer is not actively opted in' USING ERRCODE = '42501';
  END IF;

  PERFORM public.presence_consume_budgets(
    p_actor, 'snapshot', p_session_digest, p_device_digest, p_network_digest
  );
  FOR v_subject IN
    SELECT subject.account_id,
           subject.id AS lease_id,
           subject.centroid,
           subject.expires_at,
           preference.name_consented,
           preference.avatar_consented,
           preference.display_name
    FROM public.presence_leases subject
    JOIN public.presence_preferences preference
      ON preference.account_id = subject.account_id
     AND preference.presence_opted_in
    WHERE subject.account_id <> p_actor
      AND subject.account_id IN (v_control.allowlist_account_a, v_control.allowlist_account_b)
      AND subject.revoked_at IS NULL
      AND subject.expires_at > clock_timestamp()
      AND subject.control_generation = v_control.generation
      AND public.ST_DWithin(subject.centroid, v_viewer.centroid, 5000)
      AND public.presence_pair_is_safe(p_actor, subject.account_id)
    ORDER BY encode(sha256(convert_to(subject.id::text || v_viewer.id::text, 'UTF8')), 'hex')
    LIMIT 50
  LOOP
    v_count := v_count + 1;
    v_expires_at := least(v_viewer.expires_at, v_subject.expires_at, clock_timestamp() + interval '60 seconds');
    v_avatar_projection_token := encode(gen_random_bytes(32), 'hex');
    v_wave_token := public.presence_v2_issue_capability(
      p_actor, v_subject.account_id, 'wave', v_snapshot_digest, v_avatar_projection_token,
      v_viewer.id, v_subject.lease_id, v_expires_at
    );
    v_block_token := public.presence_v2_issue_capability(
      p_actor, v_subject.account_id, 'block', v_snapshot_digest, v_avatar_projection_token,
      v_viewer.id, v_subject.lease_id, v_expires_at
    );
    v_report_token := public.presence_v2_issue_capability(
      p_actor, v_subject.account_id, 'report', v_snapshot_digest, v_avatar_projection_token,
      v_viewer.id, v_subject.lease_id, v_expires_at
    );
    row_kind := 'marker';
    marker_capability := v_wave_token;
    coarse_latitude := public.ST_Y(v_subject.centroid::public.geometry);
    coarse_longitude := public.ST_X(v_subject.centroid::public.geometry);
    display_name := CASE WHEN v_subject.name_consented THEN v_subject.display_name ELSE NULL END;
    avatar_projection_token := CASE WHEN v_subject.avatar_consented THEN v_avatar_projection_token ELSE NULL END;
    wave_capability := v_wave_token;
    block_capability := v_block_token;
    report_capability := v_report_token;
    expires_at := v_expires_at;
    RETURN NEXT;
  END LOOP;

  PERFORM public.presence_consume_budgets(
    p_actor, 'disclosure', p_session_digest, p_device_digest, p_network_digest, v_count
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.presence_wave_v2(
  p_actor uuid,
  p_capability_token text,
  p_idempotency_digest text,
  p_session_digest text,
  p_device_digest text,
  p_network_digest text
)
RETURNS TABLE (action_status text, expires_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  v_cap public.presence_capabilities%ROWTYPE;
  v_existing public.presence_waves%ROWTYPE;
  v_expires_at timestamptz;
BEGIN
  PERFORM public.presence_assert_digest('capability token', p_capability_token);
  PERFORM public.presence_assert_digest('Wave idempotency digest', p_idempotency_digest);
  PERFORM public.presence_cleanup_internal();
  PERFORM public.presence_assert_allowed_account(p_actor);
  PERFORM pg_advisory_xact_lock(hashtextextended(
    'presence-wave:' || p_actor::text || ':' || p_idempotency_digest, 0
  ));
  SELECT * INTO v_cap FROM public.presence_capabilities
  WHERE token_digest = public.presence_v2_digest(p_capability_token)
    AND viewer_account_id = p_actor AND purpose = 'wave'
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'presence capability is unavailable' USING ERRCODE = '42501'; END IF;
  PERFORM public.presence_v2_pair_lock(p_actor, v_cap.subject_account_id);
  SELECT * INTO v_existing FROM public.presence_waves
  WHERE sender_account_id = p_actor AND idempotency_digest = p_idempotency_digest;
  IF FOUND THEN
    IF v_existing.recipient_account_id <> v_cap.subject_account_id THEN
      RAISE EXCEPTION 'Wave idempotency digest is bound to another subject'
        USING ERRCODE = '23505';
    END IF;
    RETURN QUERY SELECT 'replayed'::text, v_existing.expires_at;
    RETURN;
  END IF;
  IF v_cap.state <> 'active' OR v_cap.expires_at <= clock_timestamp() THEN
    RAISE EXCEPTION 'presence capability is unavailable' USING ERRCODE = '42501';
  END IF;
  IF NOT public.presence_pair_is_reciprocal(p_actor, v_cap.subject_account_id, (SELECT generation FROM public.presence_control WHERE id = 1))
     OR NOT public.presence_pair_is_safe(p_actor, v_cap.subject_account_id) THEN
    RAISE EXCEPTION 'Wave requires reciprocal active presence' USING ERRCODE = '42501';
  END IF;
  PERFORM public.presence_consume_budgets(p_actor, 'wave', p_session_digest, p_device_digest, p_network_digest);
  v_expires_at := least(v_cap.expires_at, clock_timestamp() + (SELECT wave_retention_seconds FROM public.presence_control WHERE id = 1) * interval '1 second');
  INSERT INTO public.presence_waves (
    sender_account_id, recipient_account_id, sender_lease_id, recipient_lease_id,
    idempotency_digest, created_at, expires_at
  ) VALUES (
    p_actor, v_cap.subject_account_id, v_cap.viewer_lease_id, v_cap.subject_lease_id,
    p_idempotency_digest, clock_timestamp(), v_expires_at
  );
  UPDATE public.presence_capabilities
  SET state = 'consumed', consumed_at = clock_timestamp(), revoked_at = clock_timestamp(), revocation_reason = 'wave-used'
  WHERE token_digest = v_cap.token_digest;
  RETURN QUERY SELECT 'accepted'::text, v_expires_at;
END;
$$;

CREATE OR REPLACE FUNCTION public.presence_block_v2(
  p_actor uuid,
  p_capability_token text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  v_cap public.presence_capabilities%ROWTYPE;
BEGIN
  PERFORM public.presence_assert_digest('capability token', p_capability_token);
  PERFORM public.presence_assert_allowed_account(p_actor);
  SELECT * INTO v_cap FROM public.presence_capabilities
  WHERE token_digest = public.presence_v2_digest(p_capability_token)
    AND viewer_account_id = p_actor AND purpose = 'block'
    AND state = 'active' AND expires_at > clock_timestamp()
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'presence capability is unavailable' USING ERRCODE = '42501'; END IF;
  PERFORM public.presence_v2_pair_lock(p_actor, v_cap.subject_account_id);
  INSERT INTO public.presence_blocks (blocker_account_id, blocked_account_id)
  VALUES (p_actor, v_cap.subject_account_id)
  ON CONFLICT (blocker_account_id, blocked_account_id) DO NOTHING;
  DELETE FROM public.presence_waves
  WHERE (sender_account_id = p_actor AND recipient_account_id = v_cap.subject_account_id)
     OR (sender_account_id = v_cap.subject_account_id AND recipient_account_id = p_actor);
  PERFORM public.presence_v2_revoke_pair(p_actor, v_cap.subject_account_id, 'blocked');
END;
$$;

CREATE OR REPLACE FUNCTION public.presence_report_v2(
  p_actor uuid,
  p_capability_token text,
  p_idempotency_digest text,
  p_kind public.presence_report_kind,
  p_details text,
  p_session_digest text,
  p_device_digest text,
  p_network_digest text
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  v_cap public.presence_capabilities%ROWTYPE;
  v_existing public.presence_reports%ROWTYPE;
BEGIN
  PERFORM public.presence_assert_digest('capability token', p_capability_token);
  PERFORM public.presence_assert_digest('report idempotency digest', p_idempotency_digest);
  PERFORM public.presence_assert_allowed_account(p_actor);
  PERFORM pg_advisory_xact_lock(hashtextextended(
    'presence-report:' || p_actor::text || ':' || p_idempotency_digest, 0
  ));
  SELECT * INTO v_cap FROM public.presence_capabilities
  WHERE token_digest = public.presence_v2_digest(p_capability_token)
    AND viewer_account_id = p_actor AND purpose = 'report'
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'presence capability is unavailable' USING ERRCODE = '42501'; END IF;
  PERFORM public.presence_v2_pair_lock(p_actor, v_cap.subject_account_id);
  SELECT * INTO v_existing FROM public.presence_reports
  WHERE reporter_account_id = p_actor AND idempotency_digest = p_idempotency_digest;
  IF FOUND THEN
    IF v_existing.subject_account_id <> v_cap.subject_account_id THEN
      RAISE EXCEPTION 'report idempotency digest is bound to another subject'
        USING ERRCODE = '23505';
    END IF;
    RETURN 'replayed';
  END IF;
  IF v_cap.state <> 'active' OR v_cap.expires_at <= clock_timestamp() THEN
    RAISE EXCEPTION 'presence capability is unavailable' USING ERRCODE = '42501';
  END IF;
  IF p_details IS NOT NULL AND length(btrim(p_details)) NOT BETWEEN 1 AND 1000 THEN
    RAISE EXCEPTION 'report details are invalid' USING ERRCODE = '22023';
  END IF;
  IF NOT public.presence_pair_is_reciprocal(p_actor, v_cap.subject_account_id, (SELECT generation FROM public.presence_control WHERE id = 1)) THEN
    RAISE EXCEPTION 'report capability is stale' USING ERRCODE = '42501';
  END IF;
  PERFORM public.presence_consume_budgets(p_actor, 'report', p_session_digest, p_device_digest, p_network_digest);
  INSERT INTO public.presence_blocks (blocker_account_id, blocked_account_id)
  VALUES (p_actor, v_cap.subject_account_id)
  ON CONFLICT (blocker_account_id, blocked_account_id) DO NOTHING;
  DELETE FROM public.presence_waves
  WHERE (sender_account_id = p_actor AND recipient_account_id = v_cap.subject_account_id)
     OR (sender_account_id = v_cap.subject_account_id AND recipient_account_id = p_actor);
  INSERT INTO public.presence_reports (
    reporter_account_id, subject_account_id, idempotency_digest, kind, details, purge_at
  ) VALUES (
    p_actor, v_cap.subject_account_id, p_idempotency_digest, p_kind,
    nullif(btrim(p_details), ''),
    clock_timestamp() + ((SELECT report_retention_seconds FROM public.presence_control WHERE id = 1) * interval '1 second')
  );
  PERFORM public.presence_v2_revoke_pair(p_actor, v_cap.subject_account_id, 'reported');
  RETURN 'accepted';
END;
$$;

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
  v_account_digest text;
BEGIN
  IF p_actor IS NULL THEN RAISE EXCEPTION 'account deletion requires an actor' USING ERRCODE = '22023'; END IF;
  IF p_session_digest IS NOT NULL THEN PERFORM public.presence_assert_digest('session digest', p_session_digest); END IF;
  IF p_device_digest IS NOT NULL THEN PERFORM public.presence_assert_digest('device digest', p_device_digest); END IF;
  IF p_network_digest IS NOT NULL THEN PERFORM public.presence_assert_digest('network digest', p_network_digest); END IF;
  PERFORM public.presence_v2_revoke_account(p_actor, 'account-delete');
  DELETE FROM public.presence_activation_requests WHERE account_id = p_actor;
  SELECT * INTO STRICT v_control FROM public.presence_control WHERE id = 1 FOR UPDATE;
  UPDATE public.presence_control
  SET operations_allowed = false,
      generation = generation + 1,
      allowlist_account_a = CASE WHEN p_actor IN (allowlist_account_a, allowlist_account_b) THEN NULL ELSE allowlist_account_a END,
      allowlist_account_b = CASE WHEN p_actor IN (allowlist_account_a, allowlist_account_b) THEN NULL ELSE allowlist_account_b END,
      safety_responder_account_id = CASE WHEN p_actor IN (safety_responder_account_id, safety_backup_account_id) THEN NULL ELSE safety_responder_account_id END,
      safety_backup_account_id = CASE WHEN p_actor IN (safety_responder_account_id, safety_backup_account_id) THEN NULL ELSE safety_backup_account_id END,
      updated_at = clock_timestamp()
  WHERE id = 1 AND p_actor IN (v_control.allowlist_account_a, v_control.allowlist_account_b, v_control.safety_responder_account_id, v_control.safety_backup_account_id);
  DELETE FROM public.presence_leases WHERE account_id = p_actor;
  DELETE FROM public.presence_waves WHERE sender_account_id = p_actor OR recipient_account_id = p_actor;
  DELETE FROM public.presence_preferences WHERE account_id = p_actor;
  DELETE FROM public.presence_blocks WHERE blocker_account_id = p_actor OR blocked_account_id = p_actor;
  v_account_digest := encode(sha256(convert_to(p_actor::text, 'UTF8')), 'hex');
  DELETE FROM public.presence_rate_buckets
  WHERE (dimension = 'account' AND key_digest = v_account_digest)
     OR (dimension = 'session' AND key_digest = p_session_digest)
     OR (dimension = 'device' AND key_digest = p_device_digest)
     OR (dimension = 'network' AND key_digest = p_network_digest);
  UPDATE public.presence_reports
  SET reporter_account_id = public.presence_erasure_uuid(id, 'deleted-reporter'), details = NULL
  WHERE reporter_account_id = p_actor;
  UPDATE public.presence_reports
  SET subject_account_id = public.presence_erasure_uuid(id, 'deleted-subject'), details = NULL
  WHERE subject_account_id = p_actor;
END;
$$;
