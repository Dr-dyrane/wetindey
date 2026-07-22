import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const root = process.cwd();
const read = (path: string) => readFileSync(resolve(root, path), "utf8");
const sha256 = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");

const migration = read("src/db/migrations/0014_presence_capabilities.sql");
const snapshot = JSON.parse(read("src/db/migrations/meta/0014_snapshot.json")) as {
  id: string;
  prevId: string;
  tables: Record<string, { columns: Record<string, unknown> }>;
};
const journal = JSON.parse(read("src/db/migrations/meta/_journal.json")) as {
  entries: Array<{ idx: number; tag: string }>;
};
const schema = read("src/db/schema/presence.ts");
const services = read("src/db/pillars/80-presence-services.sql");
const security = read("src/db/pillars/90-presence-security.sql");

test("0011, 0012, and 0013 lineage is frozen and 0014 is append-only", () => {
  assert.equal(
    sha256(readFileSync(resolve(root, "src/db/migrations/0011_classy_the_stranger.sql"))),
    "1ad4a33a06dfdc58affcfa92dc7085b5843478e09761ee26a24c7cd6b3c0151b",
  );
  assert.equal(
    sha256(readFileSync(resolve(root, "src/db/migrations/meta/0011_snapshot.json"))),
    "c34ec53b14810f020d0c3ff53500c1767fabe884cb73e2cb30fbfb72f0b60f9d",
  );
  assert.equal(
    sha256(readFileSync(resolve(root, "src/db/migrations/0012_guarded_presence.sql"))),
    "a8b31034aae22a6e9fa62416df8a1bb483c6783947fdf742c674e82cac373302",
  );
  assert.equal(
    sha256(readFileSync(resolve(root, "src/db/migrations/meta/0012_snapshot.json"))),
    "40ba03232a62da4e0b3ad6b72c27db93927801e15dd98c0b8938cd9bf0fc8148",
  );
  assert.equal(
    sha256(readFileSync(resolve(root, "src/db/migrations/0013_contribution_integrity.sql"))),
    "052769850c3d633230d9ec109c2b09067b73a686cadb7c139a613622184f0f0a",
  );
  assert.equal(
    sha256(readFileSync(resolve(root, "src/db/migrations/meta/0013_snapshot.json"))),
    "a0787dd0b1f617c72130965438662dfa4e13a6a6e13f0c09a17e6e231335e9bc",
  );
  // The journal is append-only, so an exact tail is wrong once later migrations
  // land. Assert the 0014 entry sits at its own idx without forbidding successors.
  const entry0014 = journal.entries.find((entry) => entry.idx === 14);
  assert.ok(entry0014, "journal must hold the 0014 entry");
  assert.equal(entry0014.tag, "0014_presence_capabilities");
  assert.equal(journal.entries.slice(0, 14).map((entry) => entry.tag).join(","),
    "0000_careless_piledriver,0001_cute_harrier,0002_calm_meteorite,0003_condemned_sally_floyd,0004_old_mordo,0005_handy_brood,0006_ordinary_meltdown,0007_gray_king_cobra,0008_sturdy_lockjaw,0009_observation_provenance,0010_public_source_ingestion_boundary,0011_classy_the_stranger,0012_guarded_presence,0013_contribution_integrity");
});

test("0014 metadata contains only the capability correction delta", () => {
  assert.equal(snapshot.prevId, "9ab87346-01b0-4a36-a3f1-bc3708d079a1");
  for (const table of ["public.presence_activation_requests", "public.presence_capabilities"]) {
    assert.ok(snapshot.tables[table], `${table} missing from snapshot`);
  }
  const preferences = snapshot.tables["public.presence_preferences"];
  assert.ok(preferences);
  assert.ok(preferences.columns.name_consented);
  assert.ok(preferences.columns.avatar_consented);
  assert.ok(preferences.columns.avatar_projection_epoch);
  assert.equal(preferences.columns.profile_consented, undefined);
  assert.equal(preferences.columns.avatar_url, undefined);
  assert.match(schema, /runtimeAllowed: boolean\("runtime_allowed"\)\.notNull\(\)\.default\(false\)/);
  assert.match(migration, /ALTER TABLE public\.presence_control[\s\S]*ADD COLUMN runtime_allowed boolean NOT NULL DEFAULT false/);
  assert.match(migration, /UPDATE public\.presence_preferences[\s\S]*profile_consented/);
  assert.match(migration, /DROP COLUMN IF EXISTS profile_consented[\s\S]*DROP COLUMN IF EXISTS avatar_url/);
  assert.match(migration, /GRANT wetindey_presence_owner TO SESSION_USER[\s\S]*SET LOCAL ROLE wetindey_presence_owner/);
  assert.match(migration, /RESET ROLE[\s\S]*REVOKE CREATE ON SCHEMA public/);
});

