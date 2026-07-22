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

-- Moderator-only detail for the operations review surface. This is deliberately
-- narrower than the audit service: it carries the decision facts needed to
-- review or reverse a decision, never contributor identity, contact, precise
-- location, request/digest material, raw payload, or freeform evidence notes.
CREATE OR REPLACE FUNCTION public.contribution_review_detail(
  p_actor uuid,
  p_observation_id uuid
)
RETURNS TABLE (
  observation_id uuid,
  item_id uuid,
  item_variant_id uuid,
  unit_id uuid,
  place_id uuid,
  item_label text,
  variant_label text,
  unit_label text,
  place_label text,
  availability_state text,
  price_amount integer,
  observed_at timestamp,
  submitted_at timestamp,
  collection_method text,
  corrects_observation_id uuid,
  attributed boolean,
  has_decision_history boolean,
  reopened_after_reversal boolean,
  effective_decision_id uuid,
  effective_decision_type text,
  effective_decision_reason_code text,
  effective_decision_at timestamptz,
  actor_made_effective_decision boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
BEGIN
  PERFORM public.contribution_assert_moderator(p_actor);

  IF p_observation_id IS NULL THEN
    RAISE EXCEPTION 'review observation is required' USING ERRCODE = '22023';
  END IF;

  RETURN QUERY
  SELECT
    observation.id,
    item.id,
    observation.item_variant_id,
    observation.unit_id,
    observation.place_id,
    item.canonical_name::text,
    variant.display_name::text,
    unit.display_name::text,
    place.name::text,
    observation.availability_state,
    observation.price_amount,
    observation.observed_at,
    observation.submitted_at,
    observation.collection_method,
    observation.corrects_observation_id,
    source.user_id IS NOT NULL,
    COALESCE(history.has_decision_history, false),
    COALESCE(history.reopened_after_reversal, false),
    decision.id,
    decision.decision::text,
    decision.reason_code,
    decision.created_at,
    COALESCE(decision.actor_account_id = p_actor, false)
  FROM public.observations observation
  JOIN public.item_variants variant ON variant.id = observation.item_variant_id
  JOIN public.items item ON item.id = variant.item_id
  JOIN public.units unit ON unit.id = observation.unit_id
  JOIN public.places place ON place.id = observation.place_id
  JOIN public.sources source ON source.id = observation.source_id
  LEFT JOIN LATERAL (
    SELECT
      EXISTS (
        SELECT 1
        FROM public.contribution_moderation_decisions decision_history
        WHERE decision_history.observation_id = observation.id
      ) AS has_decision_history,
      (
        public.contribution_effective_decision_id(observation.id) IS NULL
        AND EXISTS (
          SELECT 1
          FROM public.contribution_moderation_decisions reversal
          WHERE reversal.observation_id = observation.id
            AND reversal.decision = 'reverse'
        )
      ) AS reopened_after_reversal
  ) history ON true
  LEFT JOIN public.contribution_moderation_decisions decision
    ON decision.id = public.contribution_effective_decision_id(observation.id)
  WHERE observation.id = p_observation_id
    AND observation.admission_id IS NOT NULL;
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
