import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import pg from "pg";

const { Client } = pg;
const ROOT = process.cwd();
const MANIFEST_PATH = "src/db/migrations/meta/0014_release_manifest.json";
const URL_ENV = "PRESENCE_0014_PREVIEW_DATABASE_URL_UNPOOLED";
const CONFIRM_ENV = "PRESENCE_0014_EXECUTE_CONFIRMATION";
const CONFIRMATION = "EXECUTE_PREVIEW_0014";
const REQUIRED_ROLES = [
  "wetindey_presence_owner",
  "wetindey_presence_runtime",
  "wetindey_presence_safety",
  "wetindey_presence_lifecycle",
];

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function read(path) {
  return readFileSync(resolve(ROOT, path));
}

function fail(message, details = null) {
  const error = new Error(message);
  error.details = details;
  throw error;
}

function loadManifest() {
  const manifest = JSON.parse(read(MANIFEST_PATH).toString("utf8"));
  if (manifest.release !== "0014_presence_capabilities") fail("Unexpected release manifest");
  if (manifest.approved_preview_target.environment !== "preview") fail("Manifest is not Preview-only");
  if (manifest.authorization.production_execution !== false) fail("Production execution must remain false");
  return manifest;
}

function connectionContext() {
  if (Object.hasOwn(process.env, "DATABASE_URL")) {
    fail("Ambient DATABASE_URL is forbidden; use only the dedicated Preview connection variable");
  }
  const connectionString = process.env[URL_ENV]?.trim();
  if (!connectionString) fail(`Missing dedicated connection variable: ${URL_ENV}`);
  let url;
  try {
    url = new URL(connectionString);
  } catch {
    fail("Dedicated Preview connection variable is not a valid URL");
  }
  if (!/^postgres(?:ql)?:$/.test(url.protocol)) fail("Dedicated connection must use PostgreSQL");
  const secrets = [connectionString, url.hostname, url.password, decodeURIComponent(url.password)];
  return {
    connectionString,
    endpointHostnameSha256: sha256(url.hostname.toLowerCase()),
    urlDatabase: decodeURIComponent(url.pathname.slice(1)),
    urlRole: decodeURIComponent(url.username),
    secrets: secrets.filter(Boolean),
  };
}

function redactText(value, context) {
  let output = String(value ?? "");
  for (const secret of [...context.secrets].sort((a, b) => b.length - a.length)) {
    output = output.split(secret).join("[REDACTED]");
  }
  return output
    .replace(/postgres(?:ql)?:\/\/[^\s"']+/gi, "[REDACTED_DATABASE_URL]")
    .replace(/\b(?:ep|br)-[a-z0-9-]+\.[a-z0-9.-]+\b/gi, "[REDACTED_HOSTNAME]");
}

function redactValue(value, context) {
  if (typeof value === "string") return redactText(value, context);
  if (Array.isArray(value)) return value.map((entry) => redactValue(entry, context));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, redactValue(entry, context)]));
  }
  return value;
}

function emit(type, payload, context) {
  process.stdout.write(`${JSON.stringify({ at: new Date().toISOString(), type, ...redactValue(payload, context) })}\n`);
}

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
  }
  return value;
}

function normalizeHash(value) {
  return Buffer.isBuffer(value) ? value.toString("hex") : String(value).toLowerCase();
}

function expectedLedger(manifest, includeResult) {
  const rows = manifest.parent_lineage.map((entry) => [String(entry.when), entry.sha256]);
  if (includeResult) rows.push([String(manifest.result_lineage_entry.when), manifest.result_lineage_entry.sha256]);
  return rows;
}

