-- 0015 forward-only ADR-019 moderation-operations read service. The 0000-0014
-- ledger is immutable; this introduces no table, type, policy, or direct-grant
-- change. PostgreSQL 17 ownership choreography is transaction-scoped and
-- fail-closed so the service is owned by the dedicated definer without leaving
-- the migration principal a path to that role.

GRANT wetindey_contribution_owner TO SESSION_USER WITH INHERIT FALSE;
GRANT wetindey_contribution_owner TO SESSION_USER WITH SET TRUE;
GRANT CREATE ON SCHEMA public TO wetindey_contribution_owner;
SET LOCAL ROLE wetindey_contribution_owner;

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

RESET ROLE;

REVOKE ALL ON FUNCTION public.contribution_review_detail(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.contribution_review_detail(uuid, uuid)
  TO wetindey_contribution_moderator;
ALTER FUNCTION public.contribution_review_detail(uuid, uuid)
  OWNER TO wetindey_contribution_owner;

REVOKE CREATE ON SCHEMA public FROM wetindey_contribution_owner;
REVOKE wetindey_contribution_owner FROM SESSION_USER GRANTED BY SESSION_USER;

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
