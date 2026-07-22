-- Least-privilege ADR-019 boundary. Application identities receive EXECUTE on
-- narrowly scoped SECURITY DEFINER services, never direct contribution-table
-- privileges. The later Server Action owns session and digest derivation.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'wetindey_contribution_owner') THEN
    CREATE ROLE wetindey_contribution_owner NOLOGIN NOBYPASSRLS;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'wetindey_contribution_runtime') THEN
    CREATE ROLE wetindey_contribution_runtime NOLOGIN NOBYPASSRLS;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'wetindey_contribution_moderator') THEN
    CREATE ROLE wetindey_contribution_moderator NOLOGIN NOBYPASSRLS;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'wetindey_contribution_control') THEN
    CREATE ROLE wetindey_contribution_control NOLOGIN NOBYPASSRLS;
  END IF;
END;
$$;

ALTER ROLE wetindey_contribution_owner NOLOGIN NOBYPASSRLS;
ALTER ROLE wetindey_contribution_runtime NOLOGIN NOBYPASSRLS;
ALTER ROLE wetindey_contribution_moderator NOLOGIN NOBYPASSRLS;
ALTER ROLE wetindey_contribution_control NOLOGIN NOBYPASSRLS;

-- PostgreSQL 17 requires SET TRUE for a non-superuser migration principal to
-- transfer ownership. Both this membership and schema CREATE are removed and
-- independently asserted absent before the migration can commit.
GRANT wetindey_contribution_owner TO SESSION_USER WITH INHERIT FALSE;
GRANT wetindey_contribution_owner TO SESSION_USER WITH SET TRUE;
GRANT CREATE ON SCHEMA public TO wetindey_contribution_owner;

ALTER TABLE public.contribution_control ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contribution_control FORCE ROW LEVEL SECURITY;
ALTER TABLE public.contribution_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contribution_requests FORCE ROW LEVEL SECURITY;
ALTER TABLE public.contribution_rate_buckets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contribution_rate_buckets FORCE ROW LEVEL SECURITY;
ALTER TABLE public.contribution_moderator_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contribution_moderator_assignments FORCE ROW LEVEL SECURITY;
ALTER TABLE public.contribution_moderation_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contribution_moderation_decisions FORCE ROW LEVEL SECURITY;
ALTER TABLE public.contribution_audit_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contribution_audit_events FORCE ROW LEVEL SECURITY;
ALTER TABLE public.contribution_projections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contribution_projections FORCE ROW LEVEL SECURITY;

CREATE POLICY contribution_control_owner_policy ON public.contribution_control
  FOR ALL TO wetindey_contribution_owner USING (true) WITH CHECK (true);
CREATE POLICY contribution_requests_owner_policy ON public.contribution_requests
  FOR ALL TO wetindey_contribution_owner USING (true) WITH CHECK (true);
CREATE POLICY contribution_rate_buckets_owner_policy ON public.contribution_rate_buckets
  FOR ALL TO wetindey_contribution_owner USING (true) WITH CHECK (true);
CREATE POLICY contribution_assignments_owner_policy
  ON public.contribution_moderator_assignments
  FOR ALL TO wetindey_contribution_owner USING (true) WITH CHECK (true);
CREATE POLICY contribution_decisions_owner_policy
  ON public.contribution_moderation_decisions
  FOR ALL TO wetindey_contribution_owner USING (true) WITH CHECK (true);
CREATE POLICY contribution_audit_owner_policy ON public.contribution_audit_events
  FOR ALL TO wetindey_contribution_owner USING (true) WITH CHECK (true);
CREATE POLICY contribution_projections_owner_policy ON public.contribution_projections
  FOR ALL TO wetindey_contribution_owner USING (true) WITH CHECK (true);

REVOKE ALL ON TABLE
  public.contribution_control,
  public.contribution_requests,
  public.contribution_rate_buckets,
  public.contribution_moderator_assignments,
  public.contribution_moderation_decisions,
  public.contribution_audit_events,
  public.contribution_projections
FROM PUBLIC, wetindey_contribution_runtime, wetindey_contribution_moderator,
  wetindey_contribution_control;

