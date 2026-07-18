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

test("RLS and grants fail closed", () => {
  for (const table of presenceTables) {
    assert.match(security, new RegExp(`ALTER TABLE public\\.${table} FORCE ROW LEVEL SECURITY`));
  }
  assert.match(security, /wetindey_presence_owner NOLOGIN NOBYPASSRLS/);
  assert.match(security, /wetindey_presence_runtime NOLOGIN NOBYPASSRLS/);
  assert.match(security, /wetindey_presence_safety NOLOGIN NOBYPASSRLS/);
  assert.match(security, /FROM PUBLIC, wetindey_presence_runtime, wetindey_presence_safety/);
  assert.doesNotMatch(security, /GRANT (SELECT|INSERT|UPDATE|DELETE|ALL) ON TABLE/i);
  assert.doesNotMatch(security, /GRANT EXECUTE[\s\S]*presence_review_reports[\s\S]*TO wetindey_presence_runtime/);
  assert.doesNotMatch(security, /GRANT EXECUTE[\s\S]*presence_set_control[\s\S]*TO wetindey_presence_runtime/);
});
