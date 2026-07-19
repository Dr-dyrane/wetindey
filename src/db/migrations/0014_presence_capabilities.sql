-- 0014 guarded Presence capability correction.
-- The complete forward delta is assembled below from the canonical schema,
-- services, and security pillars. It must run only after 0000-0013.

CREATE TYPE public.presence_activation_status AS ENUM ('accepted', 'rejected', 'expired');
CREATE TYPE public.presence_capability_purpose AS ENUM ('wave', 'block', 'report');
CREATE TYPE public.presence_capability_state AS ENUM ('active', 'revoked', 'consumed');

ALTER TABLE public.presence_preferences
  ADD COLUMN name_consented boolean NOT NULL DEFAULT false,
  ADD COLUMN avatar_consented boolean NOT NULL DEFAULT false,
  ADD COLUMN avatar_projection_epoch bigint NOT NULL DEFAULT 1;

UPDATE public.presence_preferences
SET name_consented = (COALESCE(profile_consented, false) AND display_name IS NOT NULL),
    avatar_consented = false,
    avatar_projection_epoch = 1;

ALTER TABLE public.presence_preferences
  DROP CONSTRAINT IF EXISTS presence_preferences_profile_check,
  DROP CONSTRAINT IF EXISTS presence_preferences_avatar_check,
  DROP COLUMN IF EXISTS profile_consented,
  DROP COLUMN IF EXISTS avatar_url;

ALTER TABLE public.presence_preferences
  ADD CONSTRAINT presence_preferences_name_check CHECK (
    (name_consented AND display_name IS NOT NULL)
    OR (NOT name_consented AND display_name IS NULL)
  ),
  ADD CONSTRAINT presence_preferences_epoch_check CHECK (avatar_projection_epoch > 0);

ALTER TABLE public.presence_control
  ADD COLUMN runtime_allowed boolean NOT NULL DEFAULT false;

ALTER TABLE public.presence_reports ADD COLUMN idempotency_digest varchar(64);
UPDATE public.presence_reports
SET idempotency_digest = encode(sha256(convert_to(id::text, 'UTF8')), 'hex')
WHERE idempotency_digest IS NULL;
ALTER TABLE public.presence_reports
  ALTER COLUMN idempotency_digest SET NOT NULL,
  ADD CONSTRAINT presence_reports_digest_check CHECK (idempotency_digest ~ '^[0-9a-f]{64}$');
CREATE UNIQUE INDEX presence_reports_idempotency_key
  ON public.presence_reports (reporter_account_id, idempotency_digest);

CREATE TABLE public.presence_activation_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL,
  request_digest varchar(64) NOT NULL,
  cell_x integer NOT NULL,
  cell_y integer NOT NULL,
  status public.presence_activation_status NOT NULL DEFAULT 'accepted',
  lease_id uuid REFERENCES public.presence_leases(id) ON DELETE SET NULL,
  failure_code varchar(64),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  CONSTRAINT presence_activation_requests_digest_check CHECK (request_digest ~ '^[0-9a-f]{64}$'),
  CONSTRAINT presence_activation_requests_status_check CHECK (
    (status = 'accepted' AND lease_id IS NOT NULL AND failure_code IS NULL)
    OR (status IN ('rejected', 'expired') AND failure_code IS NOT NULL)
  ),
  CONSTRAINT presence_activation_requests_expiry_check CHECK (expires_at > created_at)
);
CREATE UNIQUE INDEX presence_activation_requests_key
  ON public.presence_activation_requests (account_id, request_digest);
CREATE INDEX presence_activation_requests_expiry_idx
  ON public.presence_activation_requests (expires_at);

CREATE TABLE public.presence_capabilities (
  token_digest varchar(64) PRIMARY KEY,
  viewer_account_id uuid NOT NULL,
  subject_account_id uuid NOT NULL,
  purpose public.presence_capability_purpose NOT NULL,
  state public.presence_capability_state NOT NULL DEFAULT 'active',
  snapshot_digest varchar(64) NOT NULL,
  avatar_projection_digest varchar(64) NOT NULL,
  viewer_lease_id uuid NOT NULL REFERENCES public.presence_leases(id) ON DELETE CASCADE,
  subject_lease_id uuid NOT NULL REFERENCES public.presence_leases(id) ON DELETE CASCADE,
  issued_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  revocation_reason varchar(64),
  consumed_at timestamptz,
  CONSTRAINT presence_capabilities_snapshot_key UNIQUE (
    viewer_account_id, snapshot_digest, subject_account_id, purpose
  ),
  CONSTRAINT presence_capabilities_token_check CHECK (token_digest ~ '^[0-9a-f]{64}$'),
  CONSTRAINT presence_capabilities_snapshot_check CHECK (snapshot_digest ~ '^[0-9a-f]{64}$'),
  CONSTRAINT presence_capabilities_avatar_projection_check CHECK (
    avatar_projection_digest ~ '^[0-9a-f]{64}$'
  ),
  CONSTRAINT presence_capabilities_state_check CHECK (
    (state = 'active' AND revoked_at IS NULL)
    OR (state IN ('revoked', 'consumed') AND revoked_at IS NOT NULL)
  ),
  CONSTRAINT presence_capabilities_expiry_check CHECK (
    expires_at > issued_at AND expires_at <= issued_at + interval '15 minutes'
  ),
  CONSTRAINT presence_capabilities_pair_check CHECK (
    viewer_account_id <> subject_account_id AND viewer_lease_id <> subject_lease_id
  )
);
CREATE INDEX presence_capabilities_expiry_idx
  ON public.presence_capabilities (expires_at);