REVOKE ALL ON FUNCTION public.contribution_assert_digest(text, text)
  FROM PUBLIC, wetindey_contribution_runtime, wetindey_contribution_moderator,
    wetindey_contribution_control;
REVOKE ALL ON FUNCTION public.contribution_forbid_append_only_mutation()
  FROM PUBLIC, wetindey_contribution_runtime, wetindey_contribution_moderator,
    wetindey_contribution_control;
REVOKE ALL ON FUNCTION public.contribution_protect_admitted_observation()
  FROM PUBLIC, wetindey_contribution_runtime, wetindey_contribution_moderator,
    wetindey_contribution_control;
REVOKE ALL ON FUNCTION public.contribution_assert_moderator(uuid)
  FROM PUBLIC, wetindey_contribution_runtime, wetindey_contribution_moderator,
    wetindey_contribution_control;
REVOKE ALL ON FUNCTION public.contribution_effective_decision_id(uuid)
  FROM PUBLIC, wetindey_contribution_runtime, wetindey_contribution_moderator,
    wetindey_contribution_control;
REVOKE ALL ON FUNCTION public.contribution_recompute_projection_internal(uuid, uuid, uuid)
  FROM PUBLIC, wetindey_contribution_runtime, wetindey_contribution_moderator,
    wetindey_contribution_control;

REVOKE ALL ON FUNCTION public.contribution_admit(
  public.contribution_operation, uuid, text, text, text, uuid, uuid, uuid,
  uuid, text, integer, timestamp, boolean, uuid
) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.contribution_moderate(
  uuid, uuid, text, uuid, public.contribution_decision, text, uuid
) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.contribution_pending_queue(uuid, integer)
  FROM PUBLIC;
REVOKE ALL ON FUNCTION public.contribution_audit_for_observation(uuid, uuid, integer)
  FROM PUBLIC;
REVOKE ALL ON FUNCTION public.contribution_review_detail(uuid, uuid)
  FROM PUBLIC;
REVOKE ALL ON FUNCTION public.contribution_public_projections(uuid, uuid)
  FROM PUBLIC;
REVOKE ALL ON FUNCTION public.contribution_set_moderator_assignment(
  uuid, uuid, public.contribution_assignment_status, timestamptz, timestamptz,
  uuid, uuid
) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.contribution_set_control(
  uuid, uuid, boolean, boolean, integer, integer, integer, integer, integer,
  integer, text
) FROM PUBLIC;

REVOKE USAGE ON TYPE
  public.contribution_operation,
  public.contribution_rate_dimension,
  public.contribution_decision,
  public.contribution_assignment_status,
  public.contribution_projection_state,
  public.contribution_audit_action
FROM PUBLIC;

GRANT USAGE ON SCHEMA public
  TO wetindey_contribution_runtime, wetindey_contribution_moderator,
    wetindey_contribution_control;
GRANT USAGE ON TYPE public.contribution_operation
  TO wetindey_contribution_runtime;
GRANT USAGE ON TYPE
  public.contribution_decision,
  public.contribution_projection_state,
  public.contribution_audit_action
TO wetindey_contribution_moderator;
GRANT USAGE ON TYPE public.contribution_assignment_status
  TO wetindey_contribution_control;

GRANT EXECUTE ON FUNCTION public.contribution_admit(
  public.contribution_operation, uuid, text, text, text, uuid, uuid, uuid,
  uuid, text, integer, timestamp, boolean, uuid
) TO wetindey_contribution_runtime;
GRANT EXECUTE ON FUNCTION public.contribution_public_projections(uuid, uuid)
  TO wetindey_contribution_runtime;
GRANT EXECUTE ON FUNCTION public.contribution_moderate(
  uuid, uuid, text, uuid, public.contribution_decision, text, uuid
) TO wetindey_contribution_moderator;
GRANT EXECUTE ON FUNCTION public.contribution_pending_queue(uuid, integer)
  TO wetindey_contribution_moderator;
GRANT EXECUTE ON FUNCTION public.contribution_audit_for_observation(uuid, uuid, integer)
  TO wetindey_contribution_moderator;
GRANT EXECUTE ON FUNCTION public.contribution_review_detail(uuid, uuid)
  TO wetindey_contribution_moderator;
