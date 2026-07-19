import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const root = process.cwd();
const read = (path: string) => readFileSync(resolve(root, path), "utf8");
const sha256 = (value: string | Buffer) =>
  createHash("sha256").update(value).digest("hex");

const migrationPath = "src/db/migrations/0012_guarded_presence.sql";
const snapshotPath = "src/db/migrations/meta/0012_snapshot.json";
const journalPath = "src/db/migrations/meta/_journal.json";
const schemaPath = "src/db/schema/presence.ts";
const servicesPath = "src/db/pillars/80-presence-services.sql";
const securityPath = "src/db/pillars/90-presence-security.sql";

const migration = read(migrationPath);
const snapshot = JSON.parse(read(snapshotPath)) as {
  prevId: string;
  tables: Record<string, unknown>;
};
const journal = JSON.parse(read(journalPath)) as {
  version: string;
  dialect: string;
  entries: Array<{
    idx: number;
    version: string;
    when: number;
    tag: string;
    breakpoints: boolean;
  }>;
};
const schema = read(schemaPath);
const services = read(servicesPath);
const security = read(securityPath);

const presenceTables = [
  "presence_control",
  "presence_preferences",
  "presence_leases",
  "presence_blocks",
  "presence_waves",
  "presence_reports",
  "presence_rate_buckets",
] as const;

const publicRpcs = [
  "presence_set_preferences",
  "presence_activate",
  "presence_stop",
  "presence_snapshot",
  "presence_wave",
  "presence_block",
  "presence_report",
  "presence_review_reports",
  "presence_set_control",
] as const;

test("frozen 0011 artifacts and journal prefix remain exact", () => {
  assert.equal(
    sha256(readFileSync(resolve(root, "src/db/migrations/0011_classy_the_stranger.sql"))),
    "1ad4a33a06dfdc58affcfa92dc7085b5843478e09761ee26a24c7cd6b3c0151b",
  );
  assert.equal(
    sha256(readFileSync(resolve(root, "src/db/migrations/meta/0011_snapshot.json"))),
    "c34ec53b14810f020d0c3ff53500c1767fabe884cb73e2cb30fbfb72f0b60f9d",
  );
  assert.equal(
    sha256(
      `${JSON.stringify({
        version: journal.version,
        dialect: journal.dialect,
        entries: journal.entries.slice(0, 12),
      })}\n`,
    ),
    "53879b6f64d36205545d71857e87bd6d87001e736c25797a37cbe94e472320bd",
  );
  assert.deepEqual(journal.entries.at(-1), {
    idx: 12,
    version: "7",
    when: journal.entries[12]?.when,
    tag: "0012_guarded_presence",
    breakpoints: true,
  });
});