test("opaque capability and idempotency contracts are present", () => {
  for (const name of [
    "presence_activation_status",
    "presence_capability_purpose",
    "presence_capability_state",
    "presence_activation_requests",
    "presence_capabilities",
  ]) {
    assert.match(migration, new RegExp(name));
  }
  assert.match(migration, /presence_reports[\s\S]*idempotency_digest/);
  assert.match(services, /presence_activate_v2\(/);
  assert.match(services, /presence_snapshot_v2\(/);
  assert.match(services, /presence_wave_v2\(/);
  assert.match(services, /presence_block_v2\(/);
  assert.match(services, /presence_report_v2\(/);
  assert.match(services, /presence_v2_pair_lock/);
  assert.match(services, /presence-activation:/);
  assert.match(services, /presence-wave:/);
  assert.match(services, /presence-report:/);
  assert.match(services, /presence_v2_revoke_pair/);
  assert.match(services, /presence_v2_lease_revoke_trigger/);
  assert.match(services, /runtime_allowed/);
  assert.match(services, /gen_random_bytes\(32\)/);
  assert.match(services, /public\.gen_random_bytes\(32\)/);
  assert.match(services, /presence_activation_requests[\s\S]*lease-revoked/);
  assert.match(services, /avatar_projection_token/);
  assert.doesNotMatch(services.match(/presence_snapshot_v2\([\s\S]*?\n\$\$;/)?.[0] ?? "", /subject_account_id|subject_lease_id|wave_id/);
  assert.doesNotMatch(
    services.match(/presence_activate_v2\([\s\S]*?\n\$\$;/)?.[0] ?? "",
    /RETURNS TABLE\s*\([^)]*(?:lease_id|centroid_latitude|centroid_longitude)/,
  );
  assert.doesNotMatch(services.match(/presence_snapshot_v2\([\s\S]*?\n\$\$;/)?.[0] ?? "", /avatar_url/);
  for (const source of [migration, services]) {
    assert.doesNotMatch(
      source,
      /GRANT EXECUTE ON FUNCTION public\.presence_(?:set_preferences|activate|stop|snapshot|wave|block|report)\([\s\S]*?TO wetindey_presence_runtime/,
    );
  }
  assert.match(migration, /Wave idempotency digest is bound to another subject/);
  assert.match(migration, /report idempotency digest is bound to another subject/);
  assert.match(services, /Wave idempotency digest is bound to another subject/);
  assert.match(services, /report idempotency digest is bound to another subject/);
  assert.doesNotMatch(
    migration.match(/presence_block_v2\([\s\S]*?\n\$\$;/)?.[0] ?? "",
    /p_idempotency_digest/,
  );
});

test("security remains forced-RLS, no-PUBLIC, and v2-runtime-only", () => {
  for (const table of [
    "presence_activation_requests",
    "presence_capabilities",
  ]) {
    assert.match(security, new RegExp(`ALTER TABLE public\\.${table} FORCE ROW LEVEL SECURITY`));
    assert.match(security, new RegExp(`REVOKE ALL ON TABLE[\\s\\S]*public\\.${table}`));
  }
  assert.match(security, /REVOKE EXECUTE ON FUNCTION public\.presence_activate\(/);
  assert.match(security, /GRANT EXECUTE ON FUNCTION public\.presence_activate_v2\(/);
  assert.match(security, /GRANT EXECUTE ON FUNCTION public\.presence_snapshot_v2\(/);
  assert.match(security, /GRANT EXECUTE ON FUNCTION public\.presence_report_v2\(/);
  assert.match(security, /CREATE OR REPLACE TRIGGER presence_v2_lease_revoke_trigger/);
  assert.match(security, /ALTER TABLE public\.presence_capabilities OWNER TO wetindey_presence_owner/);
  assert.doesNotMatch(security, /GRANT (SELECT|INSERT|UPDATE|DELETE|ALL) ON TABLE[\s\S]*presence_capabilities[\s\S]*wetindey_presence_runtime/);
  assert.ok(
    security.lastIndexOf("ALTER TABLE public.presence_capabilities OWNER TO wetindey_presence_owner")
      < security.lastIndexOf("REVOKE CREATE ON SCHEMA public FROM wetindey_presence_owner"),
    "temporary owner cleanup must follow v2 ownership transfers",
  );
});

test("canonical pillars are embedded in the forward migration", () => {
  assert.ok(migration.includes(services.slice(services.indexOf("-- 0014 forward security boundary."))));
  assert.ok(migration.includes(security.slice(security.indexOf("-- 0014 capability security."))));
});
