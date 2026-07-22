import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";

type Row = Record<string, unknown>;
type Database = {
  exec(sql: string): Promise<unknown>;
  query<T extends Row = Row>(sql: string): Promise<{ rows: T[] }>;
  close(): Promise<void>;
};
type PGliteConstructor = new (options?: unknown) => Database;

const root = path.resolve(import.meta.dirname, "../..");
const migrationsDirectory = path.join(root, "src/db/migrations");
const read = (relativePath: string) => readFileSync(path.join(root, relativePath), "utf8");
const sha256 = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
const candidatePath = "src/db/migrations/0015_contribution_moderation_operations.sql";
const candidate = read(candidatePath);
const services = read("src/db/pillars/80-contribution-services.sql");
const security = read("src/db/pillars/90-contribution-security.sql");
const snapshot = JSON.parse(read("src/db/migrations/meta/0015_snapshot.json")) as {
  id: string;
  prevId: string;
};
const journal = JSON.parse(read("src/db/migrations/meta/_journal.json")) as {
  entries: Array<{ idx: number; tag: string; when: number }>;
};
const manifest = JSON.parse(read("src/db/migrations/meta/0015_release_manifest.json")) as {
  kind: string;
  release: string;
  status: string;
  shared_database_applied: boolean;
  parent_release: string;
  parent_snapshot_id: string;
  result_snapshot_id: string;
  artifacts: Record<string, { path: string; sha256: string; entry_index?: number; entry_when?: string }>;
  source_sha256: Record<string, string>;
};

const frozenMigrationHashes: Record<string, string> = {
  "0000_careless_piledriver.sql": "71be7b38a05007fdb05c4f3a773c643796f090305c78379c2813a37cb88933fd",
  "0001_cute_harrier.sql": "6ed801dcd1e68d6214539aa48bcec349115bcdd1a5cc82f103387275bf5c2ccb",
  "0002_calm_meteorite.sql": "0ce00cbcd239ac0cc52d94e5e423b3902514116eda6b2eabd910a867bd840ff7",
  "0003_condemned_sally_floyd.sql": "0cce50bd4f13b5a6956452da588ce4ccc5cada203303370b472eba374735ce81",
  "0004_old_mordo.sql": "b7b6e97b3c40af6f0b34f34bf06cb6ff206fb0f127c38f444c5099bffca42645",
  "0005_handy_brood.sql": "d98917554fda9e094c57db5f0195063c8c803cae47b601dcb93e14502928c509",
  "0006_ordinary_meltdown.sql": "1373746f002441dd43ce8185fc2e9cdccbaaf513768557e56ffbf208b9235fa3",
  "0007_gray_king_cobra.sql": "c5d01c6bfb88b9386abe6fa3c9f68d5d345e9bd9f0f59bfb5e26027dfc2dc6f6",
  "0008_sturdy_lockjaw.sql": "150356e3db8061d2934fdc1176b84d2cd478aec2c9988550fac8bb26b2480073",
  "0009_observation_provenance.sql": "34dd394d6d4f1aad24a73edee5eb88a93441449a1ff86985b60d3ba04f927b4c",
  "0010_public_source_ingestion_boundary.sql": "9aa8cc511374010f1deb68ec330573a9c4940c2aff1188218d5f3e841fccd7fe",
  "0011_classy_the_stranger.sql": "1ad4a33a06dfdc58affcfa92dc7085b5843478e09761ee26a24c7cd6b3c0151b",
  "0012_guarded_presence.sql": "a8b31034aae22a6e9fa62416df8a1bb483c6783947fdf742c674e82cac373302",
  "0013_contribution_integrity.sql": "052769850c3d633230d9ec109c2b09067b73a686cadb7c139a613622184f0f0a",
  "0014_presence_capabilities.sql": "ed532eab5f7941245cfebb66463a2194ab9df235b30f9fd678e1c0e1065008bf",
};

function migration(index: number): string {
  const prefix = `${index.toString().padStart(4, "0")}_`;
  const files = readdirSync(migrationsDirectory).filter((file) => file.startsWith(prefix));
  assert.equal(files.length, 1, `expected exactly one ${prefix} migration`);
  return read(`src/db/migrations/${files[0]}`);
}

