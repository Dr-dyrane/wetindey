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
