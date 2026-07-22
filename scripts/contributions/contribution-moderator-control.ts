import { createHash, randomUUID } from "node:crypto";
import { Pool } from "pg";

const CONTROL_ROLE = "wetindey_contribution_control";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const NEON_ENDPOINT_HOST = /^(ep-[a-z0-9]+(?:-[a-z0-9]+){2,})(?:\.c-[1-9][0-9]{0,2})?\.[a-z]{2}-[a-z]+-[1-9][0-9]*\.aws\.neon\.tech$/;
const ASSIGNMENT_SQL = `SELECT public.contribution_set_moderator_assignment($1::uuid, $2::uuid, $3::public.contribution_assignment_status, $4::timestamptz, $5::timestamptz, $6::uuid, $7::uuid)`;
const CONTROL_SQL = `SELECT public.contribution_set_control($1::uuid, $2::uuid, $3::boolean, $4::boolean, $5::integer, $6::integer, $7::integer, $8::integer, $9::integer, $10::integer, $11::text)`;
const CAPABILITY_SQL = `WITH RECURSIVE membership_path AS (SELECT membership.roleid, membership.set_option, ARRAY[membership.roleid] AS path FROM pg_catalog.pg_auth_members membership WHERE membership.member = (SELECT role.oid FROM pg_catalog.pg_roles role WHERE role.rolname = session_user) UNION ALL SELECT membership.roleid, membership.set_option, parent.path || membership.roleid FROM pg_catalog.pg_auth_members membership JOIN membership_path parent ON membership.member = parent.roleid WHERE NOT membership.roleid = ANY(parent.path)) SELECT pg_catalog.current_database() AS database_name, COALESCE(pg_catalog.inet_server_addr()::text, '') AS server_address, NULLIF(pg_catalog.current_setting('neon.endpoint_id', true), '') AS neon_endpoint_id, NULLIF(pg_catalog.current_setting('neon.project_id', true), '') AS neon_project_id, NULLIF(pg_catalog.current_setting('neon.branch_id', true), '') AS neon_branch_id, COALESCE((SELECT pg_catalog.count(*) = 3 AND pg_catalog.bool_and(setting.context IN ('superuser', 'postmaster')) FROM pg_catalog.pg_settings setting WHERE setting.name = ANY (ARRAY['neon.endpoint_id', 'neon.project_id', 'neon.branch_id']::text[])), false) AS identity_settings_locked, COALESCE((SELECT NOT role.rolsuper AND role.rolinherit AND NOT role.rolcreaterole AND NOT role.rolcreatedb AND role.rolcanlogin AND NOT role.rolreplication AND NOT role.rolbypassrls FROM pg_catalog.pg_roles role WHERE role.rolname = session_user), false) AS unprivileged_login, current_user = session_user AS direct_login, NOT pg_catalog.pg_has_role(session_user, 'wetindey_contribution_owner', 'MEMBER') AND NOT pg_catalog.pg_has_role(session_user, 'wetindey_contribution_owner', 'SET') AS owner_access_absent, NOT pg_catalog.pg_has_role(session_user, 'wetindey_contribution_runtime', 'MEMBER') AND NOT pg_catalog.pg_has_role(session_user, 'wetindey_contribution_moderator', 'MEMBER') AS incompatible_memberships_absent, COALESCE((SELECT pg_catalog.array_agg(DISTINCT inherited_role.rolname ORDER BY inherited_role.rolname) = ARRAY[$2::name] AND pg_catalog.bool_and(NOT membership_path.set_option) FROM membership_path JOIN pg_catalog.pg_roles inherited_role ON inherited_role.oid = membership_path.roleid), false) AS membership_closure_safe, pg_catalog.pg_has_role(session_user, $2::name, 'MEMBER') AS role_member, COALESCE(bool_and(pg_catalog.to_regprocedure(signature) IS NOT NULL AND pg_catalog.has_function_privilege(current_user, pg_catalog.to_regprocedure(signature), 'EXECUTE')), false) AS rpc_access FROM unnest($1::text[]) AS requested(signature)`;
const CONTROL_SIGNATURES = ["public.contribution_set_moderator_assignment(uuid,uuid,public.contribution_assignment_status,timestamp with time zone,timestamp with time zone,uuid,uuid)", "public.contribution_set_control(uuid,uuid,boolean,boolean,integer,integer,integer,integer,integer,integer,text)"] as const;
type Arguments = Record<string, string | boolean>;
type ControlEnvironment = Partial<Record<"CONTRIBUTION_CONTROL_DATABASE_URL_UNPOOLED" | "CONTRIBUTION_CONTROL_EXPECTED_HOST" | "CONTRIBUTION_CONTROL_EXPECTED_PROJECT" | "CONTRIBUTION_CONTROL_EXPECTED_BRANCH" | "CONTRIBUTION_CONTROL_EXPECTED_DATABASE" | "CONTRIBUTION_CONTROL_ALLOWED_TARGETS" | "CONTRIBUTION_CONTROL_MODERATOR_ACCOUNT_ID" | "CONTRIBUTION_CONTROL_ISSUER_ACCOUNT_ID" | "CONTRIBUTION_CONTROL_REVIEWER_ACCOUNT_ID" | "CONTRIBUTION_CONTROL_ACTOR_ACCOUNT_ID", string>>;
type TargetIdentity = { host: string; project: string; branch: string; database: string };
type VerifiedActors = { moderator: string; issuer: string; reviewer: string; actor: string };
type ActorDigests = { moderator: string; issuer: string; reviewer: string; actor: string };
const APPROVED_ACTOR_DIGESTS: Readonly<Record<string, ActorDigests>> = Object.freeze({
  "wild-rain-23091788/br-steep-dust-auhcmjk8/ep-round-thunder-au05hrlf.c-10.us-east-1.aws.neon.tech/neondb": Object.freeze({
    moderator: "8061ffaa36a4debf4bd062663f31c52bfe0cd37ab803748f12612f22d417fb85",
    issuer: "86095c30745092780b42e48b8f636ec1fd31fa83c8929569648bd6a7e59438bf",
    reviewer: "9466a6d7263f5faf035f7117fa3e1aec8736805276fd157f15b75f2bdd9fe2f0",
    actor: "86095c30745092780b42e48b8f636ec1fd31fa83c8929569648bd6a7e59438bf",
  }),
});
function parseArguments(values: string[]): Arguments { const result: Arguments = {}; for (let index = 0; index < values.length; index += 1) { const value = values[index]; if (!value.startsWith("--")) continue; const key = value.slice(2); if (key === "apply") { result.apply = true; continue; } const next = values[index + 1]; if (!next || next.startsWith("--")) throw new Error(`Missing value for --${key}.`); result[key] = next; index += 1; } return result; }
function stringArgument(arguments_: Arguments, key: string): string { const value = arguments_[key]; if (typeof value !== "string" || value.length === 0) throw new Error(`Missing --${key}.`); return value; }
function uuidArgument(arguments_: Arguments, key: string): string { const value = stringArgument(arguments_, key); if (!UUID.test(value)) throw new Error(`--${key} must be a UUID.`); return value; }
function booleanArgument(arguments_: Arguments, key: string): boolean { const value = stringArgument(arguments_, key); if (value === "true") return true; if (value === "false") return false; throw new Error(`--${key} must be true or false.`); }
function integerArgument(arguments_: Arguments, key: string): number { const value = Number(stringArgument(arguments_, key)); if (!Number.isSafeInteger(value) || value < 0) throw new Error(`--${key} must be a non-negative integer.`); return value; }
function isoArgument(arguments_: Arguments, key: string, nullable = false): string | null { const value = arguments_[key]; if (nullable && value === "none") return null; if (typeof value !== "string" || Number.isNaN(Date.parse(value))) throw new Error(`--${key} must be an ISO timestamp${nullable ? " or none" : ""}.`); return new Date(value).toISOString(); }
function targetFromArguments(arguments_: Arguments): TargetIdentity { return { host: stringArgument(arguments_, "target-host"), project: stringArgument(arguments_, "target-project"), branch: stringArgument(arguments_, "target-branch"), database: stringArgument(arguments_, "target-database") }; }
function targetFromEnvironment(environment: ControlEnvironment): TargetIdentity | null {
  const host = environment.CONTRIBUTION_CONTROL_EXPECTED_HOST?.trim();
  const project = environment.CONTRIBUTION_CONTROL_EXPECTED_PROJECT?.trim();
  const branch = environment.CONTRIBUTION_CONTROL_EXPECTED_BRANCH?.trim();
  const database = environment.CONTRIBUTION_CONTROL_EXPECTED_DATABASE?.trim();
  return host && project && branch && database ? { host, project, branch, database } : null;
}
function targetKey(target: TargetIdentity): string { return `${target.project}/${target.branch}/${target.host}/${target.database}`; }
function targetIsAllowed(environment: ControlEnvironment, target: TargetIdentity): boolean {
  return environment.CONTRIBUTION_CONTROL_ALLOWED_TARGETS?.split(",").map((entry) => entry.trim()).includes(targetKey(target)) === true;
}
function sameTarget(left: TargetIdentity, right: TargetIdentity): boolean { return targetKey(left) === targetKey(right); }
function neonEndpointFromHost(host: string): string | null {
  const canonicalHost = host.trim().toLowerCase();
  if (host !== canonicalHost) return null;
  return NEON_ENDPOINT_HOST.exec(canonicalHost)?.[1] ?? null;
}
function targetMatchesProbe(target: TargetIdentity, probe: { database_name?: unknown; neon_endpoint_id?: unknown; neon_project_id?: unknown; neon_branch_id?: unknown }): boolean {
  const expectedEndpoint = neonEndpointFromHost(target.host);
  return expectedEndpoint !== null && probe.database_name === target.database && probe.neon_endpoint_id === expectedEndpoint && probe.neon_project_id === target.project && probe.neon_branch_id === target.branch;
}
function verifiedActorsFromEnvironment(environment: ControlEnvironment): VerifiedActors | null {
  const moderator = environment.CONTRIBUTION_CONTROL_MODERATOR_ACCOUNT_ID?.trim().toLowerCase();
  const issuer = environment.CONTRIBUTION_CONTROL_ISSUER_ACCOUNT_ID?.trim().toLowerCase();
  const reviewer = environment.CONTRIBUTION_CONTROL_REVIEWER_ACCOUNT_ID?.trim().toLowerCase();
  const actor = environment.CONTRIBUTION_CONTROL_ACTOR_ACCOUNT_ID?.trim().toLowerCase();
  if (!moderator || !issuer || !reviewer || !actor || ![moderator, issuer, reviewer, actor].every((value) => UUID.test(value))) return null;
  if (new Set([moderator, issuer, reviewer]).size !== 3) return null;
  return { moderator, issuer, reviewer, actor };
}
function commandActorsMatch(command: "assign" | "control", arguments_: Arguments, actors: VerifiedActors): boolean {
  if (command === "assign") {
    return arguments_["account-id"]?.toString().toLowerCase() === actors.moderator && arguments_["issued-by"]?.toString().toLowerCase() === actors.issuer && arguments_["reviewed-by"]?.toString().toLowerCase() === actors.reviewer;
  }
  return arguments_["actor-id"]?.toString().toLowerCase() === actors.actor;
}
function actorDigest(actorId: string): string { return createHash("sha256").update(actorId).digest("hex"); }
function actorsAreApproved(target: TargetIdentity, actors: VerifiedActors, approvals: Readonly<Record<string, ActorDigests>> = APPROVED_ACTOR_DIGESTS): boolean {
  const approved = approvals[targetKey(target)];
  return approved !== undefined && (Object.keys(approved) as (keyof ActorDigests)[]).every((role) => actorDigest(actors[role]) === approved[role]);
}
async function main() {
  const [command, ...rest] = process.argv.slice(2); if (command !== "assign" && command !== "control") throw new Error("Use `assign` or `control`.");
  const arguments_ = parseArguments(rest); const requestedTarget = targetFromArguments(arguments_); const requestId = arguments_["request-id"] ? uuidArgument(arguments_, "request-id") : randomUUID(); const apply = arguments_.apply === true;
  if (!apply) { console.log(`Dry run only. No database connection or mutation was attempted. Request: ${requestId}`); return; }
  if (!arguments_["request-id"]) throw new Error("--request-id is required with --apply for a stable retry identity.");
  const environment = process.env as ControlEnvironment;
  const expectedTarget = targetFromEnvironment(environment);
  const verifiedActors = verifiedActorsFromEnvironment(environment);
  const databaseUrl = environment.CONTRIBUTION_CONTROL_DATABASE_URL_UNPOOLED;
  if (!databaseUrl || !expectedTarget || !verifiedActors || !actorsAreApproved(requestedTarget, verifiedActors) || !commandActorsMatch(command, arguments_, verifiedActors) || !sameTarget(requestedTarget, expectedTarget) || !targetIsAllowed(environment, requestedTarget)) throw new Error("Control target identity or verified actors are not explicitly allowed.");
  const pool = new Pool({ connectionString: databaseUrl, max: 1 });
  const client = await pool.connect();
  try {
    await client.query("BEGIN ISOLATION LEVEL SERIALIZABLE");
    const assertCapability = async () => {
      const probe = await client.query(CAPABILITY_SQL, [CONTROL_SIGNATURES, CONTROL_ROLE]); const row = probe.rows[0] as { database_name?: unknown; server_address?: unknown; neon_endpoint_id?: unknown; neon_project_id?: unknown; neon_branch_id?: unknown; identity_settings_locked?: unknown; unprivileged_login?: unknown; direct_login?: unknown; owner_access_absent?: unknown; incompatible_memberships_absent?: unknown; membership_closure_safe?: unknown; role_member?: unknown; rpc_access?: unknown } | undefined;
      if (!row || !targetMatchesProbe(requestedTarget, row) || row.identity_settings_locked !== true || row.unprivileged_login !== true || row.direct_login !== true || row.owner_access_absent !== true || row.incompatible_memberships_absent !== true || row.membership_closure_safe !== true || row.role_member !== true || row.rpc_access !== true) throw new Error("Control target or least-privilege capability did not match.");
    };
    await assertCapability();
    if (command === "assign") { const status = stringArgument(arguments_, "status"); if (status !== "active" && status !== "suspended" && status !== "revoked") throw new Error("--status must be active, suspended, or revoked."); await client.query(ASSIGNMENT_SQL, [requestId, uuidArgument(arguments_, "account-id"), status, isoArgument(arguments_, "effective-at"), isoArgument(arguments_, "expires-at", true), uuidArgument(arguments_, "issued-by"), uuidArgument(arguments_, "reviewed-by")]); }
    else { await client.query(CONTROL_SQL, [requestId, uuidArgument(arguments_, "actor-id"), booleanArgument(arguments_, "reporting-allowed"), booleanArgument(arguments_, "moderation-allowed"), integerArgument(arguments_, "subject-limit-15m"), integerArgument(arguments_, "subject-limit-day"), integerArgument(arguments_, "network-limit-15m"), integerArgument(arguments_, "network-limit-day"), integerArgument(arguments_, "unavailable-min-sources"), integerArgument(arguments_, "projection-window-hours"), stringArgument(arguments_, "policy-version")]); }
    await assertCapability();
    await client.query("COMMIT");
    console.log(`Control command applied to ${requestedTarget.database}. Request: ${requestId}`);
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally { client.release(); await pool.end(); }
}
if (process.argv[1]?.endsWith("contribution-moderator-control.ts")) {
  void main().catch((error: unknown) => { console.error(error instanceof Error ? error.message : "Control command failed."); process.exitCode = 1; });
}
export const moderatorControlForContract = { parseArguments, CAPABILITY_SQL, CONTROL_SIGNATURES, targetFromEnvironment, targetIsAllowed, sameTarget, neonEndpointFromHost, targetMatchesProbe, verifiedActorsFromEnvironment, commandActorsMatch, actorDigest, actorsAreApproved };