function auditArtifacts(manifest) {
  const computed = {
    migration: sha256(read(manifest.artifacts.migration.path)),
    snapshot: sha256(read(manifest.artifacts.snapshot.path)),
    journal: sha256(read(manifest.artifacts.journal.path)),
    parents: manifest.parent_lineage.map((entry) => ({
      tag: entry.tag,
      sha256: sha256(read(`src/db/migrations/${entry.tag}.sql`)),
    })),
  };
  if (computed.migration !== manifest.artifacts.migration.sha256) fail("0014 SQL hash mismatch", computed);
  if (computed.snapshot !== manifest.artifacts.snapshot.sha256) fail("0014 snapshot hash mismatch", computed);
  if (computed.journal !== manifest.artifacts.journal.sha256) fail("Migration journal hash mismatch", computed);
  for (const entry of manifest.parent_lineage) {
    if (computed.parents.find((item) => item.tag === entry.tag)?.sha256 !== entry.sha256) {
      fail(`Frozen parent migration hash mismatch: ${entry.tag}`, computed);
    }
  }
  const journal = JSON.parse(read(manifest.artifacts.journal.path).toString("utf8"));
  const expectedEntries = [...manifest.parent_lineage, manifest.result_lineage_entry];
  if (journal.entries.length !== expectedEntries.length) fail("Journal must end exactly at 0014");
  journal.entries.forEach((entry, index) => {
    const expected = expectedEntries[index];
    if (entry.idx !== expected.index || entry.tag !== expected.tag || String(entry.when) !== String(expected.when)) {
      fail("Journal lineage differs from the frozen manifest", { index });
    }
  });
  if (journal.entries.at(-1)?.tag !== "0014_presence_capabilities") fail("0014 is not the journal head");
  return computed;
}