function pgliteSecurityAdapter(sql: string): string {
  return sql.replace(
    /  IF pg_has_role\(\s*session_user,\s*'wetindey_(?:presence|contribution)_owner',\s*'SET'\s*\) THEN[\s\S]*?  END IF;\n\n/g,
    "",
  );
}

async function apply(db: Database, sql: string): Promise<void> {
  await db.exec("BEGIN");
  try {
    await db.exec(pgliteSecurityAdapter(sql));
    await db.exec("COMMIT");
  } catch (error) {
    await db.exec("ROLLBACK");
    throw error;
  }
}

async function applyThrough(db: Database, last: number): Promise<void> {
  for (let index = 0; index <= last; index += 1) await apply(db, migration(index));
}

async function withRole<T>(db: Database, role: string, action: () => Promise<T>): Promise<T> {
  await db.exec(`SET ROLE ${role}`);
  try {
    return await action();
  } finally {
    await db.exec("RESET ROLE");
  }
}

async function expectReject(action: () => Promise<unknown>, pattern: RegExp): Promise<void> {
  let error: unknown;
  try {
    await action();
  } catch (caught) {
    error = caught;
  }
  assert.ok(error instanceof Error, "expected rejection");
  assert.match(error.message, pattern);
}

async function openDatabase(PGlite: PGliteConstructor): Promise<Database> {
  const moduleDirectory = process.env.PGLITE_MODULE_DIR;
  assert.ok(moduleDirectory, "PGLITE_MODULE_DIR is required for disposable PG17 execution");
  const postgis = (await import(pathToFileURL(path.join(moduleDirectory, "@electric-sql/pglite-postgis/dist/index.js")).href)) as { postgis: unknown };
  const db = new PGlite({ extensions: { postgis: postgis.postgis } });
  await db.exec("CREATE EXTENSION postgis");
  return db;
}

