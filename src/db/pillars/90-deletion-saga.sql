-- ADR-021 P1 least-privilege boundary for the deletion saga. These are cluster
-- roles, not application identities. The runtime still derives the account from
-- the authenticated server session; browser payloads never choose a principal.
-- This pillar owns NO tables, types, or functions: the deletion_requests and
-- deletion_audit tables and the deletion_phase / deletion_outcome types are
-- created by the generated DDL that precedes this block in 0018. The
-- compare-and-set phase primitive lives in application code (src/lib/deletion),
-- not in a database function, so P1 installs no SECURITY DEFINER service here.
-- The boundary is sealed owner-only and fails closed: the runtime and worker
-- roles are declared for later phases and receive no direct table access in P1.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'wetindey_deletion_owner') THEN
    CREATE ROLE wetindey_deletion_owner NOLOGIN NOBYPASSRLS;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'wetindey_deletion_runtime') THEN
    CREATE ROLE wetindey_deletion_runtime NOLOGIN NOBYPASSRLS;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'wetindey_deletion_worker') THEN
    CREATE ROLE wetindey_deletion_worker NOLOGIN NOBYPASSRLS;
  END IF;
END;
$$;

ALTER ROLE wetindey_deletion_owner NOLOGIN NOBYPASSRLS;
ALTER ROLE wetindey_deletion_runtime NOLOGIN NOBYPASSRLS;
ALTER ROLE wetindey_deletion_worker NOLOGIN NOBYPASSRLS;

-- PostgreSQL 17 grants a non-superuser CREATEROLE principal ADMIN TRUE but
-- SET FALSE on a role it creates. Ownership transfer requires SET TRUE and
-- CREATE on the containing schema. Both capabilities are transaction-local:
-- the migration fails closed if they cannot be granted or fully removed.
GRANT wetindey_deletion_owner TO SESSION_USER WITH INHERIT FALSE;
GRANT wetindey_deletion_owner TO SESSION_USER WITH SET TRUE;
GRANT CREATE ON SCHEMA public TO wetindey_deletion_owner;
SET LOCAL ROLE wetindey_deletion_owner;

ALTER TABLE public.deletion_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deletion_requests FORCE ROW LEVEL SECURITY;
ALTER TABLE public.deletion_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deletion_audit FORCE ROW LEVEL SECURITY;

CREATE POLICY deletion_requests_owner_policy ON public.deletion_requests
  FOR ALL TO wetindey_deletion_owner USING (true) WITH CHECK (true);
CREATE POLICY deletion_audit_owner_policy ON public.deletion_audit
  FOR ALL TO wetindey_deletion_owner USING (true) WITH CHECK (true);

-- Fail closed: no service role receives any direct table privilege in P1.
-- Combined with FORCE ROW LEVEL SECURITY and the owner-only policies above,
-- runtime and worker are denied every row until a later phase grants a scoped
-- service boundary.
REVOKE ALL ON TABLE
  public.deletion_requests,
  public.deletion_audit
FROM PUBLIC, wetindey_deletion_runtime, wetindey_deletion_worker;

REVOKE USAGE ON TYPE
  public.deletion_phase,
  public.deletion_outcome
FROM PUBLIC;

-- Schema and enum-type USAGE only. The service roles can name the phase and
-- outcome types for later scoped functions; they hold no table access in P1.
GRANT USAGE ON SCHEMA public
  TO wetindey_deletion_runtime, wetindey_deletion_worker;
GRANT USAGE ON TYPE
  public.deletion_phase,
  public.deletion_outcome
TO wetindey_deletion_runtime, wetindey_deletion_worker;

-- Transfer ownership last. The migration role creates the policies while it
-- still owns the objects; runtime and worker never acquire direct table
-- privileges or ownership.
ALTER TABLE public.deletion_requests OWNER TO wetindey_deletion_owner;
ALTER TABLE public.deletion_audit OWNER TO wetindey_deletion_owner;

ALTER TYPE public.deletion_phase OWNER TO wetindey_deletion_owner;
ALTER TYPE public.deletion_outcome OWNER TO wetindey_deletion_owner;

RESET ROLE;
REVOKE CREATE ON SCHEMA public FROM wetindey_deletion_owner;
REVOKE wetindey_deletion_owner FROM SESSION_USER
  GRANTED BY SESSION_USER;

DO $$
BEGIN
  IF pg_has_role(session_user, 'wetindey_deletion_owner', 'SET') THEN
    RAISE EXCEPTION '0018 migration principal retains a SET path to deletion owner'
      USING ERRCODE = '42501';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM pg_auth_members membership
    JOIN pg_roles granted_role ON granted_role.oid = membership.roleid
    JOIN pg_roles member_role ON member_role.oid = membership.member
    WHERE granted_role.rolname = 'wetindey_deletion_owner'
      AND member_role.rolname = session_user
      AND (membership.set_option OR membership.inherit_option)
  ) THEN
    RAISE EXCEPTION '0018 migration principal retains deletion owner membership'
      USING ERRCODE = '42501';
  END IF;
  IF has_schema_privilege('wetindey_deletion_owner', 'public', 'CREATE') THEN
    RAISE EXCEPTION '0018 deletion owner retains CREATE on public schema'
      USING ERRCODE = '42501';
  END IF;
END;
$$;
