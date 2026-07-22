-- 0017 forward-only result-shape repair for the immutable applied contribution
-- moderation service. PostgreSQL requires each RETURN QUERY expression to match
-- the declared TABLE result exactly; the persisted varchar values therefore cast
-- to the declared text result columns without changing queue semantics or ACLs.

CREATE TEMP TABLE pg_temp.wetindey_0017_owner_membership_baseline
ON COMMIT DROP
AS
SELECT
  membership.grantor,
  membership.admin_option,
  membership.inherit_option,
  membership.set_option
FROM pg_catalog.pg_auth_members membership
JOIN pg_catalog.pg_roles granted_role ON granted_role.oid = membership.roleid
JOIN pg_catalog.pg_roles member_role ON member_role.oid = membership.member
WHERE granted_role.rolname = 'wetindey_contribution_owner'
  AND member_role.rolname = session_user;

CREATE TEMP TABLE pg_temp.wetindey_0017_owner_state_baseline
ON COMMIT DROP
AS
SELECT
  pg_has_role(session_user, 'wetindey_contribution_owner', 'MEMBER') AS member_state,
  pg_has_role(session_user, 'wetindey_contribution_owner', 'USAGE') AS usage_state,
  pg_has_role(session_user, 'wetindey_contribution_owner', 'SET') AS set_state,
  has_schema_privilege(
    'wetindey_contribution_owner',
    'public',
    'CREATE'
  ) AS owner_schema_create;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_temp.wetindey_0017_owner_state_baseline baseline
    WHERE baseline.usage_state
      OR baseline.set_state
      OR baseline.owner_schema_create
  ) THEN
    RAISE EXCEPTION '0017 baseline already permits owner usage, set, or schema create'
      USING ERRCODE = '42501';
  END IF;
END;
$$;

GRANT wetindey_contribution_owner TO SESSION_USER WITH INHERIT FALSE;
GRANT wetindey_contribution_owner TO SESSION_USER WITH SET TRUE;
GRANT CREATE ON SCHEMA public TO wetindey_contribution_owner;
SET LOCAL ROLE wetindey_contribution_owner;

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
    observation.availability_state::text,
    observation.price_amount,
    observation.observed_at,
    observation.collection_method::text,
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

RESET ROLE;
REVOKE CREATE ON SCHEMA public FROM wetindey_contribution_owner;
REVOKE wetindey_contribution_owner FROM SESSION_USER GRANTED BY SESSION_USER;

DO $$
BEGIN
  IF (
    SELECT procedure.proowner
    FROM pg_catalog.pg_proc procedure
    WHERE procedure.oid = 'public.contribution_pending_queue(uuid, integer)'::regprocedure
  ) IS DISTINCT FROM 'wetindey_contribution_owner'::regrole THEN
    RAISE EXCEPTION 'contribution pending-queue owner is not the dedicated owner role'
      USING ERRCODE = '42501';
  END IF;

  IF NOT has_function_privilege(
    'wetindey_contribution_owner',
    'public.contribution_pending_queue(uuid, integer)',
    'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'contribution owner lost pending-queue execute'
      USING ERRCODE = '42501';
  END IF;

  IF NOT has_function_privilege(
    'wetindey_contribution_moderator',
    'public.contribution_pending_queue(uuid, integer)',
    'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'contribution moderator lacks pending-queue execute'
      USING ERRCODE = '42501';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_catalog.pg_proc procedure
    CROSS JOIN LATERAL pg_catalog.aclexplode(
      COALESCE(procedure.proacl, pg_catalog.acldefault('f', procedure.proowner))
    ) privilege
    WHERE procedure.oid = 'public.contribution_pending_queue(uuid, integer)'::regprocedure
      AND privilege.privilege_type = 'EXECUTE'
      AND privilege.grantee NOT IN (
        procedure.proowner,
        'wetindey_contribution_moderator'::regrole
      )
  ) THEN
    RAISE EXCEPTION 'pending-queue execute escaped owner and moderator roles'
      USING ERRCODE = '42501';
  END IF;

  IF EXISTS (
    WITH current_membership AS (
      SELECT
        membership.grantor,
        membership.admin_option,
        membership.inherit_option,
        membership.set_option
      FROM pg_catalog.pg_auth_members membership
      JOIN pg_catalog.pg_roles granted_role ON granted_role.oid = membership.roleid
      JOIN pg_catalog.pg_roles member_role ON member_role.oid = membership.member
      WHERE granted_role.rolname = 'wetindey_contribution_owner'
        AND member_role.rolname = session_user
    ),
    membership_difference AS (
      (
        SELECT grantor, admin_option, inherit_option, set_option
        FROM pg_temp.wetindey_0017_owner_membership_baseline
        EXCEPT
        SELECT grantor, admin_option, inherit_option, set_option
        FROM current_membership
      )
      UNION ALL
      (
        SELECT grantor, admin_option, inherit_option, set_option
        FROM current_membership
        EXCEPT
        SELECT grantor, admin_option, inherit_option, set_option
        FROM pg_temp.wetindey_0017_owner_membership_baseline
      )
    )
    SELECT 1
    FROM membership_difference
  ) THEN
    RAISE EXCEPTION '0017 did not restore the exact direct owner membership baseline'
      USING ERRCODE = '42501';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_temp.wetindey_0017_owner_state_baseline baseline
    WHERE baseline.member_state IS DISTINCT FROM
        pg_has_role(session_user, 'wetindey_contribution_owner', 'MEMBER')
      OR baseline.usage_state IS DISTINCT FROM
        pg_has_role(session_user, 'wetindey_contribution_owner', 'USAGE')
      OR baseline.set_state IS DISTINCT FROM
        pg_has_role(session_user, 'wetindey_contribution_owner', 'SET')
      OR baseline.owner_schema_create IS DISTINCT FROM
        has_schema_privilege(
          'wetindey_contribution_owner',
          'public',
          'CREATE'
        )
  ) THEN
    RAISE EXCEPTION '0017 did not restore the exact owner capability baseline'
      USING ERRCODE = '42501';
  END IF;
END;
$$;
