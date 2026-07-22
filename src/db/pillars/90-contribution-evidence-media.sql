-- ADR-028 P1 least-privilege boundary for contribution evidence-media. These
-- are cluster roles, not application identities. The runtime still derives the
-- account from the authenticated server session; browser payloads never choose
-- a principal. This pillar owns NO tables, types, or functions: the
-- contribution_evidence_media table and the evidence_media_state type are
-- created by the generated DDL that precedes this block in 0019. The sanitizer,
-- the private Blob adapter, the deterministic key layout, and the fail-closed
-- admission live in application code (src/lib/evidence-media), not in a database
-- function, so P1 installs no SECURITY DEFINER service here. The boundary is
-- sealed owner-only and fails closed: the runtime and worker roles are declared
-- for later phases and receive no direct table access in P1. Evidence media is
-- PRIVATE and never public; nothing here grants read to any application role.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'wetindey_evidence_media_owner') THEN
    CREATE ROLE wetindey_evidence_media_owner NOLOGIN NOBYPASSRLS;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'wetindey_evidence_media_runtime') THEN
    CREATE ROLE wetindey_evidence_media_runtime NOLOGIN NOBYPASSRLS;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'wetindey_evidence_media_worker') THEN
    CREATE ROLE wetindey_evidence_media_worker NOLOGIN NOBYPASSRLS;
  END IF;
END;
$$;

ALTER ROLE wetindey_evidence_media_owner NOLOGIN NOBYPASSRLS;
ALTER ROLE wetindey_evidence_media_runtime NOLOGIN NOBYPASSRLS;
ALTER ROLE wetindey_evidence_media_worker NOLOGIN NOBYPASSRLS;

-- PostgreSQL 17 grants a non-superuser CREATEROLE principal ADMIN TRUE but
-- SET FALSE on a role it creates. Ownership transfer requires SET TRUE and
-- CREATE on the containing schema. Both capabilities are transaction-local:
-- the migration fails closed if they cannot be granted or fully removed.
GRANT wetindey_evidence_media_owner TO SESSION_USER WITH INHERIT FALSE;
GRANT wetindey_evidence_media_owner TO SESSION_USER WITH SET TRUE;
GRANT CREATE ON SCHEMA public TO wetindey_evidence_media_owner;
SET LOCAL ROLE wetindey_evidence_media_owner;

ALTER TABLE public.contribution_evidence_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contribution_evidence_media FORCE ROW LEVEL SECURITY;

CREATE POLICY contribution_evidence_media_owner_policy ON public.contribution_evidence_media
  FOR ALL TO wetindey_evidence_media_owner USING (true) WITH CHECK (true);

-- Fail closed: no service role receives any direct table privilege in P1.
-- Combined with FORCE ROW LEVEL SECURITY and the owner-only policy above,
-- runtime and worker are denied every row until a later phase grants a scoped
-- service boundary. Evidence media stays private; there is no public read grant.
REVOKE ALL ON TABLE
  public.contribution_evidence_media
FROM PUBLIC, wetindey_evidence_media_runtime, wetindey_evidence_media_worker;

REVOKE USAGE ON TYPE
  public.evidence_media_state
FROM PUBLIC;

-- Schema and enum-type USAGE only. The service roles can name the state type for
-- later scoped functions; they hold no table access in P1.
GRANT USAGE ON SCHEMA public
  TO wetindey_evidence_media_runtime, wetindey_evidence_media_worker;
GRANT USAGE ON TYPE
  public.evidence_media_state
TO wetindey_evidence_media_runtime, wetindey_evidence_media_worker;

-- Transfer ownership last. The migration role creates the policy while it still
-- owns the objects; runtime and worker never acquire direct table privileges or
-- ownership.
ALTER TABLE public.contribution_evidence_media OWNER TO wetindey_evidence_media_owner;

ALTER TYPE public.evidence_media_state OWNER TO wetindey_evidence_media_owner;

RESET ROLE;
REVOKE CREATE ON SCHEMA public FROM wetindey_evidence_media_owner;
REVOKE wetindey_evidence_media_owner FROM SESSION_USER
  GRANTED BY SESSION_USER;

DO $$
BEGIN
  IF pg_has_role(session_user, 'wetindey_evidence_media_owner', 'SET') THEN
    RAISE EXCEPTION '0019 migration principal retains a SET path to evidence-media owner'
      USING ERRCODE = '42501';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM pg_auth_members membership
    JOIN pg_roles granted_role ON granted_role.oid = membership.roleid
    JOIN pg_roles member_role ON member_role.oid = membership.member
    WHERE granted_role.rolname = 'wetindey_evidence_media_owner'
      AND member_role.rolname = session_user
      AND (membership.set_option OR membership.inherit_option)
  ) THEN
    RAISE EXCEPTION '0019 migration principal retains evidence-media owner membership'
      USING ERRCODE = '42501';
  END IF;
  IF has_schema_privilege('wetindey_evidence_media_owner', 'public', 'CREATE') THEN
    RAISE EXCEPTION '0019 evidence-media owner retains CREATE on public schema'
      USING ERRCODE = '42501';
  END IF;
END;
$$;
