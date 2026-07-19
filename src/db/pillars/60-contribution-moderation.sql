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