test("0012 is the reduced seven-table default-off core", () => {
  for (const table of presenceTables) {
    assert.match(schema, new RegExp(`"${table}"`));
    assert.ok(snapshot.tables[`public.${table}`], `${table} missing from snapshot`);
    assert.match(migration, new RegExp(`CREATE TABLE "${table}"`));
  }
  assert.equal(
    Object.keys(snapshot.tables).filter((name) => name.startsWith("public.presence_")).length,
    presenceTables.length,
  );
  assert.doesNotMatch(migration, /presence_(snapshots|capabilities|safety_holds|budget_policy)/);
  assert.match(schema, /operationsAllowed: boolean\("operations_allowed"\)\.notNull\(\)\.default\(false\)/);
  assert.match(migration, /VALUES \(1, false\)\s+ON CONFLICT \(id\) DO NOTHING/);
  assert.match(migration, /allowlist_account_a" uuid,\s+"allowlist_account_b" uuid,/);
});

test("unsafe profile presence state is dropped without a backfill", () => {
  for (const column of ["location_sharing", "latitude", "longitude"]) {
    assert.equal(
      migration.match(new RegExp(`DROP COLUMN "${column}"`, "g"))?.length,
      1,
      `${column} must be dropped exactly once`,
    );
  }
  assert.doesNotMatch(
    migration,
    /INSERT INTO public\.presence_leases[\s\S]{0,500}user_profiles/i,
  );
  const userProfiles = snapshot.tables["public.user_profiles"] as {
    columns: Record<string, unknown>;
  };
  assert.ok(!("location_sharing" in userProfiles.columns));
  assert.ok(!("latitude" in userProfiles.columns));
  assert.ok(!("longitude" in userProfiles.columns));
});

test("canonical service and security pillars are embedded in 0012", () => {
  assert.ok(migration.includes(services.trim()));
  assert.ok(migration.includes(security.trim()));
  for (const rpc of publicRpcs) {
    assert.equal(
      services.match(new RegExp(`CREATE OR REPLACE FUNCTION public\\.${rpc}\\(`, "g"))
        ?.length,
      1,
      `${rpc} must be declared exactly once in the service pillar`,
    );
  }
  assert.match(services, /ST_DWithin\(subject\.centroid, v_viewer\.centroid, 5000\)/);
  assert.match(services, /LIMIT 50/);
  assert.match(services, /interval '15 minutes'/);
  assert.match(services, /active presence leases cannot renew/);
  assert.match(services, /ON CONFLICT \(sender_account_id, idempotency_digest\)/);
  assert.match(services, /v_day_limit := v_control\.wave_limit_day/);
  assert.match(services, /disable and purge presence before replacing configuration/);
  assert.match(services, /generation = generation \+ 1/);
  assert.match(
    services,
    /CREATE OR REPLACE FUNCTION public\.presence_review_reports[\s\S]*?BEGIN\s+PERFORM public\.presence_cleanup_internal\(\);/,
  );
  const reportRpc = services.match(
    /CREATE OR REPLACE FUNCTION public\.presence_report\([\s\S]*?\n\$\$;/,
  )?.[0];
  assert.ok(reportRpc);
  assert.doesNotMatch(reportRpc, /presence_pair_is_safe/);
  assert.match(services, /generation = generation \+ CASE WHEN p_operations_allowed THEN 0 ELSE 1 END/);
  assert.match(services, /IF NOT p_operations_allowed THEN\s+DELETE FROM public\.presence_leases;\s+DELETE FROM public\.presence_waves;/);
});

test("all executable RPC result columns are qualified and type exact", () => {
  assert.match(
    services,
    /FROM public\.presence_leases existing_lease\s+WHERE existing_lease\.account_id = p_actor[\s\S]*?existing_lease\.expires_at > clock_timestamp\(\)/,
  );
  assert.match(
    services,
    /FROM public\.presence_leases viewer_lease\s+WHERE viewer_lease\.account_id = p_actor[\s\S]*?viewer_lease\.control_generation = v_control\.generation/,
  );
  assert.match(
    services,
    /FROM public\.presence_leases sender_lease\s+WHERE sender_lease\.account_id = p_actor[\s\S]*?sender_lease\.expires_at > clock_timestamp\(\)/,
  );
  assert.match(
    services,
    /FROM public\.presence_leases recipient_lease\s+WHERE recipient_lease\.account_id = p_recipient[\s\S]*?recipient_lease\.expires_at > clock_timestamp\(\)/,
  );
  assert.equal(
    services.match(
      /CASE WHEN (?:bounded|preference)\.profile_consented THEN (?:bounded|preference)\.display_name::text ELSE NULL::text END/g,
    )?.length,
    2,
  );
  assert.match(
    services,
    /UPDATE public\.presence_reports report\s+SET resolution = 'closed'[\s\S]*?report\.id = p_report_id AND report\.resolution = 'open'/,
  );
});

test("retention and account deletion have explicit least-privilege boundaries", () => {
  assert.match(
    services,
    /CREATE OR REPLACE FUNCTION public\.presence_run_retention_cleanup\(\)[\s\S]*?PERFORM public\.presence_cleanup_internal\(\);/,
  );
  assert.match(
    services,
    /CREATE OR REPLACE FUNCTION public\.presence_delete_account\(\s+p_actor uuid,\s+p_session_digest text DEFAULT NULL,\s+p_device_digest text DEFAULT NULL,\s+p_network_digest text DEFAULT NULL/,
  );
  assert.match(
    services,
    /operations_allowed = false,[\s\S]*?generation = generation \+ 1/,
  );
  assert.match(
    services,
    /DELETE FROM public\.presence_preferences\s+WHERE account_id = p_actor/,
  );
  assert.match(
    services,
    /DELETE FROM public\.presence_blocks\s+WHERE blocker_account_id = p_actor OR blocked_account_id = p_actor/,
  );
  assert.match(
    services,
    /dimension = 'account' AND key_digest = v_account_digest/,
  );
  assert.equal(
    services.match(
      /public\.presence_erasure_uuid\(report\.id, 'deleted-(?:reporter|subject)'\)/g,
    )?.length,
    2,
  );
  assert.equal(
    services.match(/UPDATE public\.presence_reports report\s+SET[\s\S]*?details = NULL/g)
      ?.length,
    2,
  );
  assert.match(security, /wetindey_presence_lifecycle NOLOGIN NOBYPASSRLS/);
  assert.match(
    security,
    /GRANT EXECUTE ON FUNCTION public\.presence_run_retention_cleanup\(\)\s+TO wetindey_presence_safety/,
  );
  assert.match(
    security,
    /GRANT EXECUTE ON FUNCTION public\.presence_delete_account\(uuid, text, text, text\)\s+TO wetindey_presence_lifecycle/,
  );
  assert.doesNotMatch(
    security,
    /GRANT EXECUTE ON FUNCTION public\.presence_delete_account[\s\S]*?TO wetindey_presence_runtime/,
  );
});

test("RLS and grants fail closed", () => {
  for (const table of presenceTables) {
    assert.match(security, new RegExp(`ALTER TABLE public\\.${table} FORCE ROW LEVEL SECURITY`));
  }
  assert.match(security, /wetindey_presence_owner NOLOGIN NOBYPASSRLS/);
  assert.match(security, /wetindey_presence_runtime NOLOGIN NOBYPASSRLS/);
  assert.match(security, /wetindey_presence_safety NOLOGIN NOBYPASSRLS/);
  assert.match(security, /wetindey_presence_lifecycle NOLOGIN NOBYPASSRLS/);
  assert.match(security, /FROM PUBLIC, wetindey_presence_runtime, wetindey_presence_safety/);
  assert.match(
    security,
    /REVOKE USAGE ON TYPE\s+public\.presence_rate_dimension,\s+public\.presence_rate_operation,\s+public\.presence_report_kind,\s+public\.presence_report_resolution\s+FROM PUBLIC/,
  );
  assert.doesNotMatch(security, /GRANT (SELECT|INSERT|UPDATE|DELETE|ALL) ON TABLE/i);
  assert.doesNotMatch(security, /GRANT EXECUTE[\s\S]*presence_review_reports[\s\S]*TO wetindey_presence_runtime/);
  assert.doesNotMatch(security, /GRANT EXECUTE[\s\S]*presence_set_control[\s\S]*TO wetindey_presence_runtime/);
});

test("ownership portability uses and removes only transaction-local capability", () => {
  const roleCreation = security.indexOf(
    "CREATE ROLE wetindey_presence_owner NOLOGIN NOBYPASSRLS",
  );
  const nonInheritedMembership = security.indexOf(
    "GRANT wetindey_presence_owner TO SESSION_USER WITH INHERIT FALSE",
  );
  const setMembership = security.indexOf(
    "GRANT wetindey_presence_owner TO SESSION_USER WITH SET TRUE",
  );
  const schemaCreate = security.indexOf(
    "GRANT CREATE ON SCHEMA public TO wetindey_presence_owner",
  );
  const firstOwnershipTransfer = security.indexOf(
    "ALTER TABLE public.presence_control OWNER TO wetindey_presence_owner",
  );
  const lastOwnershipTransfer = security.indexOf(
    "ALTER FUNCTION public.presence_set_control(",
    firstOwnershipTransfer,
  );
  const schemaCreateRevoke = security.indexOf(
    "REVOKE CREATE ON SCHEMA public FROM wetindey_presence_owner",
  );
  const membershipRevoke = security.indexOf(
    "REVOKE wetindey_presence_owner FROM SESSION_USER\n  GRANTED BY SESSION_USER",
  );
  const catalogPostcondition = security.indexOf(
    "migration principal retains a SET path to the presence owner",
  );

  assert.ok(roleCreation >= 0);
  assert.ok(roleCreation < nonInheritedMembership);
  assert.ok(nonInheritedMembership < setMembership);
  assert.ok(setMembership < schemaCreate);
  assert.ok(schemaCreate < firstOwnershipTransfer);
  assert.ok(firstOwnershipTransfer < lastOwnershipTransfer);
  assert.ok(lastOwnershipTransfer < schemaCreateRevoke);
  assert.ok(schemaCreateRevoke < membershipRevoke);
  assert.ok(membershipRevoke < catalogPostcondition);
  assert.equal(
    security.match(
      /GRANT wetindey_presence_owner TO SESSION_USER WITH SET TRUE/g,
    )?.length,
    1,
  );
  assert.equal(
    security.match(
      /REVOKE wetindey_presence_owner FROM SESSION_USER\s+GRANTED BY SESSION_USER/g,
    )?.length,
    1,
  );
  assert.match(
    security,
    /pg_has_role\(\s*session_user,\s*'wetindey_presence_owner',\s*'SET'\s*\)/,
  );
  assert.match(
    security,
    /FROM pg_auth_members membership[\s\S]*?granted_role\.rolname = 'wetindey_presence_owner'[\s\S]*?member_role\.rolname = session_user[\s\S]*?membership\.set_option OR membership\.inherit_option/,
  );
  assert.match(
    security,
    /JOIN pg_roles grantor_role ON grantor_role\.oid = membership\.grantor[\s\S]*?grantor_role\.rolname = session_user[\s\S]*?migration principal retains its transient owner grant/,
  );
  assert.match(
    security,
    /has_schema_privilege\(\s*'wetindey_presence_owner',\s*'public',\s*'CREATE'\s*\)/,
  );
});
