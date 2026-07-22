import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import pg from "pg";

const { Client } = pg;
const ROOT = process.cwd();
const MANIFEST_PATH = "src/db/migrations/meta/0014_release_manifest.json";
const URL_ENVS = {
  preview: "PRESENCE_0014_PREVIEW_DATABASE_URL_UNPOOLED",
  production: "PRESENCE_0014_PRODUCTION_DATABASE_URL_UNPOOLED",
};
const REQUIRED_ROLES = ["wetindey_presence_owner", "wetindey_presence_runtime", "wetindey_presence_safety", "wetindey_presence_lifecycle"];

const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const read = (path) => readFileSync(resolve(ROOT, path));
function fail(message, details = null) { const error = new Error(message); error.details = details; throw error; }
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
  return value;
}
function parseTarget() {
  const args = process.argv.slice(2);
  if (args.length !== 2 || !args[0].startsWith("--target=") || !args[1].startsWith("--branch=")) fail("Exactly one target and branch assertion are required");
  const targetName = args[0].slice("--target=".length);
  const branchName = args[1].slice("--branch=".length);
  if (!Object.hasOwn(URL_ENVS, targetName) || !branchName) fail("Target or branch assertion is not permitted");
  return { targetName, branchName };
}
function loadManifest() {
  const manifest = JSON.parse(read(MANIFEST_PATH).toString("utf8"));
  if (manifest.status !== "shared_applied_immutable" || manifest.shared_database_applied !== true || manifest.authorization?.duplicate_execution !== false) fail("Manifest is not the immutable applied release authority");
  return manifest;
}
function connectionContext(selection, manifest) {
  if (Object.hasOwn(process.env, "DATABASE_URL")) fail("Ambient DATABASE_URL is forbidden");
  const target = manifest.targets[selection.targetName];
  if (!target || selection.branchName !== target.branch_name) fail("Explicit branch does not match the frozen target");
  const connectionString = process.env[URL_ENVS[selection.targetName]]?.trim();
  if (!connectionString) fail("Dedicated target connection variable is required");
  let url;
  try { url = new URL(connectionString); } catch { fail("Dedicated connection variable is not a valid URL"); }
  if (!/^postgres(?:ql)?:$/.test(url.protocol)) fail("Dedicated connection must use PostgreSQL");
  if (decodeURIComponent(url.pathname.slice(1)) !== target.database || decodeURIComponent(url.username) !== target.migration_role || sha256(url.hostname.toLowerCase()) !== target.endpoint_hostname_sha256) fail("Connection identity differs from the frozen target");
  return { connectionString, target, secrets: [connectionString, url.hostname, url.password, decodeURIComponent(url.password)].filter(Boolean) };
}
function redact(value, context) {
  if (typeof value === "string") {
    let output = value;
    for (const secret of [...context.secrets].sort((a, b) => b.length - a.length)) output = output.split(secret).join("[REDACTED]");
    return output.replace(/postgres(?:ql)?:\/\/[^\s"']+/gi, "[REDACTED_DATABASE_URL]");
  }
  if (Array.isArray(value)) return value.map((entry) => redact(entry, context));
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, redact(entry, context)]));
  return value;
}
function emit(type, payload, context) { process.stdout.write(`${JSON.stringify({ at: new Date().toISOString(), type, ...redact(payload, context) })}\n`); }
function expectedLedger(manifest) { return [...manifest.parent_lineage, manifest.result_lineage_entry].map((entry) => [String(entry.when), entry.sha256]); }
function auditArtifacts(manifest) {
  const checks = [
    [manifest.artifacts.migration.path, manifest.artifacts.migration.sha256],
    [manifest.artifacts.snapshot.path, manifest.artifacts.snapshot.sha256],
    [manifest.artifacts.journal.path, manifest.artifacts.journal.sha256],
    ...manifest.parent_lineage.map((entry) => [`src/db/migrations/${entry.tag}.sql`, entry.sha256]),
  ];
  for (const [path, expected] of checks) if (sha256(read(path)) !== expected) fail(`Frozen artifact hash mismatch: ${path}`);
  const journal = JSON.parse(read(manifest.artifacts.journal.path).toString("utf8"));
  const entries = [...manifest.parent_lineage, manifest.result_lineage_entry];
  if (journal.entries.length !== entries.length || journal.entries.some((entry, index) => entry.idx !== entries[index].index || entry.tag !== entries[index].tag || String(entry.when) !== String(entries[index].when))) fail("Journal differs from immutable 0000-0014 authority");
  return { count: checks.length, journalHead: journal.entries.at(-1)?.tag };
}
async function collect(manifest, context) {
  const client = new Client({ connectionString: context.connectionString, application_name: "wetindey-presence-0014-read-only-reconciler" });
  await client.connect();
  try {
    await client.query("BEGIN READ ONLY");
    await client.query("SET LOCAL statement_timeout = '15s'");
    await client.query("SET LOCAL lock_timeout = '2s'");
    const identity = (await client.query(`SELECT current_database() AS database, session_user AS session_role, current_user AS current_role, current_setting('neon.project_id', true) AS neon_project_id, current_setting('neon.branch_id', true) AS neon_branch_id, current_setting('neon.branch_name', true) AS neon_branch_name, current_setting('server_version') AS server_version`)).rows[0];
    const ledger = (await client.query(`SELECT created_at::text AS created_at, hash FROM drizzle.__drizzle_migrations ORDER BY created_at, id`)).rows.map((row) => [String(row.created_at), Buffer.isBuffer(row.hash) ? row.hash.toString("hex") : String(row.hash).toLowerCase()]);
    const roles = (await client.query(`SELECT rolname, rolcanlogin, rolbypassrls, rolcreaterole FROM pg_roles WHERE rolname = ANY($1::text[]) OR rolname = session_user ORDER BY rolname`, [REQUIRED_ROLES])).rows;
    const privileges = (await client.query(`SELECT pg_has_role(session_user, 'wetindey_presence_owner', 'SET') AS can_set_owner, has_schema_privilege('wetindey_presence_owner', 'public', 'CREATE') AS owner_can_create_public`)).rows[0];
    const control = (await client.query(`
      SELECT id, operations_allowed,
             to_jsonb(presence_control)->>'runtime_allowed' AS runtime_allowed,
             allowlist_account_a IS NULL AND allowlist_account_b IS NULL AS allowlist_empty,
             pilot_boundary IS NULL AS boundary_empty,
             wave_retention_seconds, report_retention_seconds,
             safety_responder_account_id IS NULL AS responder_empty,
             safety_backup_account_id IS NULL AS backup_responder_empty
      FROM public.presence_control WHERE id = 1
    `)).rows[0];
    const counts = (await client.query(`SELECT (SELECT count(*)::int FROM public.presence_leases WHERE revoked_at IS NULL AND expires_at > clock_timestamp()) AS active_leases, (SELECT count(*)::int FROM public.presence_waves WHERE expires_at > clock_timestamp()) AS active_waves, (SELECT count(*)::int FROM public.presence_capabilities WHERE state = 'active' AND expires_at > clock_timestamp()) AS active_capabilities`)).rows[0];
    const catalog = {};
    catalog.columns = (await client.query(`SELECT table_schema, table_name, ordinal_position, column_name, data_type, udt_name, is_nullable, column_default FROM information_schema.columns WHERE table_schema IN ('public', 'drizzle') ORDER BY table_schema, table_name, ordinal_position`)).rows;
    catalog.routines = (await client.query(`SELECT n.nspname AS schema, p.proname AS name, pg_get_function_identity_arguments(p.oid) AS arguments, pg_get_function_result(p.oid) AS result, p.prokind, l.lanname AS language, owner.rolname AS owner, p.provolatile, p.proparallel, p.proisstrict, p.proleakproof, p.prosecdef, coalesce(array_to_string(p.proconfig, ','), '') AS configuration, coalesce(p.proacl::text, '') AS acl, md5(pg_get_functiondef(p.oid)) AS definition_md5 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace JOIN pg_language l ON l.oid=p.prolang JOIN pg_roles owner ON owner.oid=p.proowner WHERE n.nspname='public' AND p.prokind<>'a' ORDER BY p.proname, arguments, p.prokind`)).rows;
    catalog.aggregates = (await client.query(`SELECT n.nspname AS schema, p.proname AS name, pg_get_function_identity_arguments(p.oid) AS arguments, pg_get_function_result(p.oid) AS result, p.prokind, l.lanname AS language, owner.rolname AS owner, p.provolatile, p.proparallel, p.proisstrict, p.proleakproof, p.prosecdef, coalesce(array_to_string(p.proconfig, ','), '') AS configuration, coalesce(p.proacl::text, '') AS acl, a.aggkind, a.aggnumdirectargs, a.aggtransfn::regprocedure::text AS transition_function, a.aggfinalfn::regprocedure::text AS final_function, a.aggcombinefn::regprocedure::text AS combine_function, a.aggserialfn::regprocedure::text AS serial_function, a.aggdeserialfn::regprocedure::text AS deserial_function, a.aggmtransfn::regprocedure::text AS moving_transition_function, a.aggminvtransfn::regprocedure::text AS moving_inverse_function, a.aggmfinalfn::regprocedure::text AS moving_final_function, a.aggfinalextra, a.aggmfinalextra, a.aggfinalmodify, a.aggmfinalmodify, a.aggsortop::regoperator::text AS sort_operator, a.aggtranstype::regtype::text AS transition_type, a.aggtransspace, a.aggmtranstype::regtype::text AS moving_transition_type, a.aggmtransspace, a.agginitval, a.aggminitval FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace JOIN pg_language l ON l.oid=p.prolang JOIN pg_roles owner ON owner.oid=p.proowner JOIN pg_aggregate a ON a.aggfnoid=p.oid WHERE n.nspname='public' AND p.prokind='a' ORDER BY p.proname, arguments, a.aggkind`)).rows;
    catalog.policies = (await client.query(`SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check FROM pg_policies WHERE schemaname='public' ORDER BY tablename, policyname`)).rows;
    catalog.grants = (await client.query(`SELECT table_schema, table_name, grantee, privilege_type FROM information_schema.role_table_grants WHERE table_schema='public' ORDER BY table_name, grantee, privilege_type`)).rows;
    const fingerprint = sha256(JSON.stringify(canonical({ catalog, roles, control, counts })));
    await client.query("ROLLBACK");
    return { identity, ledger, roles, privileges, control, counts, fingerprint };
  } catch (error) { try { await client.query("ROLLBACK"); } catch {} throw error; } finally { await client.end(); }
}
function assertResult(manifest, context, result) {
  const target = context.target;
  const branchNameCorroborates = result.identity.neon_branch_name === null || result.identity.neon_branch_name === target.branch_name;
  const identityPass = result.identity.neon_project_id === target.project_id && result.identity.neon_branch_id === target.branch_id && branchNameCorroborates && result.identity.database === target.database && result.identity.session_role === target.migration_role && result.identity.current_role === target.migration_role;
  const ledgerPass = JSON.stringify(result.ledger) === JSON.stringify(expectedLedger(manifest));
  const rolesPass = REQUIRED_ROLES.every((name) => result.roles.some((role) => role.rolname === name && !role.rolcanlogin && !role.rolbypassrls));
  const controlsPass = result.control?.operations_allowed === false && result.control?.runtime_allowed === "false" && result.control?.allowlist_empty === true;
  const emptyPass = result.counts.active_leases === 0 && result.counts.active_waves === 0 && result.counts.active_capabilities === 0;
  if (!identityPass || !ledgerPass || !rolesPass || !controlsPass || !emptyPass || result.privileges.can_set_owner || result.privileges.owner_can_create_public || result.fingerprint !== manifest.accepted_result_fingerprint_sha256) fail("Target does not match the immutable accepted 0014 result", { identityPass, ledgerPass, rolesPass, controlsPass, emptyPass, privilegeCleanup: !result.privileges.can_set_owner && !result.privileges.owner_can_create_public, fingerprintPass: result.fingerprint === manifest.accepted_result_fingerprint_sha256 });
}

let context = { secrets: [] };
try {
  const selection = parseTarget();
  const manifest = loadManifest();
  context = connectionContext(selection, manifest);
  emit("reconciliation_started", { target: selection.targetName, branch: selection.branchName }, context);
  emit("artifact_audit", { status: "PASS", ...auditArtifacts(manifest) }, context);
  const result = await collect(manifest, context);
  emit("target_evidence", { status: "COLLECTED", result }, context);
  assertResult(manifest, context, result);
  emit("reconciliation_complete", { status: "PASS", duplicateExecutionAllowed: false }, context);
} catch (error) {
  emit("reconciliation_incident", { status: "NO_GO", error: error instanceof Error ? error.message : "Unknown failure", details: error?.details ?? null }, context);
  process.exitCode = 1;
}
