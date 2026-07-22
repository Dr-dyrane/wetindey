import { randomUUID } from "node:crypto";
import { Pool } from "pg";

const CONTROL_ROLE = "wetindey_contribution_control";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ASSIGNMENT_SQL = `SELECT public.contribution_set_moderator_assignment($1::uuid, $2::uuid, $3::public.contribution_assignment_status, $4::timestamptz, $5::timestamptz, $6::uuid, $7::uuid)`;
const CONTROL_SQL = `SELECT public.contribution_set_control($1::uuid, $2::uuid, $3::boolean, $4::boolean, $5::integer, $6::integer, $7::integer, $8::integer, $9::integer, $10::integer, $11::text)`;
const CAPABILITY_SQL = `SELECT pg_catalog.current_database() AS database_name, COALESCE(pg_catalog.inet_server_addr()::text, '') AS server_host, NULLIF(pg_catalog.current_setting('neon.project_id', true), '') AS neon_project_id, NULLIF(pg_catalog.current_setting('neon.branch_id', true), '') AS neon_branch_id, pg_catalog.pg_has_role(pg_catalog.session_user, $2::name, 'MEMBER') AS role_member, COALESCE(bool_and(pg_catalog.to_regprocedure(signature) IS NOT NULL AND pg_catalog.has_function_privilege(pg_catalog.current_user, pg_catalog.to_regprocedure(signature), 'EXECUTE')), false) AS rpc_access FROM unnest($1::text[]) AS requested(signature)`;
const CONTROL_SIGNATURES = ["public.contribution_set_moderator_assignment(uuid,uuid,public.contribution_assignment_status,timestamp with time zone,timestamp with time zone,uuid,uuid)", "public.contribution_set_control(uuid,uuid,boolean,boolean,integer,integer,integer,integer,integer,integer,text)"] as const;
type Arguments = Record<string, string | boolean>;
type ControlEnvironment = Partial<Record<"CONTRIBUTION_CONTROL_DATABASE_URL_UNPOOLED" | "CONTRIBUTION_CONTROL_EXPECTED_HOST" | "CONTRIBUTION_CONTROL_EXPECTED_PROJECT" | "CONTRIBUTION_CONTROL_EXPECTED_BRANCH" | "CONTRIBUTION_CONTROL_EXPECTED_DATABASE" | "CONTRIBUTION_CONTROL_ALLOWED_TARGETS", string>>;
type TargetIdentity = { host: string; project: string; branch: string; database: string };
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
function targetMatchesProbe(target: TargetIdentity, probe: { database_name?: unknown; server_host?: unknown; neon_project_id?: unknown; neon_branch_id?: unknown }): boolean { return probe.database_name === target.database && probe.server_host === target.host && probe.neon_project_id === target.project && probe.neon_branch_id === target.branch; }
async function main() {
  const [command, ...rest] = process.argv.slice(2); if (command !== "assign" && command !== "control") throw new Error("Use `assign` or `control`.");
  const arguments_ = parseArguments(rest); const requestedTarget = targetFromArguments(arguments_); const requestId = arguments_["request-id"] ? uuidArgument(arguments_, "request-id") : randomUUID(); const apply = arguments_.apply === true;
  if (!apply) { console.log(`Dry run only. No database connection or mutation was attempted. Request: ${requestId}`); return; }
  if (!arguments_["request-id"]) throw new Error("--request-id is required with --apply for a stable retry identity.");
  const environment = process.env as ControlEnvironment;
  const expectedTarget = targetFromEnvironment(environment);
  const databaseUrl = environment.CONTRIBUTION_CONTROL_DATABASE_URL_UNPOOLED;
  if (!databaseUrl || !expectedTarget || !sameTarget(requestedTarget, expectedTarget) || !targetIsAllowed(environment, requestedTarget)) throw new Error("Control target identity is not explicitly allowed.");
  const pool = new Pool({ connectionString: databaseUrl, max: 1 });
  try {
    const probe = await pool.query(CAPABILITY_SQL, [CONTROL_SIGNATURES, CONTROL_ROLE]); const row = probe.rows[0] as { database_name?: unknown; server_host?: unknown; neon_project_id?: unknown; neon_branch_id?: unknown; role_member?: unknown; rpc_access?: unknown } | undefined;
    if (!row || !targetMatchesProbe(requestedTarget, row) || row.role_member !== true || row.rpc_access !== true) throw new Error("Control target or least-privilege capability did not match.");
    if (command === "assign") { const status = stringArgument(arguments_, "status"); if (status !== "active" && status !== "suspended" && status !== "revoked") throw new Error("--status must be active, suspended, or revoked."); await pool.query(ASSIGNMENT_SQL, [requestId, uuidArgument(arguments_, "account-id"), status, isoArgument(arguments_, "effective-at"), isoArgument(arguments_, "expires-at", true), uuidArgument(arguments_, "issued-by"), uuidArgument(arguments_, "reviewed-by")]); }
    else { await pool.query(CONTROL_SQL, [requestId, uuidArgument(arguments_, "actor-id"), booleanArgument(arguments_, "reporting-allowed"), booleanArgument(arguments_, "moderation-allowed"), integerArgument(arguments_, "subject-limit-15m"), integerArgument(arguments_, "subject-limit-day"), integerArgument(arguments_, "network-limit-15m"), integerArgument(arguments_, "network-limit-day"), integerArgument(arguments_, "unavailable-min-sources"), integerArgument(arguments_, "projection-window-hours"), stringArgument(arguments_, "policy-version")]); }
    console.log(`Control command applied to ${requestedTarget.database}. Request: ${requestId}`);
  } finally { await pool.end(); }
}
if (process.argv[1]?.endsWith("contribution-moderator-control.ts")) {
  void main().catch((error: unknown) => { console.error(error instanceof Error ? error.message : "Control command failed."); process.exitCode = 1; });
}
export const moderatorControlForContract = { parseArguments, CAPABILITY_SQL, CONTROL_SIGNATURES, targetFromEnvironment, targetIsAllowed, sameTarget, targetMatchesProbe };