GRANT EXECUTE ON FUNCTION public.contribution_set_moderator_assignment(
  uuid, uuid, public.contribution_assignment_status, timestamptz, timestamptz,
  uuid, uuid
) TO wetindey_contribution_control;
GRANT EXECUTE ON FUNCTION public.contribution_set_control(
  uuid, uuid, boolean, boolean, integer, integer, integer, integer, integer,
  integer, text
) TO wetindey_contribution_control;

-- The owner services resolve or create sources and append observations. They
-- cannot mutate legacy evidence or any catalogue row.
GRANT SELECT, INSERT ON TABLE public.sources, public.observations
  TO wetindey_contribution_owner;

ALTER TABLE public.contribution_control OWNER TO wetindey_contribution_owner;
ALTER TABLE public.contribution_requests OWNER TO wetindey_contribution_owner;
ALTER TABLE public.contribution_rate_buckets OWNER TO wetindey_contribution_owner;
ALTER TABLE public.contribution_moderator_assignments OWNER TO wetindey_contribution_owner;
ALTER TABLE public.contribution_moderation_decisions OWNER TO wetindey_contribution_owner;
ALTER TABLE public.contribution_audit_events OWNER TO wetindey_contribution_owner;
ALTER TABLE public.contribution_projections OWNER TO wetindey_contribution_owner;

ALTER TYPE public.contribution_operation OWNER TO wetindey_contribution_owner;
ALTER TYPE public.contribution_rate_dimension OWNER TO wetindey_contribution_owner;
ALTER TYPE public.contribution_decision OWNER TO wetindey_contribution_owner;
ALTER TYPE public.contribution_assignment_status OWNER TO wetindey_contribution_owner;
ALTER TYPE public.contribution_projection_state OWNER TO wetindey_contribution_owner;
ALTER TYPE public.contribution_audit_action OWNER TO wetindey_contribution_owner;

ALTER FUNCTION public.contribution_assert_digest(text, text)
  OWNER TO wetindey_contribution_owner;
ALTER FUNCTION public.contribution_forbid_append_only_mutation()
  OWNER TO wetindey_contribution_owner;
ALTER FUNCTION public.contribution_protect_admitted_observation()
  OWNER TO wetindey_contribution_owner;
ALTER FUNCTION public.contribution_assert_moderator(uuid)
  OWNER TO wetindey_contribution_owner;
ALTER FUNCTION public.contribution_effective_decision_id(uuid)
  OWNER TO wetindey_contribution_owner;
ALTER FUNCTION public.contribution_recompute_projection_internal(uuid, uuid, uuid)
  OWNER TO wetindey_contribution_owner;
ALTER FUNCTION public.contribution_admit(
  public.contribution_operation, uuid, text, text, text, uuid, uuid, uuid,
  uuid, text, integer, timestamp, boolean, uuid
) OWNER TO wetindey_contribution_owner;
ALTER FUNCTION public.contribution_moderate(
  uuid, uuid, text, uuid, public.contribution_decision, text, uuid
) OWNER TO wetindey_contribution_owner;
ALTER FUNCTION public.contribution_pending_queue(uuid, integer)
  OWNER TO wetindey_contribution_owner;
ALTER FUNCTION public.contribution_audit_for_observation(uuid, uuid, integer)
  OWNER TO wetindey_contribution_owner;
ALTER FUNCTION public.contribution_review_detail(uuid, uuid)
  OWNER TO wetindey_contribution_owner;
ALTER FUNCTION public.contribution_public_projections(uuid, uuid)
  OWNER TO wetindey_contribution_owner;
ALTER FUNCTION public.contribution_set_moderator_assignment(
  uuid, uuid, public.contribution_assignment_status, timestamptz, timestamptz,
  uuid, uuid
) OWNER TO wetindey_contribution_owner;
ALTER FUNCTION public.contribution_set_control(
  uuid, uuid, boolean, boolean, integer, integer, integer, integer, integer,
  integer, text
) OWNER TO wetindey_contribution_owner;

REVOKE CREATE ON SCHEMA public FROM wetindey_contribution_owner;
REVOKE wetindey_contribution_owner FROM SESSION_USER
  GRANTED BY SESSION_USER;

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