CREATE INDEX presence_capabilities_pair_idx
  ON public.presence_capabilities (viewer_account_id, subject_account_id);

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

-- PostgreSQL 17 grants a non-superuser CREATEROLE principal ADMIN TRUE but
-- SET FALSE on a role it creates. Ownership transfer requires SET TRUE and
-- CREATE on the containing schema. Both capabilities are transaction-local:
-- the migration fails closed if they cannot be granted or fully removed.
GRANT wetindey_presence_owner TO SESSION_USER WITH INHERIT FALSE;
GRANT wetindey_presence_owner TO SESSION_USER WITH SET TRUE;
GRANT CREATE ON SCHEMA public TO wetindey_presence_owner;

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


-- 0014 capability security. Capabilities are digest-keyed, short-lived, and
-- never directly readable by runtime, safety, lifecycle, or PUBLIC.
ALTER TABLE public.presence_activation_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.presence_activation_requests FORCE ROW LEVEL SECURITY;
ALTER TABLE public.presence_capabilities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.presence_capabilities FORCE ROW LEVEL SECURITY;

CREATE POLICY presence_activation_requests_owner_policy ON public.presence_activation_requests
  FOR ALL TO wetindey_presence_owner USING (true) WITH CHECK (true);
CREATE POLICY presence_capabilities_owner_policy ON public.presence_capabilities
  FOR ALL TO wetindey_presence_owner USING (true) WITH CHECK (true);

REVOKE ALL ON TABLE
  public.presence_activation_requests,
  public.presence_capabilities
FROM PUBLIC, wetindey_presence_runtime, wetindey_presence_safety,
  wetindey_presence_lifecycle;

REVOKE USAGE ON TYPE
  public.presence_activation_status,
  public.presence_capability_purpose,
  public.presence_capability_state
FROM PUBLIC, wetindey_presence_runtime, wetindey_presence_safety,
  wetindey_presence_lifecycle;

REVOKE EXECUTE ON FUNCTION public.presence_set_preferences(
  uuid, boolean, boolean, text, text
) FROM wetindey_presence_runtime;
REVOKE EXECUTE ON FUNCTION public.presence_activate(
  uuid, integer, integer, text, text, text
) FROM wetindey_presence_runtime;
REVOKE EXECUTE ON FUNCTION public.presence_stop(uuid) FROM wetindey_presence_runtime;
REVOKE EXECUTE ON FUNCTION public.presence_snapshot(uuid, text, text, text)
  FROM wetindey_presence_runtime;
REVOKE EXECUTE ON FUNCTION public.presence_wave(
  uuid, uuid, text, text, text, text
) FROM wetindey_presence_runtime;
REVOKE EXECUTE ON FUNCTION public.presence_block(uuid, uuid)
  FROM wetindey_presence_runtime;
REVOKE EXECUTE ON FUNCTION public.presence_report(
  uuid, uuid, public.presence_report_kind, text, text, text, text
) FROM wetindey_presence_runtime;

REVOKE ALL ON FUNCTION public.presence_v2_digest(text)
  FROM PUBLIC, wetindey_presence_runtime, wetindey_presence_safety,
    wetindey_presence_lifecycle;
REVOKE ALL ON FUNCTION public.presence_v2_pair_lock(uuid, uuid)
  FROM PUBLIC, wetindey_presence_runtime, wetindey_presence_safety,
    wetindey_presence_lifecycle;
REVOKE ALL ON FUNCTION public.presence_v2_revoke_account(uuid, text)
  FROM PUBLIC, wetindey_presence_runtime, wetindey_presence_safety,
    wetindey_presence_lifecycle;
REVOKE ALL ON FUNCTION public.presence_v2_revoke_pair(uuid, uuid, text)
  FROM PUBLIC, wetindey_presence_runtime, wetindey_presence_safety,
    wetindey_presence_lifecycle;
REVOKE ALL ON FUNCTION public.presence_v2_lease_revoke_trigger()
  FROM PUBLIC, wetindey_presence_runtime, wetindey_presence_safety,
    wetindey_presence_lifecycle;
REVOKE ALL ON FUNCTION public.presence_v2_issue_capability(
  uuid, uuid, public.presence_capability_purpose, text, text, uuid, uuid, timestamptz
) FROM PUBLIC, wetindey_presence_runtime, wetindey_presence_safety,
  wetindey_presence_lifecycle;

