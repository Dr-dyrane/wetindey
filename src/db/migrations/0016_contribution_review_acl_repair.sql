-- 0016 forward-only repair for the immutable applied 0015 moderation service.
-- 0015 reset the owner role before its function ACL statements, so PostgreSQL
-- retained PUBLIC EXECUTE. Reconcile only that ACL while the dedicated owner is
-- active; do not replace the service or alter its data contract.

GRANT wetindey_contribution_owner TO SESSION_USER WITH INHERIT FALSE;
GRANT wetindey_contribution_owner TO SESSION_USER WITH SET TRUE;
GRANT CREATE ON SCHEMA public TO wetindey_contribution_owner;
SET LOCAL ROLE wetindey_contribution_owner;

REVOKE ALL ON FUNCTION public.contribution_review_detail(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.contribution_review_detail(uuid, uuid)
  TO wetindey_contribution_owner, wetindey_contribution_moderator;

RESET ROLE;
REVOKE CREATE ON SCHEMA public FROM wetindey_contribution_owner;
REVOKE wetindey_contribution_owner FROM SESSION_USER GRANTED BY SESSION_USER;

DO $$
BEGIN
  IF NOT has_function_privilege(
    'wetindey_contribution_owner',
    'public.contribution_review_detail(uuid, uuid)',
    'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'contribution owner lost review-detail execute'
      USING ERRCODE = '42501';
  END IF;

  IF NOT has_function_privilege(
    'wetindey_contribution_moderator',
    'public.contribution_review_detail(uuid, uuid)',
    'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'contribution moderator lacks review-detail execute'
      USING ERRCODE = '42501';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_catalog.pg_proc procedure
    CROSS JOIN LATERAL pg_catalog.aclexplode(
      COALESCE(procedure.proacl, pg_catalog.acldefault('f', procedure.proowner))
    ) privilege
    WHERE procedure.oid = 'public.contribution_review_detail(uuid, uuid)'::regprocedure
      AND privilege.privilege_type = 'EXECUTE'
      AND privilege.grantee NOT IN (
        procedure.proowner,
        'wetindey_contribution_moderator'::regrole
      )
  ) THEN
    RAISE EXCEPTION 'review-detail execute escaped owner and moderator roles'
      USING ERRCODE = '42501';
  END IF;

  IF pg_has_role(session_user, 'wetindey_contribution_owner', 'SET') THEN
    RAISE EXCEPTION 'migration principal retains a SET path to the contribution owner'
      USING ERRCODE = '42501';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_catalog.pg_auth_members membership
    JOIN pg_catalog.pg_roles granted_role ON granted_role.oid = membership.roleid
    JOIN pg_catalog.pg_roles member_role ON member_role.oid = membership.member
    WHERE granted_role.rolname = 'wetindey_contribution_owner'
      AND member_role.rolname = session_user
      AND (membership.set_option OR membership.inherit_option)
  ) THEN
    RAISE EXCEPTION 'migration principal retains privileged contribution owner membership'
      USING ERRCODE = '42501';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_catalog.pg_auth_members membership
    JOIN pg_catalog.pg_roles granted_role ON granted_role.oid = membership.roleid
    JOIN pg_catalog.pg_roles member_role ON member_role.oid = membership.member
    JOIN pg_catalog.pg_roles grantor_role ON grantor_role.oid = membership.grantor
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
