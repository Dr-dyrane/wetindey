-- Canonical ADR-019 integrity primitives that Drizzle cannot express.
-- Existing observations remain legacy evidence. Only rows carrying admission_id
-- enter this append-only boundary.

INSERT INTO public.contribution_control (id, reporting_allowed, moderation_allowed)
VALUES (1, false, false)
ON CONFLICT (id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.contribution_assert_digest(
  p_name text,
  p_digest text
)
RETURNS void
LANGUAGE plpgsql
IMMUTABLE
SET search_path = pg_catalog
AS $$
BEGIN
  IF p_digest IS NULL OR p_digest !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION '% must be a lowercase SHA-256 HMAC digest', p_name
      USING ERRCODE = '22023';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.contribution_forbid_append_only_mutation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $$
BEGIN
  RAISE EXCEPTION '% is append-only', TG_TABLE_NAME
    USING ERRCODE = '55000';
END;
$$;

CREATE OR REPLACE FUNCTION public.contribution_protect_admitted_observation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $$
BEGIN
  IF OLD.admission_id IS NOT NULL THEN
    RAISE EXCEPTION 'admitted observations are immutable'
      USING ERRCODE = '55000';
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS contribution_requests_append_only
  ON public.contribution_requests;
CREATE TRIGGER contribution_requests_append_only
  BEFORE UPDATE OR DELETE ON public.contribution_requests
  FOR EACH ROW EXECUTE FUNCTION public.contribution_forbid_append_only_mutation();

DROP TRIGGER IF EXISTS contribution_decisions_append_only
  ON public.contribution_moderation_decisions;
CREATE TRIGGER contribution_decisions_append_only
  BEFORE UPDATE OR DELETE ON public.contribution_moderation_decisions
  FOR EACH ROW EXECUTE FUNCTION public.contribution_forbid_append_only_mutation();

DROP TRIGGER IF EXISTS contribution_audit_append_only
  ON public.contribution_audit_events;
CREATE TRIGGER contribution_audit_append_only
  BEFORE UPDATE OR DELETE ON public.contribution_audit_events
  FOR EACH ROW EXECUTE FUNCTION public.contribution_forbid_append_only_mutation();

DROP TRIGGER IF EXISTS contribution_observations_immutable
  ON public.observations;
CREATE TRIGGER contribution_observations_immutable
  BEFORE UPDATE OR DELETE ON public.observations
  FOR EACH ROW EXECUTE FUNCTION public.contribution_protect_admitted_observation();