REVOKE ALL ON FUNCTION public.presence_set_preferences_v2(uuid, boolean, boolean, boolean, text)
  FROM PUBLIC;
REVOKE ALL ON FUNCTION public.presence_activate_v2(uuid, text, integer, integer, text, text, text)
  FROM PUBLIC;
REVOKE ALL ON FUNCTION public.presence_stop_v2(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.presence_snapshot_v2(uuid, text, text, text)
  FROM PUBLIC;
REVOKE ALL ON FUNCTION public.presence_wave_v2(uuid, text, text, text, text, text)
  FROM PUBLIC;
REVOKE ALL ON FUNCTION public.presence_block_v2(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.presence_report_v2(
  uuid, text, text, public.presence_report_kind, text, text, text, text
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.presence_set_preferences_v2(
  uuid, boolean, boolean, boolean, text
) TO wetindey_presence_runtime;
GRANT EXECUTE ON FUNCTION public.presence_activate_v2(
  uuid, text, integer, integer, text, text, text
) TO wetindey_presence_runtime;
GRANT EXECUTE ON FUNCTION public.presence_stop_v2(uuid)
  TO wetindey_presence_runtime;
GRANT EXECUTE ON FUNCTION public.presence_snapshot_v2(
  uuid, text, text, text
) TO wetindey_presence_runtime;
GRANT EXECUTE ON FUNCTION public.presence_wave_v2(
  uuid, text, text, text, text, text
) TO wetindey_presence_runtime;
GRANT EXECUTE ON FUNCTION public.presence_block_v2(uuid, text)
  TO wetindey_presence_runtime;
GRANT EXECUTE ON FUNCTION public.presence_report_v2(
  uuid, text, text, public.presence_report_kind, text, text, text, text
) TO wetindey_presence_runtime;

GRANT USAGE ON TYPE public.presence_report_kind TO wetindey_presence_runtime;

CREATE OR REPLACE TRIGGER presence_v2_lease_revoke_trigger
BEFORE DELETE ON public.presence_leases
FOR EACH ROW EXECUTE FUNCTION public.presence_v2_lease_revoke_trigger();

ALTER TABLE public.presence_activation_requests OWNER TO wetindey_presence_owner;
ALTER TABLE public.presence_capabilities OWNER TO wetindey_presence_owner;
ALTER TYPE public.presence_activation_status OWNER TO wetindey_presence_owner;
ALTER TYPE public.presence_capability_purpose OWNER TO wetindey_presence_owner;
ALTER TYPE public.presence_capability_state OWNER TO wetindey_presence_owner;

ALTER FUNCTION public.presence_v2_digest(text) OWNER TO wetindey_presence_owner;
ALTER FUNCTION public.presence_v2_pair_lock(uuid, uuid) OWNER TO wetindey_presence_owner;
ALTER FUNCTION public.presence_v2_revoke_account(uuid, text) OWNER TO wetindey_presence_owner;
ALTER FUNCTION public.presence_v2_revoke_pair(uuid, uuid, text) OWNER TO wetindey_presence_owner;
ALTER FUNCTION public.presence_v2_lease_revoke_trigger() OWNER TO wetindey_presence_owner;
ALTER FUNCTION public.presence_v2_issue_capability(
  uuid, uuid, public.presence_capability_purpose, text, text, uuid, uuid, timestamptz
) OWNER TO wetindey_presence_owner;
ALTER FUNCTION public.presence_set_preferences_v2(uuid, boolean, boolean, boolean, text)
  OWNER TO wetindey_presence_owner;
ALTER FUNCTION public.presence_activate_v2(uuid, text, integer, integer, text, text, text)
  OWNER TO wetindey_presence_owner;
ALTER FUNCTION public.presence_stop_v2(uuid) OWNER TO wetindey_presence_owner;
ALTER FUNCTION public.presence_snapshot_v2(uuid, text, text, text)
  OWNER TO wetindey_presence_owner;
ALTER FUNCTION public.presence_wave_v2(uuid, text, text, text, text, text)
  OWNER TO wetindey_presence_owner;
ALTER FUNCTION public.presence_block_v2(uuid, text) OWNER TO wetindey_presence_owner;
ALTER FUNCTION public.presence_report_v2(
  uuid, text, text, public.presence_report_kind, text, text, text, text
) OWNER TO wetindey_presence_owner;

REVOKE CREATE ON SCHEMA public FROM wetindey_presence_owner;
REVOKE wetindey_presence_owner FROM SESSION_USER
  GRANTED BY SESSION_USER;

DO $$
BEGIN
  IF pg_has_role(session_user, 'wetindey_presence_owner', 'SET') THEN
    RAISE EXCEPTION '0014 migration principal retains a SET path to presence owner'
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
    RAISE EXCEPTION '0014 migration principal retains owner membership'
      USING ERRCODE = '42501';
  END IF;
  IF has_schema_privilege('wetindey_presence_owner', 'public', 'CREATE') THEN
    RAISE EXCEPTION '0014 presence owner retains CREATE on public schema'
      USING ERRCODE = '42501';
  END IF;
END;
$$;