test("0015 is a forward-only service delta with deterministic detached metadata", () => {
  for (const [file, hash] of Object.entries(frozenMigrationHashes)) {
    assert.equal(sha256(read(`src/db/migrations/${file}`)), hash, `${file} changed`);
  }
  assert.equal(sha256(read("src/db/migrations/meta/0014_snapshot.json")), "2a83ceda227c1a9721f767b0270a4aef6f3cb7a8b3501ae5725c482011ec2bdf");
  assert.equal(snapshot.prevId, "667de345-b0c2-43f5-9e37-a7c00e30ea50");
  assert.match(snapshot.id, /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  assert.deepEqual(journal.entries.slice(-1)[0], {
    idx: 15,
    version: "7",
    when: 1784653200000,
    tag: "0015_contribution_moderation_operations",
    breakpoints: true,
  });
  assert.equal(manifest.kind, "release_manifest");
  assert.equal(manifest.release, "0015_contribution_moderation_operations");
  assert.equal(manifest.status, "candidate_unapplied");
  assert.equal(manifest.shared_database_applied, false);
  assert.equal(manifest.parent_release, "0014_presence_capabilities");
  assert.equal(manifest.parent_snapshot_id, snapshot.prevId);
  assert.equal(manifest.result_snapshot_id, snapshot.id);
  for (const artifact of Object.values(manifest.artifacts)) {
    assert.equal(sha256(read(artifact.path)), artifact.sha256, `${artifact.path} manifest hash mismatch`);
  }
  for (const [file, hash] of Object.entries(manifest.source_sha256)) {
    assert.equal(sha256(read(file)), hash, `${file} source hash mismatch`);
  }
});

test("review detail has the exact definer contract and no direct-data expansion", () => {
  const functionSource = services.match(/CREATE OR REPLACE FUNCTION public\.contribution_review_detail\([\s\S]*?\n\$\$;/)?.[0] ?? "";
  assert.ok(functionSource, "review detail is missing from the services pillar");
  assert.match(functionSource, /PERFORM public\.contribution_assert_moderator\(p_actor\)/);
  assert.match(functionSource, /SECURITY DEFINER/);
  assert.match(functionSource, /SET search_path = pg_catalog/);
  assert.match(functionSource, /observation\.admission_id IS NOT NULL/);
  assert.match(functionSource, /contribution_effective_decision_id\(observation\.id\)/);
  for (const forbidden of ["email", "contact", "location", "address", "raw_payload", "subject_digest", "network", "payload_digest", "request_id", "notes"]) {
    assert.doesNotMatch(functionSource, new RegExp(forbidden, "i"), `${forbidden} leaked by review detail`);
  }
  assert.match(candidate, /CREATE OR REPLACE FUNCTION public\.contribution_review_detail\(/);
  assert.match(candidate, /GRANT EXECUTE ON FUNCTION public\.contribution_review_detail\(uuid, uuid\)\s+TO wetindey_contribution_moderator/);
  assert.match(candidate, /ALTER FUNCTION public\.contribution_review_detail\(uuid, uuid\)\s+OWNER TO wetindey_contribution_owner/);
  assert.doesNotMatch(candidate, /CREATE TABLE|ALTER TABLE|CREATE POLICY|GRANT (?:SELECT|INSERT|UPDATE|DELETE) ON TABLE/i);
  assert.match(security, /REVOKE ALL ON FUNCTION public\.contribution_review_detail\(uuid, uuid\)\s+FROM PUBLIC/);
  assert.match(security, /GRANT EXECUTE ON FUNCTION public\.contribution_review_detail\(uuid, uuid\)\s+TO wetindey_contribution_moderator/);
  assert.doesNotMatch(security, /GRANT (?:SELECT|INSERT|UPDATE|DELETE|ALL) ON TABLE[\s\S]*contribution_review_detail/i);
});

test("0015 installs from blank and 0000-0014 upgrade paths, rolls back, and remains executable only by an assigned moderator", async (context) => {
  const moduleDirectory = process.env.PGLITE_MODULE_DIR;
  if (!moduleDirectory) return context.skip("PGLITE_MODULE_DIR unavailable; static evidence remains only");
  const pgliteModule = (await import(pathToFileURL(path.join(moduleDirectory, "@electric-sql/pglite/dist/index.js")).href)) as { PGlite: PGliteConstructor };

  const blank = await openDatabase(pgliteModule.PGlite);
  try {
    await applyThrough(blank, 15);
  } finally {
    await blank.close();
  }

  const upgraded = await openDatabase(pgliteModule.PGlite);
  try {
    await applyThrough(upgraded, 14);
    await apply(upgraded, candidate);
    await apply(upgraded, candidate);

    const ids = {
      area: "10000000-0000-4000-8000-000000000001",
      place: "10000000-0000-4000-8000-000000000002",
      item: "10000000-0000-4000-8000-000000000003",
      variant: "10000000-0000-4000-8000-000000000004",
      unit: "10000000-0000-4000-8000-000000000005",
      source: "10000000-0000-4000-8000-000000000006",
      observation: "10000000-0000-4000-8000-000000000007",
      rejectedObservation: "10000000-0000-4000-8000-000000000008",
      decision: "10000000-0000-4000-8000-000000000009",
      rejectedDecision: "10000000-0000-4000-8000-000000000010",
      moderator: "20000000-0000-4000-8000-000000000001",
      moderator2: "20000000-0000-4000-8000-000000000002",
      issuer: "20000000-0000-4000-8000-000000000003",
      reviewer: "20000000-0000-4000-8000-000000000004",
    };
    await upgraded.exec(`
      INSERT INTO public.areas (id, slug, name, type, center, coverage_status)
      VALUES ('${ids.area}', 'review-area', 'Review Area', 'neighborhood', ST_SetSRID(ST_MakePoint(3.4, 6.5), 4326)::geography, 'active');
      INSERT INTO public.places (id, slug, name, place_type, area_id, location, verification_status, contact_visibility)
      VALUES ('${ids.place}', 'review-place', 'Review Place', 'market', '${ids.area}', ST_SetSRID(ST_MakePoint(3.41, 6.51), 4326)::geography, 'verified', 'private');
      INSERT INTO public.items (id, slug, canonical_name, category, active)
      VALUES ('${ids.item}', 'review-rice', 'Review Rice', 'food', true);
      INSERT INTO public.item_variants (id, item_id, slug, display_name, active)
      VALUES ('${ids.variant}', '${ids.item}', 'review-rice-50kg', 'Review Rice 50kg', true);
      INSERT INTO public.units (id, code, display_name, dimension, canonical_quantity)
      VALUES ('${ids.unit}', 'review_bag', 'Review bag', 'mass', 50);
      INSERT INTO public.sources (id, source_type, user_id, reliability_score_internal)
      VALUES ('${ids.source}', 'Contributor', NULL, 70);
      INSERT INTO public.observations (
        id, item_variant_id, unit_id, place_id, availability_state, price_amount,
        observed_at, submitted_at, source_id, collection_method, provenance,
        moderation_status, admission_id, raw_payload
      ) VALUES (
        '${ids.observation}', '${ids.variant}', '${ids.unit}', '${ids.place}', 'available', 125000,
        timestamp '2026-07-21 12:00:00', timestamp '2026-07-21 12:01:00', '${ids.source}', 'app_entry', 'observed', 'pending',
        '10000000-0000-4000-8000-000000000009', '{"kind":"report_price"}'::jsonb
      );
      INSERT INTO public.observations (
        id, item_variant_id, unit_id, place_id, availability_state, price_amount,
        observed_at, submitted_at, source_id, collection_method, provenance,
        moderation_status, admission_id, raw_payload
      ) VALUES (
        '${ids.rejectedObservation}', '${ids.variant}', '${ids.unit}', '${ids.place}', 'unavailable', NULL,
        timestamp '2026-07-21 12:02:00', timestamp '2026-07-21 12:03:00', '${ids.source}', 'app_entry', 'observed', 'pending',
        '10000000-0000-4000-8000-000000000011', '{"kind":"report_price"}'::jsonb
      );
      INSERT INTO public.contribution_control (id, reporting_allowed, moderation_allowed)
      VALUES (1, false, true)
      ON CONFLICT (id) DO UPDATE SET moderation_allowed = true;
      INSERT INTO public.contribution_moderator_assignments (
        account_id, status, issued_by_account_id, reviewed_by_account_id, effective_at
      ) VALUES
        ('${ids.moderator}', 'active', '${ids.issuer}', '${ids.reviewer}', clock_timestamp()),
        ('${ids.moderator2}', 'active', '${ids.issuer}', '${ids.reviewer}', clock_timestamp());
    `);

    for (const role of ["wetindey_contribution_runtime", "wetindey_contribution_control"]) {
      await expectReject(
        () => withRole(upgraded, role, () => upgraded.query(`SELECT * FROM public.contribution_review_detail('${ids.moderator}', '${ids.observation}')`)),
        /permission denied/,
      );
    }
    await upgraded.exec("CREATE ROLE contribution_contract_ordinary NOLOGIN");
    await expectReject(
      () => withRole(upgraded, "contribution_contract_ordinary", () => upgraded.query(`SELECT * FROM public.contribution_review_detail('${ids.moderator}', '${ids.observation}')`)),
      /permission denied/,
    );
    const result = await withRole(upgraded, "wetindey_contribution_moderator", () =>
      upgraded.query(`SELECT * FROM public.contribution_review_detail('${ids.moderator}', '${ids.observation}')`),
    );
    assert.equal(result.rows.length, 1);
    assert.deepEqual(Object.keys(result.rows[0]).sort(), [
      "actor_made_effective_decision", "attributed", "availability_state", "collection_method", "corrects_observation_id", "effective_decision_at", "effective_decision_id", "effective_decision_reason_code", "effective_decision_type", "has_decision_history", "item_id", "item_label", "item_variant_id", "observation_id", "observed_at", "place_id", "place_label", "price_amount", "reopened_after_reversal", "submitted_at", "unit_id", "unit_label", "variant_label",
    ].sort());
    assert.equal(result.rows[0].item_label, "Review Rice");
    assert.equal(result.rows[0].price_amount, 125000);
    assert.equal(result.rows[0].attributed, false);
    assert.equal(result.rows[0].has_decision_history, false);
    assert.equal(result.rows[0].reopened_after_reversal, false);
    assert.equal(result.rows[0].effective_decision_id, null);
    assert.equal(result.rows[0].actor_made_effective_decision, false);

    await upgraded.exec(`
      INSERT INTO public.contribution_moderation_decisions (
        id, observation_id, decision, actor_account_id, request_id, payload_digest, reason_code
      ) VALUES ('${ids.decision}', '${ids.observation}', 'approve', '${ids.moderator}',
        '10000000-0000-4000-8000-000000000010', repeat('a', 64), 'valid_evidence');
    `);
    const decided = await withRole(upgraded, "wetindey_contribution_moderator", () =>
      upgraded.query(`SELECT * FROM public.contribution_review_detail('${ids.moderator}', '${ids.observation}')`),
    );
    assert.equal(decided.rows[0].effective_decision_id, ids.decision);
    assert.equal(decided.rows[0].effective_decision_type, "approve");
    assert.equal(decided.rows[0].effective_decision_reason_code, "valid_evidence");
    assert.equal(decided.rows[0].has_decision_history, true);
    assert.equal(decided.rows[0].reopened_after_reversal, false);
    assert.equal(decided.rows[0].actor_made_effective_decision, true);

    const approvedByOther = await withRole(upgraded, "wetindey_contribution_moderator", () =>
      upgraded.query(`SELECT * FROM public.contribution_review_detail('${ids.moderator2}', '${ids.observation}')`),
    );
    assert.equal(approvedByOther.rows[0].effective_decision_type, "approve");
    assert.equal(approvedByOther.rows[0].actor_made_effective_decision, false);

    await upgraded.exec(`
      INSERT INTO public.contribution_moderation_decisions (
        id, observation_id, decision, actor_account_id, request_id, payload_digest, reason_code
      ) VALUES ('${ids.rejectedDecision}', '${ids.rejectedObservation}', 'reject', '${ids.moderator}',
        '10000000-0000-4000-8000-000000000012', repeat('c', 64), 'insufficient_evidence');
    `);
    const rejected = await withRole(upgraded, "wetindey_contribution_moderator", () =>
      upgraded.query(`SELECT * FROM public.contribution_review_detail('${ids.moderator}', '${ids.rejectedObservation}')`),
    );
    assert.equal(rejected.rows[0].effective_decision_type, "reject");
    assert.equal(rejected.rows[0].has_decision_history, true);
    assert.equal(rejected.rows[0].reopened_after_reversal, false);
    assert.equal(rejected.rows[0].actor_made_effective_decision, true);

    await withRole(upgraded, "wetindey_contribution_moderator", () =>
      upgraded.query(`
        SELECT * FROM public.contribution_moderate(
          '${ids.moderator2}'::uuid,
          '10000000-0000-4000-8000-000000000013'::uuid,
          repeat('d', 64),
          '${ids.observation}'::uuid,
          'reverse'::public.contribution_decision,
          'reopened',
          '${ids.decision}'::uuid
        )
      `),
    );
    const reopened = await withRole(upgraded, "wetindey_contribution_moderator", () =>
      upgraded.query(`SELECT * FROM public.contribution_review_detail('${ids.moderator2}', '${ids.observation}')`),
    );
    assert.equal(reopened.rows[0].effective_decision_id, null);
    assert.equal(reopened.rows[0].has_decision_history, true);
    assert.equal(reopened.rows[0].reopened_after_reversal, true);
    assert.equal(reopened.rows[0].actor_made_effective_decision, false);
    const reversalAudit = await upgraded.query<{ count: string }>(`
      SELECT count(*)::text AS count
      FROM public.contribution_audit_events
      WHERE observation_id = '${ids.observation}'
        AND action = 'moderation_reversed'
    `);
    assert.equal(reversalAudit.rows[0].count, "1");
  } finally {
    await upgraded.close();
  }

  const rollback = await openDatabase(pgliteModule.PGlite);
  try {
    await applyThrough(rollback, 14);
    await rollback.exec("BEGIN");
    try {
      await rollback.exec(pgliteSecurityAdapter(candidate));
      await rollback.exec("SELECT 1 / 0");
      assert.fail("forced rollback did not fail");
    } catch {
      await rollback.exec("ROLLBACK");
    }
    const functionAfterRollback = await rollback.query<{ count: string }>(`
      SELECT count(*)::text AS count
      FROM pg_catalog.pg_proc
      WHERE pronamespace = 'public'::regnamespace
        AND proname = 'contribution_review_detail'
    `);
    assert.equal(functionAfterRollback.rows[0].count, "0");
  } finally {
    await rollback.close();
  }
});