function nonempty(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function assertFresh(timestamp, maxAgeSeconds, label) {
  const time = Date.parse(timestamp);
  const age = Date.now() - time;
  if (!Number.isFinite(time) || age < -300000 || age > maxAgeSeconds * 1000) {
    fail(`${label} is absent, future-dated, or outside its bounded freshness window`);
  }
}

function assertExecutionAuthority(manifest, context) {
  const target = manifest.approved_preview_target;
  if (manifest.authorization.preview_execution !== true) fail("Manifest Preview execution authorization is false");
  if (target.approved !== true) fail("Manifest target identity is not approved");
  for (const field of ["project_id", "database", "migration_role", "endpoint_hostname_sha256", "provider_identity_evidence_sha256"]) {
    if (!nonempty(target[field])) fail(`Manifest target identity field is absent: ${field}`);
  }
  if (target.branch_name !== "preview/wetindey-presence" || target.branch_id !== "br-steep-dust-auhcmjk8") {
    fail("Manifest branch is not the approved Preview branch");
  }
  if (context.urlDatabase !== target.database || context.urlRole !== target.migration_role) {
    fail("Connection database or role differs from the frozen approved target");
  }
  if (context.endpointHostnameSha256 !== target.endpoint_hostname_sha256) {
    fail("Connection endpoint differs from the frozen approved target");
  }
  for (const name of ["parent", "result"]) {
    const fingerprint = manifest.fingerprints[name];
    if (fingerprint.approved !== true || !/^[0-9a-f]{64}$/.test(fingerprint.sha256 ?? "") ||
        !/^[0-9a-f]{64}$/.test(fingerprint.evidence_sha256 ?? "")) {
      fail(`Manifest ${name} fingerprint is absent or unapproved`);
    }
  }
  const backup = manifest.backup_restore;
  const backupFields = ["provider_backup_id", "source_project_id", "source_branch_id", "source_database",
    "created_at", "restore_target_project_id", "restore_target_branch_id", "restore_target_database",
    "restore_owner", "restore_tested_at", "evidence_sha256"];
  if (backup.approved !== true || backup.restorable !== true || backupFields.some((field) => !nonempty(backup[field]))) {
    fail("Manifest backup and restorability evidence is incomplete or unapproved");
  }
  if (backup.source_project_id !== target.project_id || backup.source_branch_id !== target.branch_id ||
      backup.source_database !== target.database || !/^[0-9a-f]{64}$/.test(backup.evidence_sha256)) {
    fail("Manifest backup source does not match the approved target");
  }
  if (backup.restore_target_branch_id === backup.source_branch_id) {
    fail("Restore target branch must be distinct from the source target branch");
  }
  if (!Number.isInteger(backup.max_age_seconds) || backup.max_age_seconds < 1 || backup.max_age_seconds > 3600) {
    fail("Manifest backup freshness bound is invalid");
  }
  assertFresh(backup.created_at, backup.max_age_seconds, "Backup");
  assertFresh(backup.restore_tested_at, backup.max_age_seconds, "Restore proof");
  const independent = manifest.independent_authorization;
  if (independent.approved !== true || independent.verdict !== "PASS" ||
      independent.scope !== "preview-0014-execution" || !nonempty(independent.owner) ||
      !/^[0-9a-f]{64}$/.test(independent.evidence_packet_sha256 ?? "")) {
    fail("Independent execution authorization is absent or unapproved");
  }
  if (independent.owner === backup.restore_owner) fail("Independent owner must differ from restore owner");
  if (!Number.isInteger(independent.max_age_seconds) || independent.max_age_seconds < 1 || independent.max_age_seconds > 3600) {
    fail("Independent authorization freshness bound is invalid");
  }
  assertFresh(independent.authorized_at, independent.max_age_seconds, "Independent authorization");
  if (process.env[CONFIRM_ENV] !== CONFIRMATION) fail("Explicit execute confirmation is absent or incorrect");
}

async function collect(manifest, context) {
  const client = new Client({ connectionString: context.connectionString, application_name: "wetindey-presence-0014-read-only-audit" });
  await client.connect();
  try {
    await client.query("BEGIN READ ONLY");
    await client.query("SET LOCAL statement_timeout = '15s'");
    await client.query("SET LOCAL lock_timeout = '2s'");
    const identity = (await client.query(`
      SELECT current_database() AS database, session_user AS session_role, current_user AS current_role,
             current_setting('neon.project_id', true) AS neon_project_id,
             current_setting('neon.branch_id', true) AS neon_branch_id,
             current_setting('neon.branch_name', true) AS neon_branch_name,
             current_setting('server_version') AS server_version
    `)).rows[0];
    const ledger = (await client.query(`
      SELECT created_at::text AS created_at, hash FROM drizzle.__drizzle_migrations ORDER BY created_at, id
    `)).rows.map((row) => [String(row.created_at), normalizeHash(row.hash)]);
    const roles = (await client.query(`
      SELECT rolname, rolcanlogin, rolbypassrls, rolcreaterole FROM pg_roles
      WHERE rolname = ANY($1::text[]) OR rolname = session_user ORDER BY rolname
    `, [REQUIRED_ROLES])).rows;
    const membership = (await client.query(`
      SELECT pg_has_role(session_user, 'wetindey_presence_owner', 'SET') AS can_set_owner,
             has_schema_privilege('wetindey_presence_owner', 'public', 'CREATE') AS owner_can_create_public
    `)).rows[0];
    const control = (await client.query(`
      SELECT id, operations_allowed, to_jsonb(presence_control)->>'runtime_allowed' AS runtime_allowed,
             allowlist_account_a IS NULL AND allowlist_account_b IS NULL AS allowlist_empty,
             pilot_boundary IS NULL AS boundary_empty, wave_retention_seconds, report_retention_seconds,
             safety_responder_account_id IS NULL AS responder_empty,
             safety_backup_account_id IS NULL AS backup_responder_empty
      FROM public.presence_control WHERE id = 1
    `)).rows[0];
    const counts = (await client.query(`
      SELECT (SELECT count(*)::int FROM public.presence_leases WHERE revoked_at IS NULL AND expires_at > clock_timestamp()) AS active_leases,
             (SELECT count(*)::int FROM public.presence_waves WHERE expires_at > clock_timestamp()) AS active_waves
    `)).rows[0];
    const capabilitiesRelation = (await client.query(`SELECT to_regclass('public.presence_capabilities')::text AS relation`)).rows[0]?.relation ?? null;
    counts.active_capabilities = capabilitiesRelation
      ? (await client.query(`SELECT count(*)::int AS count FROM public.presence_capabilities WHERE state = 'active' AND expires_at > clock_timestamp()`)).rows[0].count
      : 0;
    const catalog = {};
    catalog.columns = (await client.query(`
      SELECT table_schema, table_name, ordinal_position, column_name, data_type, udt_name, is_nullable, column_default
      FROM information_schema.columns WHERE table_schema IN ('public', 'drizzle')
      ORDER BY table_schema, table_name, ordinal_position
    `)).rows;
    catalog.functions = (await client.query(`
      SELECT n.nspname AS schema, p.proname AS name, pg_get_function_identity_arguments(p.oid) AS arguments,
             pg_get_function_result(p.oid) AS result, p.provolatile, p.prosecdef,
             coalesce(array_to_string(p.proconfig, ','), '') AS configuration, md5(pg_get_functiondef(p.oid)) AS definition_md5
      FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' ORDER BY p.proname, arguments
    `)).rows;
    catalog.policies = (await client.query(`
      SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
      FROM pg_policies WHERE schemaname = 'public' ORDER BY tablename, policyname
    `)).rows;
    catalog.grants = (await client.query(`
      SELECT table_schema, table_name, grantee, privilege_type FROM information_schema.role_table_grants
      WHERE table_schema = 'public' ORDER BY table_name, grantee, privilege_type
    `)).rows;
    const fingerprint = sha256(JSON.stringify(canonical({ catalog, roles, control, counts })));
    const target = manifest.approved_preview_target;
    const exactParent = JSON.stringify(ledger) === JSON.stringify(expectedLedger(manifest, false));
    const exactResult = JSON.stringify(ledger) === JSON.stringify(expectedLedger(manifest, true));
    const checks = {
      providerProjectMatches: nonempty(target.project_id) && identity.neon_project_id === target.project_id,
      providerBranchIdMatches: identity.neon_branch_id === target.branch_id,
      providerBranchNameMatches: identity.neon_branch_name === target.branch_name,
      databaseMatches: nonempty(target.database) && identity.database === target.database,
      roleMatches: nonempty(target.migration_role) && identity.session_role === target.migration_role && identity.current_role === target.migration_role,
      endpointMatches: nonempty(target.endpoint_hostname_sha256) && context.endpointHostnameSha256 === target.endpoint_hostname_sha256,
      ledgerIsExactParent: exactParent,
      ledgerIsExactResult: exactResult,
      solePending0014: exactParent && manifest.result_lineage_entry.index === manifest.parent_lineage.length,
      rolesSafe: REQUIRED_ROLES.every((name) => roles.some((role) => role.rolname === name && !role.rolcanlogin && !role.rolbypassrls)),
      migrationRoleCanCreateRole: roles.some((role) => role.rolname === identity.session_role && role.rolcreaterole),
      temporaryOwnerCapabilitiesAbsent: !membership.can_set_owner && !membership.owner_can_create_public,
      controlsDefaultOff: control?.operations_allowed === false && control?.runtime_allowed !== "true" && control?.allowlist_empty === true,
      activePresenceEmpty: counts.active_leases === 0 && counts.active_waves === 0 && counts.active_capabilities === 0,
      capabilitiesRelationPresent: Boolean(capabilitiesRelation),
    };
    await client.query("ROLLBACK");
    return { identity, ledger: ledger.map(([createdAt, hash], index) => ({ index, createdAt, hash })), roles,
      ownerCapabilityCleanup: membership, control, activeCounts: counts,
      schemaRpcRlsGrantFingerprintSha256: fingerprint, checks };
  } catch (error) {
    try { await client.query("ROLLBACK"); } catch { /* connection may be unavailable */ }
    throw error;
  } finally {
    await client.end();
  }
}

function requirePreflight(manifest, preflight) {
  const requiredChecks = ["providerProjectMatches", "providerBranchIdMatches", "providerBranchNameMatches",
    "databaseMatches", "roleMatches", "endpointMatches", "ledgerIsExactParent", "solePending0014", "rolesSafe",
    "migrationRoleCanCreateRole", "temporaryOwnerCapabilitiesAbsent", "controlsDefaultOff", "activePresenceEmpty"];
  if (requiredChecks.some((name) => preflight.checks[name] !== true) || preflight.checks.capabilitiesRelationPresent) {
    fail("Preflight does not prove the exact safe parent state", preflight.checks);
  }
  if (preflight.schemaRpcRlsGrantFingerprintSha256 !== manifest.fingerprints.parent.sha256) {
    fail("Observed parent fingerprint differs from the frozen accepted fingerprint");
  }
}

function runMigration(context) {
  const env = { ...process.env };
  delete env.DATABASE_URL;
  env.DATABASE_URL = context.connectionString;
  const result = spawnSync("npm", ["run", "db:migrate"], { cwd: ROOT, env, encoding: "utf8", stdio: "pipe" });
  return { exitCode: result.status, signal: result.signal, error: result.error?.message ?? null,
    stdout: result.stdout ?? "", stderr: result.stderr ?? "" };
}

function parseExecuteArgument() {
  const args = process.argv.slice(2);
  if (args.some((argument) => argument !== "--execute") || args.filter((argument) => argument === "--execute").length > 1) {
    fail("Unknown or duplicate arguments are forbidden");
  }
  return args.length === 1;
}

async function main(execute) {
  const manifest = loadManifest();
  const context = connectionContext();
  emit("audit_started", { mode: execute ? "execute_requested" : "audit_only", release: manifest.release }, context);
  const artifacts = auditArtifacts(manifest);
  emit("artifact_audit", { status: "PASS", artifacts }, context);
  if (execute) assertExecutionAuthority(manifest, context);
  const preflight = await collect(manifest, context);
  emit("database_preflight", { status: "COLLECTED", preflight }, context);
  if (!execute) {
    emit("audit_complete", { status: "NO_GO_AUDIT_ONLY", executionAuthorized: false }, context);
    return;
  }
  requirePreflight(manifest, preflight);
  const immediateArtifacts = auditArtifacts(manifest);
  emit("immediate_pre_execute_artifact_audit", { status: "PASS", artifacts: immediateArtifacts }, context);
  emit("migration_subprocess_started", { mechanism: "npm run db:migrate" }, context);
  const subprocess = runMigration(context);
  emit("migration_subprocess_completed", { status: subprocess.exitCode === 0 ? "ZERO_EXIT" : "NONZERO_OR_INTERRUPTED", subprocess }, context);
  let postflight = null;
  try {
    postflight = await collect(manifest, context);
    emit("database_postflight", { status: "COLLECTED", postflight }, context);
  } catch (error) {
    emit("incident", { status: "POSTFLIGHT_UNAVAILABLE", error: error.message, details: error.details }, context);
    throw error;
  }
  if (subprocess.exitCode !== 0) {
    emit("incident", { status: "MIGRATION_NONZERO_OR_PARTIAL_OUTCOME", subprocess, postflight }, context);
    fail("Migration did not complete cleanly; do not rerun and classify actual target state", { exitCode: subprocess.exitCode });
  }
  const exactPostflightIdentity = ["providerProjectMatches", "providerBranchIdMatches",
    "providerBranchNameMatches", "databaseMatches", "roleMatches", "endpointMatches"]
    .every((name) => postflight.checks[name] === true);
  if (!exactPostflightIdentity || !postflight.checks.ledgerIsExactResult || !postflight.checks.capabilitiesRelationPresent ||
      !postflight.checks.controlsDefaultOff || !postflight.checks.activePresenceEmpty ||
      !postflight.checks.temporaryOwnerCapabilitiesAbsent ||
      postflight.schemaRpcRlsGrantFingerprintSha256 !== manifest.fingerprints.result.sha256) {
    emit("incident", { status: "POSTFLIGHT_MISMATCH", postflight }, context);
    fail("Postflight differs from the frozen accepted result; stop and restore or forward-repair");
  }
  emit("execution_complete", { status: "REQUIRES_INDEPENDENT_POST_EXECUTION_REFUTATION", postflight }, context);
}

let contextForFailure = { secrets: [] };
try {
  const execute = parseExecuteArgument();
  contextForFailure = connectionContext();
  await main(execute);
} catch (error) {
  emit("incident", { status: "NO_GO", error: error instanceof Error ? error.message : "Unknown failure",
    details: error?.details ?? null }, contextForFailure);
  process.exitCode = 1;
}
