import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { pathToFileURL } from "node:url";
import path from "node:path";

type Row = Record<string, unknown>;
type Database = {
  exec(sql: string): Promise<unknown>;
  query<T extends Row = Row>(sql: string, params?: unknown[]): Promise<{ rows: T[] }>;
  close(): Promise<void>;
};
type PGliteConstructor = new (options?: unknown) => Database;

const root = path.resolve(import.meta.dirname, "../..");
const migrationsDir = path.join(root, "src/db/migrations");
const moduleDir = process.env.PGLITE_MODULE_DIR;
const requiredPaths = [
  "src/db/schema/index.ts",
  "src/db/pillars/40-contribution-integrity.sql",
  "src/db/pillars/60-contribution-moderation.sql",
  "src/db/pillars/80-contribution-services.sql",
  "src/db/pillars/90-contribution-security.sql",
  "src/db/migrations/0013_contribution_integrity.sql",
  "src/db/migrations/meta/0013_snapshot.json",
  "src/db/migrations/meta/0013_release_manifest.json",
  "src/db/migrations/meta/_journal.json",
  "scripts/contributions/contribution-migration-contract.test.ts",
] as const;
const frozenHashes: Record<string, string> = {
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
};
const expectedParentSnapshotHash =
  "40ba03232a62da4e0b3ad6b72c27db93927801e15dd98c0b8938cd9bf0fc8148";
const expectedParentCommit = "ca64de66299c245b85c1a7ba01a8690f722129ae";
const expectedParentMigrationHash =
  "a8b31034aae22a6e9fa62416df8a1bb483c6783947fdf742c674e82cac373302";

const ids = {
  area: "10000000-0000-4000-8000-000000000001",
  place: "10000000-0000-4000-8000-000000000002",
  placeUnavailable: "10000000-0000-4000-8000-000000000003",
  item: "10000000-0000-4000-8000-000000000004",
  variant: "10000000-0000-4000-8000-000000000005",
  unit: "10000000-0000-4000-8000-000000000006",
  legacySource: "10000000-0000-4000-8000-000000000007",
  legacyObservation: "10000000-0000-4000-8000-000000000008",
  contributor1: "20000000-0000-4000-8000-000000000001",
  contributor2: "20000000-0000-4000-8000-000000000002",
  contributor3: "20000000-0000-4000-8000-000000000003",
  moderator1: "30000000-0000-4000-8000-000000000001",
  moderator2: "30000000-0000-4000-8000-000000000002",
  issuer: "30000000-0000-4000-8000-000000000003",
  reviewer: "30000000-0000-4000-8000-000000000004",
};

function sha256(value: string | Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

function read(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), "utf8");
}

function migration(index: number): { name: string; sql: string } {
  const prefix = `${index.toString().padStart(4, "0")}_`;
  const names = readdirSync(migrationsDir).filter((name) => name.startsWith(prefix));
  assert.equal(names.length, 1, `expected exactly one ${prefix} migration`);
  return { name: names[0], sql: read(`src/db/migrations/${names[0]}`) };
}

function sqlLiteral(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

async function expectReject(
  action: () => Promise<unknown>,
  pattern: RegExp,
  label: string,
): Promise<void> {
  let error: unknown;
  try {
    await action();
  } catch (caught) {
    error = caught;
  }
  assert.ok(error instanceof Error, `${label}: expected rejection`);
  assert.match(error.message, pattern, label);
}

async function scalar<T>(db: Database, sql: string): Promise<T> {
  const result = await db.query<{ value: T }>(sql);
  assert.equal(result.rows.length, 1, sql);
  return result.rows[0].value;
}

async function withRole<T>(
  db: Database,
  role: string,
  action: () => Promise<T>,
): Promise<T> {
  await db.exec(`SET ROLE ${role}`);
  try {
    return await action();
  } finally {
    await db.exec("RESET ROLE");
  }
}

/**
 * PGlite 0.4.6 is PostgreSQL 17.5, but its connection is necessarily backed by
 * the bootstrap superuser. PostgreSQL defines pg_has_role(superuser, ..., SET)
 * as true even after every membership row is removed. Replace only that
 * superuser-specific assertion; retain the two pg_auth_members assertions and
 * schema-privilege assertion byte-for-byte. Frozen source hashes and explicit
 * source checks below prevent this execution adapter from changing release SQL.
 */
function pgliteSecurityAdapter(sql: string): string {
  return sql.replace(
    /  IF pg_has_role\(\s*session_user,\s*'wetindey_(presence|contribution)_owner',\s*'SET'\s*\) THEN[\s\S]*?  END IF;\n\n/,
    "",
  );
}

async function applyRaw(db: Database, sql: string): Promise<void> {
  try {
    await db.exec(`BEGIN;\n${pgliteSecurityAdapter(sql)}\nCOMMIT;`);
  } catch (error) {
    await db.exec("ROLLBACK");
    throw error;
  }
}

async function applyThrough(db: Database, last: number): Promise<void> {
  for (let index = 0; index <= last; index += 1) {
    await applyRaw(db, migration(index).sql);
  }
}

async function openDatabase(PGlite: PGliteConstructor): Promise<Database> {
  const postgisModulePath = path.join(
    moduleDir as string,
    "@electric-sql/pglite-postgis/dist/index.js",
  );
  const postgisModule = (await import(pathToFileURL(postgisModulePath).href)) as {
    postgis: unknown;
  };
  const db = new PGlite({ extensions: { postgis: postgisModule.postgis } });
  await db.exec("CREATE EXTENSION postgis");
  return db;
}

async function createLedger(db: Database): Promise<void> {
  await db.exec(`
    CREATE SCHEMA drizzle;
    CREATE TABLE drizzle.__drizzle_migrations (
      hash text PRIMARY KEY,
      created_at bigint NOT NULL
    )
  `);
}

async function applyCandidate(db: Database): Promise<"applied" | "skipped"> {
  const candidate = migration(13).sql;
  const hash = sha256(candidate);
  const present = await scalar<boolean>(
    db,
    `SELECT EXISTS (
      SELECT 1 FROM drizzle.__drizzle_migrations WHERE hash = ${sqlLiteral(hash)}
    ) AS value`,
  );
  if (present) return "skipped";

  try {
    await db.exec("BEGIN");
    await db.exec(pgliteSecurityAdapter(candidate));
    await db.exec(
      `INSERT INTO drizzle.__drizzle_migrations (hash, created_at)
       VALUES (${sqlLiteral(hash)}, 1784439194861)`,
    );
    await db.exec("COMMIT");
  } catch (error) {
    await db.exec("ROLLBACK");
    throw error;
  }
  return "applied";
}

async function fingerprint(db: Database): Promise<string> {
  const result = await db.query<{ descriptor: string }>(`
    WITH descriptors AS (
      SELECT 'column:' || table_name || ':' || column_name || ':' ||
        data_type || ':' || is_nullable || ':' || coalesce(column_default, '')
        AS descriptor
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND (table_name LIKE 'contribution_%' OR table_name = 'observations')
      UNION ALL
      SELECT 'constraint:' || conrelid::regclass::text || ':' || conname || ':' ||
        pg_get_constraintdef(oid)
      FROM pg_constraint
      WHERE connamespace = 'public'::regnamespace
        AND conrelid::regclass::text LIKE 'contribution_%'
      UNION ALL
      SELECT 'policy:' || tablename || ':' || policyname || ':' ||
        roles::text || ':' || cmd || ':' || coalesce(qual, '') || ':' ||
        coalesce(with_check, '')
      FROM pg_policies
      WHERE schemaname = 'public' AND tablename LIKE 'contribution_%'
      UNION ALL
      SELECT 'function:' || oid::regprocedure::text || ':' || prosecdef::text ||
        ':' || proowner::regrole::text
      FROM pg_proc
      WHERE pronamespace = 'public'::regnamespace
        AND proname LIKE 'contribution_%'
    )
    SELECT descriptor FROM descriptors ORDER BY descriptor
  `);
  return sha256(result.rows.map((row) => row.descriptor).join("\n"));
}

async function seedUpgradeFixture(db: Database): Promise<void> {
  await db.exec(`
    INSERT INTO areas (id, slug, name, type, center, coverage_status)
    VALUES (
      '${ids.area}', 'contract-area', 'Contract Area', 'neighborhood',
      ST_SetSRID(ST_MakePoint(3.37, 6.51), 4326)::geography, 'active'
    );
    INSERT INTO places (
      id, slug, name, place_type, area_id, location, verification_status,
      contact_visibility
    )
    VALUES
      (
        '${ids.place}', 'contract-place', 'Contract Place', 'market',
        '${ids.area}', ST_SetSRID(ST_MakePoint(3.38, 6.52), 4326)::geography,
        'verified', 'private'
      ),
      (
        '${ids.placeUnavailable}', 'contract-place-unavailable',
        'Contract Place Unavailable', 'market', '${ids.area}',
        ST_SetSRID(ST_MakePoint(3.39, 6.53), 4326)::geography,
        'verified', 'private'
      );
    INSERT INTO items (id, slug, canonical_name, category, active)
    VALUES ('${ids.item}', 'contract-rice', 'Contract Rice', 'food', true);
    INSERT INTO item_variants (id, item_id, slug, display_name, active)
    VALUES (
      '${ids.variant}', '${ids.item}', 'contract-rice-local',
      'Contract Rice Local', true
    );
    INSERT INTO units (id, code, display_name, dimension, canonical_quantity)
    VALUES ('${ids.unit}', 'contract_bag', 'Contract Bag', 'mass', 50);
    INSERT INTO sources (id, source_type, reliability_score_internal)
    VALUES ('${ids.legacySource}', 'Public data', 80);
    INSERT INTO observations (
      id, item_variant_id, unit_id, place_id, availability_state, price_amount,
      currency, observed_at, source_id, collection_method, provenance,
      moderation_status, raw_payload
    )
    VALUES (
      '${ids.legacyObservation}', '${ids.variant}', '${ids.unit}', '${ids.place}',
      'unavailable', 777, 'NGN', now() AT TIME ZONE 'UTC',
      '${ids.legacySource}', 'legacy_contract', 'observed', 'approved',
      '{"sentinel":"upgrade-preserved"}'::jsonb
    )
  `);
}

type AdmitResult = {
  request_id: string;
  observation_id: string | null;
  result_code: string;
  replayed: boolean;
  retry_after_seconds: number | null;
};

async function admit(
  db: Database,
  values: {
    operation?: "report_price" | "visit_confirmation" | "correction";
    key: string;
    subject: string;
    network?: string;
    payload: string;
    actor: string;
    place?: string;
    availability?: "available" | "unavailable";
    price?: number | null;
    didBuy?: boolean | null;
    corrects?: string | null;
    observedAtSql?: string;
  },
): Promise<AdmitResult> {
  const operation = values.operation ?? "report_price";
  const network = values.network ?? "e".repeat(64);
  const place = values.place ?? ids.place;
  const availability = values.availability ?? "available";
  const price = values.price === undefined ? 1000 : values.price;
  const didBuy = values.didBuy === undefined ? true : values.didBuy;
  const observedAtSql = values.observedAtSql ?? "now() AT TIME ZONE 'UTC'";
  const result = await withRole(db, "wetindey_contribution_runtime", () =>
    db.query<AdmitResult>(`
      SELECT * FROM contribution_admit(
        '${operation}', '${values.key}', '${values.subject}', '${network}',
        '${values.payload}', '${values.actor}', '${ids.variant}', '${ids.unit}',
        '${place}', '${availability}', ${price === null ? "NULL" : price},
        ${observedAtSql}, ${didBuy === null ? "NULL" : didBuy},
        ${values.corrects ? `'${values.corrects}'` : "NULL"}
      )
    `),
  );
  assert.equal(result.rows.length, 1);
  return result.rows[0];
}

type ModerateResult = {
  decision_id: string;
  projection_state: "available" | "unavailable" | "conflict" | null;
  replayed: boolean;
};

async function moderate(
  db: Database,
  values: {
    actor?: string;
    key: string;
    payload: string;
    observation: string;
    decision?: "approve" | "reject" | "reverse";
    prior?: string | null;
  },
): Promise<ModerateResult> {
  const actor = values.actor ?? ids.moderator1;
  const decision = values.decision ?? "approve";
  const result = await withRole(db, "wetindey_contribution_moderator", () =>
    db.query<ModerateResult>(`
      SELECT * FROM contribution_moderate(
        '${actor}', '${values.key}', '${values.payload}', '${values.observation}',
        '${decision}', 'contract_review',
        ${values.prior ? `'${values.prior}'` : "NULL"}
      )
    `),
  );
  assert.equal(result.rows.length, 1);
  return result.rows[0];
}

async function configure(db: Database): Promise<void> {
  await withRole(db, "wetindey_contribution_control", async () => {
    await db.exec(`
      SELECT contribution_set_moderator_assignment(
        '40000000-0000-4000-8000-000000000001', '${ids.moderator1}', 'active',
        clock_timestamp() - interval '1 minute', NULL, '${ids.issuer}', '${ids.reviewer}'
      );
      SELECT contribution_set_moderator_assignment(
        '40000000-0000-4000-8000-000000000002', '${ids.moderator2}', 'active',
        clock_timestamp() - interval '1 minute', NULL, '${ids.issuer}', '${ids.reviewer}'
      );
      SELECT contribution_set_control(
        '40000000-0000-4000-8000-000000000003', '${ids.issuer}',
        true, true, 2, 4, 10, 20, 2, 72, 'adr-019-contract'
      )
    `);
  });
}

async function assertSecurity(db: Database): Promise<void> {
  const securedCount = await scalar<number>(
    db,
    `SELECT count(*)::integer AS value
     FROM pg_class
     WHERE relnamespace = 'public'::regnamespace
       AND relname IN (
         'contribution_control', 'contribution_requests',
         'contribution_rate_buckets', 'contribution_moderator_assignments',
         'contribution_moderation_decisions', 'contribution_audit_events',
         'contribution_projections'
       )
       AND relrowsecurity AND relforcerowsecurity`,
  );
  assert.equal(securedCount, 7);

  assert.equal(
    await scalar<boolean>(
      db,
      `SELECT has_table_privilege(
        'wetindey_contribution_runtime', 'contribution_requests', 'SELECT'
      ) AS value`,
    ),
    false,
  );
  assert.equal(
    await scalar<boolean>(
      db,
      `SELECT has_function_privilege(
        'wetindey_contribution_runtime',
        'contribution_admit(contribution_operation,uuid,text,text,text,uuid,uuid,uuid,uuid,text,integer,timestamp,boolean,uuid)',
        'EXECUTE'
      ) AS value`,
    ),
    true,
  );
  assert.equal(
    await scalar<boolean>(
      db,
      `SELECT has_function_privilege(
        'wetindey_contribution_runtime',
        'contribution_public_projections(uuid,uuid)',
        'EXECUTE'
      ) AS value`,
    ),
    true,
  );
  assert.equal(
    await scalar<boolean>(
      db,
      `SELECT has_function_privilege(
        'public',
        'contribution_admit(contribution_operation,uuid,text,text,text,uuid,uuid,uuid,uuid,text,integer,timestamp,boolean,uuid)',
        'EXECUTE'
      ) AS value`,
    ),
    false,
  );
  assert.equal(
    await scalar<boolean>(
      db,
      `SELECT has_function_privilege(
        'public', 'contribution_public_projections(uuid,uuid)', 'EXECUTE'
      ) AS value`,
    ),
    false,
  );
  assert.equal(
    await scalar<boolean>(
      db,
      `SELECT has_schema_privilege(
        'wetindey_contribution_owner', 'public', 'CREATE'
      ) AS value`,
    ),
    false,
  );
  assert.equal(
    await scalar<boolean>(
      db,
      `SELECT EXISTS (
        SELECT 1 FROM pg_auth_members membership
        JOIN pg_roles role ON role.oid = membership.roleid
        WHERE role.rolname = 'wetindey_contribution_owner'
      ) AS value`,
    ),
    false,
  );
  await expectReject(
    () =>
      withRole(db, "wetindey_contribution_runtime", () =>
        db.query("SELECT * FROM contribution_requests"),
      ),
    /permission denied|row-level security/i,
    "runtime direct-table denial",
  );
}

async function assertFunctionalContract(db: Database): Promise<void> {
  const defaultControl = await db.query<{
    reporting_allowed: boolean;
    moderation_allowed: boolean;
  }>("SELECT reporting_allowed, moderation_allowed FROM contribution_control");
  assert.deepEqual(defaultControl.rows, [
    { reporting_allowed: false, moderation_allowed: false },
  ]);

  const disabled = await admit(db, {
    key: "50000000-0000-4000-8000-000000000001",
    subject: "a".repeat(64),
    payload: "b".repeat(64),
    actor: ids.contributor1,
  });
  assert.equal(disabled.result_code, "reporting_disabled");
  assert.equal(
    await scalar<number>(
      db,
      "SELECT count(*)::integer AS value FROM contribution_requests",
    ),
    0,
  );

  await configure(db);
  console.log("upgrade: defaults and control configuration PASS");
  await expectReject(
    () =>
      admit(db, {
        key: "50000000-0000-4000-8000-000000000002",
        subject: "a".repeat(64),
        payload: "c".repeat(64),
        actor: ids.contributor1,
        availability: "unavailable",
        price: 1,
        didBuy: null,
      }),
    /unavailable forbids price/i,
    "unavailable price rejection",
  );

  const first = await admit(db, {
    key: "50000000-0000-4000-8000-000000000003",
    subject: "a".repeat(64),
    payload: "d".repeat(64),
    actor: ids.contributor1,
  });
  assert.equal(first.result_code, "pending_review");
  assert.ok(first.observation_id);
  assert.equal(
    await scalar<number>(
      db,
      "SELECT count(*)::integer AS value FROM contribution_projections",
    ),
    0,
    "pending evidence must not project",
  );
  assert.equal(
    (
      await withRole(db, "wetindey_contribution_runtime", () =>
        db.query(
          `SELECT * FROM contribution_public_projections(
            '${ids.variant}', '${ids.place}'
          )`,
        ),
      )
    ).rows.length,
    0,
    "pending evidence crossed the public read RPC",
  );

  const rateBeforeReplay = await scalar<number>(
    db,
    `SELECT sum(used_count)::integer AS value
     FROM contribution_rate_buckets WHERE key_digest = '${"a".repeat(64)}'`,
  );
  const replay = await admit(db, {
    key: "50000000-0000-4000-8000-000000000003",
    subject: "a".repeat(64),
    payload: "d".repeat(64),
    actor: ids.contributor1,
    observedAtSql: "now() AT TIME ZONE 'UTC' - interval '48 hours'",
  });
  assert.equal(replay.observation_id, first.observation_id);
  assert.equal(replay.replayed, true);
  assert.equal(
    await scalar<number>(
      db,
      `SELECT sum(used_count)::integer AS value
       FROM contribution_rate_buckets WHERE key_digest = '${"a".repeat(64)}'`,
    ),
    rateBeforeReplay,
  );

  const conflict = await admit(db, {
    key: "50000000-0000-4000-8000-000000000003",
    subject: "a".repeat(64),
    payload: "e".repeat(64),
    actor: ids.contributor1,
    availability: "unavailable",
    price: 1,
    didBuy: null,
    observedAtSql: "now() AT TIME ZONE 'UTC' - interval '48 hours'",
  });
  assert.equal(conflict.result_code, "idempotency_conflict");
  assert.equal(conflict.observation_id, null);
  assert.equal(
    await scalar<number>(
      db,
      "SELECT count(*)::integer AS value FROM contribution_requests",
    ),
    1,
  );

  const second = await admit(db, {
    key: "50000000-0000-4000-8000-000000000004",
    subject: "a".repeat(64),
    payload: "f".repeat(64),
    actor: ids.contributor1,
  });
  assert.equal(second.result_code, "pending_review");
  const denied = await admit(db, {
    key: "50000000-0000-4000-8000-000000000005",
    subject: "a".repeat(64),
    payload: "1".repeat(64),
    actor: ids.contributor1,
  });
  assert.equal(denied.result_code, "rate_limited");
  assert.ok((denied.retry_after_seconds ?? 0) > 0);
  console.log("upgrade: admission idempotency and rate containment PASS");

  const rollbackSubject = "2".repeat(64);
  const countsBeforeRollback = await db.query<{
    requests: number;
    observations: number;
    buckets: number;
    audits: number;
  }>(`
    SELECT
      (SELECT count(*)::integer FROM contribution_requests) AS requests,
      (SELECT count(*)::integer FROM observations WHERE admission_id IS NOT NULL)
        AS observations,
      (SELECT count(*)::integer FROM contribution_rate_buckets) AS buckets,
      (SELECT count(*)::integer FROM contribution_audit_events) AS audits
  `);
  await db.exec(`
    CREATE FUNCTION contract_reject_admission_audit()
    RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN
      IF NEW.action = 'admission' THEN
        RAISE EXCEPTION 'injected admission audit failure';
      END IF;
      RETURN NEW;
    END;
    $$;
    CREATE TRIGGER contract_reject_admission_audit
      BEFORE INSERT ON contribution_audit_events
      FOR EACH ROW EXECUTE FUNCTION contract_reject_admission_audit()
  `);
  await expectReject(
    () =>
      admit(db, {
        key: "50000000-0000-4000-8000-000000000006",
        subject: rollbackSubject,
        payload: "3".repeat(64),
        actor: ids.contributor2,
      }),
    /injected admission audit failure/i,
    "atomic admission rollback",
  );
  await db.exec(`
    DROP TRIGGER contract_reject_admission_audit ON contribution_audit_events;
    DROP FUNCTION contract_reject_admission_audit()
  `);
  const countsAfterRollback = await db.query<{
    requests: number;
    observations: number;
    buckets: number;
    audits: number;
  }>(`
    SELECT
      (SELECT count(*)::integer FROM contribution_requests) AS requests,
      (SELECT count(*)::integer FROM observations WHERE admission_id IS NOT NULL)
        AS observations,
      (SELECT count(*)::integer FROM contribution_rate_buckets) AS buckets,
      (SELECT count(*)::integer FROM contribution_audit_events) AS audits
  `);
  assert.deepEqual(countsAfterRollback.rows, countsBeforeRollback.rows);
  console.log("upgrade: atomic observation/audit rollback PASS");

  const approved = await moderate(db, {
    key: "60000000-0000-4000-8000-000000000001",
    payload: "4".repeat(64),
    observation: first.observation_id as string,
  });
  assert.equal(approved.projection_state, "available");
  assert.equal(
    await scalar<number>(
      db,
      "SELECT price_min AS value FROM contribution_projections",
    ),
    1000,
  );
  assert.deepEqual(
    (
      await withRole(db, "wetindey_contribution_runtime", () =>
        db.query<{ state: string; price_min: number }>(
          `SELECT state, price_min FROM contribution_public_projections(
            '${ids.variant}', '${ids.place}'
          )`,
        ),
      )
    ).rows,
    [{ state: "available", price_min: 1000 }],
  );
  const availableFreshness = await scalar<string>(
    db,
    `SELECT extract(epoch FROM last_observed_at)::text AS value
     FROM contribution_projections WHERE place_id = '${ids.place}'`,
  );
  const moderationReplay = await moderate(db, {
    key: "60000000-0000-4000-8000-000000000001",
    payload: "4".repeat(64),
    observation: first.observation_id as string,
  });
  assert.equal(moderationReplay.replayed, true);
  assert.equal(moderationReplay.decision_id, approved.decision_id);
  console.log("upgrade: approved-only projection and moderation replay PASS");

  await withRole(db, "wetindey_contribution_control", () =>
    db.exec(`
      SELECT contribution_set_control(
        '40000000-0000-4000-8000-000000000004', '${ids.issuer}',
        true, true, 20, 40, 30, 100, 2, 72, 'adr-019-contract-expanded'
      )
    `),
  );

  const unavailableOne = await admit(db, {
    key: "50000000-0000-4000-8000-000000000007",
    subject: "5".repeat(64),
    payload: "6".repeat(64),
    actor: ids.contributor2,
    availability: "unavailable",
    price: null,
    didBuy: null,
  });
  const oneUnavailableDecision = await moderate(db, {
    key: "60000000-0000-4000-8000-000000000002",
    payload: "7".repeat(64),
    observation: unavailableOne.observation_id as string,
  });
  assert.equal(oneUnavailableDecision.projection_state, "conflict");
  const destructiveContainment = await db.query<{
    state: string;
    price_min: number;
    unavailable_source_count: number;
  }>(`
    SELECT state, price_min, unavailable_source_count
    FROM contribution_projections WHERE place_id = '${ids.place}'
  `);
  assert.deepEqual(destructiveContainment.rows, [
    { state: "conflict", price_min: 1000, unavailable_source_count: 1 },
  ]);
  assert.equal(
    await scalar<string>(
      db,
      `SELECT extract(epoch FROM last_observed_at)::text AS value
       FROM contribution_projections WHERE place_id = '${ids.place}'`,
    ),
    availableFreshness,
    "a contradiction must not refresh the retained available price",
  );

  const unavailablePureOne = await admit(db, {
    key: "50000000-0000-4000-8000-000000000008",
    subject: "8".repeat(64),
    payload: "9".repeat(64),
    actor: ids.contributor2,
    place: ids.placeUnavailable,
    availability: "unavailable",
    price: null,
    didBuy: null,
  });
  await moderate(db, {
    key: "60000000-0000-4000-8000-000000000003",
    payload: "a".repeat(64),
    observation: unavailablePureOne.observation_id as string,
  });
  assert.equal(
    await scalar<string>(
      db,
      `SELECT state::text AS value FROM contribution_projections
       WHERE place_id = '${ids.placeUnavailable}'`,
    ),
    "conflict",
  );
  const unavailablePureTwo = await admit(db, {
    key: "50000000-0000-4000-8000-000000000009",
    subject: "b".repeat(64),
    payload: "c".repeat(64),
    actor: ids.contributor3,
    place: ids.placeUnavailable,
    availability: "unavailable",
    price: null,
    didBuy: null,
  });
  await moderate(db, {
    key: "60000000-0000-4000-8000-000000000004",
    payload: "d".repeat(64),
    observation: unavailablePureTwo.observation_id as string,
  });
  const unavailableProjection = await db.query<{
    state: string;
    price_kind: string | null;
    price_min: number | null;
    price_max: number | null;
    unavailable_source_count: number;
  }>(`
    SELECT state, price_kind, price_min, price_max, unavailable_source_count
    FROM contribution_projections WHERE place_id = '${ids.placeUnavailable}'
  `);
  assert.deepEqual(unavailableProjection.rows, [
    {
      state: "unavailable",
      price_kind: null,
      price_min: null,
      price_max: null,
      unavailable_source_count: 2,
    },
  ]);
  console.log("upgrade: destructive availability containment PASS");

  const correction = await admit(db, {
    operation: "correction",
    key: "50000000-0000-4000-8000-000000000010",
    subject: "a".repeat(64),
    payload: "e".repeat(64),
    actor: ids.contributor1,
    price: 1200,
    corrects: first.observation_id,
  });
  await moderate(db, {
    key: "60000000-0000-4000-8000-000000000005",
    payload: "f".repeat(64),
    observation: correction.observation_id as string,
  });
  const correctedProjection = await db.query<{
    state: string;
    price_min: number;
    supporting_observation_count: number;
  }>(`
    SELECT state, price_min, supporting_observation_count
    FROM contribution_projections WHERE place_id = '${ids.place}'
  `);
  assert.deepEqual(correctedProjection.rows, [
    { state: "conflict", price_min: 1200, supporting_observation_count: 2 },
  ]);
  await expectReject(
    () =>
      db.exec(
        `UPDATE observations SET price_amount = 999
         WHERE id = '${correction.observation_id}'`,
      ),
    /immutable/i,
    "admitted observation immutability",
  );
  await expectReject(
    () =>
      db.exec(
        `UPDATE contribution_moderation_decisions SET reason_code = 'tampered'
         WHERE id = '${approved.decision_id}'`,
      ),
    /append-only/i,
    "decision append-only",
  );
  await expectReject(
    () =>
      db.exec(
        "UPDATE contribution_audit_events SET reason_code = 'tampered' WHERE true",
      ),
    /append-only/i,
    "audit append-only",
  );

  const reversed = await moderate(db, {
    actor: ids.moderator2,
    key: "60000000-0000-4000-8000-000000000006",
    payload: "0".repeat(64),
    observation: correction.observation_id as string,
    decision: "reverse",
    prior: await scalar<string>(
      db,
      `SELECT id AS value FROM contribution_moderation_decisions
       WHERE observation_id = '${correction.observation_id}' AND decision = 'approve'`,
    ),
  });
  assert.equal(reversed.projection_state, "conflict");
  assert.equal(
    await scalar<number>(
      db,
      `SELECT price_min AS value FROM contribution_projections
       WHERE place_id = '${ids.place}'`,
    ),
    1000,
  );
  const unavailableCorrection = await admit(db, {
    operation: "correction",
    key: "50000000-0000-4000-8000-000000000011",
    subject: "a".repeat(64),
    payload: "1".repeat(64),
    actor: ids.contributor1,
    availability: "unavailable",
    price: null,
    didBuy: null,
    corrects: first.observation_id,
  });
  await moderate(db, {
    key: "60000000-0000-4000-8000-000000000007",
    payload: "2".repeat(64),
    observation: unavailableCorrection.observation_id as string,
  });
  assert.deepEqual(
    (
      await db.query<{ state: string; price_min: number }>(`
        SELECT state, price_min FROM contribution_projections
        WHERE place_id = '${ids.place}'
      `)
    ).rows,
    [{ state: "conflict", price_min: 1000 }],
    "one unavailable correction must not erase its available predecessor",
  );
  console.log("upgrade: append-only correction and reversal PASS");

  console.log("upgrade: checking direct projection constraint");
  await expectReject(
    () =>
      db.exec(`
        INSERT INTO contribution_projections (
          item_variant_id, unit_id, place_id, state, price_kind, price_min,
          price_max, currency, last_observed_at, expires_at,
          supporting_observation_count, available_source_count,
          unavailable_source_count, policy_version
        ) VALUES (
          '${ids.variant}', '${ids.unit}', gen_random_uuid(), 'unavailable',
          'Exact', 1, NULL, 'NGN', now() AT TIME ZONE 'UTC',
          now() AT TIME ZONE 'UTC' + interval '1 hour', 1, 0, 2, 'invalid'
        )
      `),
    /foreign key|price_check|violates check/i,
    "unavailable projection price constraint",
  );
  console.log("upgrade: direct projection constraint PASS");
}

async function blankInstall(PGlite: PGliteConstructor): Promise<string> {
  const db = await openDatabase(PGlite);
  try {
    await applyThrough(db, 12);
    await createLedger(db);
    assert.equal(await applyCandidate(db), "applied");
    const before = await fingerprint(db);
    assert.equal(await applyCandidate(db), "skipped");
    assert.equal(await fingerprint(db), before, "idempotent second migrate changed schema");
    return before;
  } finally {
    await db.close();
  }
}

async function upgradedInstall(PGlite: PGliteConstructor): Promise<string> {
  const db = await openDatabase(PGlite);
  try {
    await applyThrough(db, 12);
    await seedUpgradeFixture(db);
    await createLedger(db);
    assert.equal(await applyCandidate(db), "applied");
    assert.deepEqual(
      (
        await db.query<{
          price_amount: number;
          admission_id: string | null;
          sentinel: string;
        }>(`
          SELECT price_amount, admission_id, raw_payload->>'sentinel' AS sentinel
          FROM observations WHERE id = '${ids.legacyObservation}'
        `)
      ).rows,
      [{ price_amount: 777, admission_id: null, sentinel: "upgrade-preserved" }],
    );
    await assertSecurity(db);
    await assertFunctionalContract(db);
    console.log("upgrade: computing schema fingerprint");
    return await fingerprint(db);
  } finally {
    console.log("upgrade: closing disposable database");
    await db.close();
  }
}

async function injectedMigrationRollback(PGlite: PGliteConstructor): Promise<void> {
  const db = await openDatabase(PGlite);
  try {
    await applyThrough(db, 12);
    const candidate = pgliteSecurityAdapter(migration(13).sql);
    await expectReject(
      async () => {
        try {
          await db.exec(`BEGIN;\n${candidate}\nSELECT 1 / 0;\nCOMMIT;`);
        } finally {
          await db.exec("ROLLBACK");
        }
      },
      /division by zero/i,
      "injected migration rollback",
    );
    assert.equal(
      await scalar<boolean>(
        db,
        `SELECT to_regclass('public.contribution_requests') IS NULL AS value`,
      ),
      true,
    );
    assert.equal(
      await scalar<boolean>(
        db,
        `SELECT NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'observations'
            AND column_name = 'admission_id'
        ) AS value`,
      ),
      true,
    );
  } finally {
    await db.close();
  }
}

async function nativeConcurrencyAndFaultContract(connectionString: string): Promise<void> {
  const { Pool } = await import("pg");
  const pool = new Pool({ connectionString, max: 12 });
  const query = async <T extends Row = Row>(sql: string): Promise<T[]> => {
    const result = await pool.query(sql);
    return result.rows as T[];
  };
  const rpc = async <T extends Row = Row>(
    role: "runtime" | "moderator",
    sql: string,
  ): Promise<T[]> => {
    const client = await pool.connect();
    try {
      await client.query(`SET ROLE wetindey_contribution_${role}`);
      const result = await client.query(sql);
      return result.rows as T[];
    } finally {
      await client.query("RESET ROLE").catch(() => undefined);
      client.release();
    }
  };
  const nativeIds = {
    area: "71000000-0000-4000-8000-000000000001",
    place: "71000000-0000-4000-8000-000000000002",
    item: "71000000-0000-4000-8000-000000000003",
    variant: "71000000-0000-4000-8000-000000000004",
    unit: "71000000-0000-4000-8000-000000000005",
    contributor1: "72000000-0000-4000-8000-000000000001",
    contributor2: "72000000-0000-4000-8000-000000000002",
    moderator: "73000000-0000-4000-8000-000000000001",
    issuer: "73000000-0000-4000-8000-000000000002",
    reviewer: "73000000-0000-4000-8000-000000000003",
  };
  const admissionSql = (values: {
    key: string;
    subject: string;
    payload: string;
    actor: string;
    price?: number;
  }): string => `
    SELECT * FROM contribution_admit(
      'report_price', '${values.key}', '${values.subject}', '${"d".repeat(64)}',
      '${values.payload}', '${values.actor}', '${nativeIds.variant}',
      '${nativeIds.unit}', '${nativeIds.place}', 'available',
      ${values.price ?? 1000}, now() AT TIME ZONE 'UTC', true, NULL
    )
  `;

  try {
    await pool.query(`
      INSERT INTO areas (id, slug, name, type, center, coverage_status)
      VALUES (
        '${nativeIds.area}', 'native-contract-area', 'Native Contract Area',
        'neighborhood', ST_SetSRID(ST_MakePoint(3.40, 6.54), 4326)::geography,
        'active'
      );
      INSERT INTO places (
        id, slug, name, place_type, area_id, location, verification_status,
        contact_visibility
      ) VALUES (
        '${nativeIds.place}', 'native-contract-place', 'Native Contract Place',
        'market', '${nativeIds.area}',
        ST_SetSRID(ST_MakePoint(3.41, 6.55), 4326)::geography,
        'verified', 'private'
      );
      INSERT INTO items (id, slug, canonical_name, category, active)
      VALUES (
        '${nativeIds.item}', 'native-contract-item', 'Native Contract Item',
        'food', true
      );
      INSERT INTO item_variants (id, item_id, slug, display_name, active)
      VALUES (
        '${nativeIds.variant}', '${nativeIds.item}', 'native-contract-variant',
        'Native Contract Variant', true
      );
      INSERT INTO units (id, code, display_name, dimension, canonical_quantity)
      VALUES (
        '${nativeIds.unit}', 'native_contract_unit', 'Native Contract Unit',
        'mass', 1
      );
      SELECT contribution_set_moderator_assignment(
        '74000000-0000-4000-8000-000000000001', '${nativeIds.moderator}',
        'active', clock_timestamp() - interval '1 minute', NULL,
        '${nativeIds.issuer}', '${nativeIds.reviewer}'
      );
      SELECT contribution_set_control(
        '74000000-0000-4000-8000-000000000002', '${nativeIds.issuer}',
        true, true, 20, 40, 100, 200, 2, 72, 'adr-019-native-contract'
      )
    `);

    const sameKeySql = admissionSql({
      key: "75000000-0000-4000-8000-000000000001",
      subject: "1".repeat(64),
      payload: "2".repeat(64),
      actor: nativeIds.contributor1,
    });
    const sameKeyResults = (
      await Promise.all([
        rpc<AdmitResult>("runtime", sameKeySql),
        rpc<AdmitResult>("runtime", sameKeySql),
      ])
    ).flat();
    assert.equal(sameKeyResults.length, 2);
    assert.deepEqual(
      sameKeyResults.map((row) => row.replayed).sort(),
      [false, true],
    );
    assert.equal(
      new Set(sameKeyResults.map((row) => row.observation_id)).size,
      1,
    );
    assert.deepEqual(
      await query<{ requests: number; observations: number; admissions: number }>(`
        SELECT
          (SELECT count(*)::integer FROM contribution_requests
           WHERE subject_digest = '${"1".repeat(64)}') AS requests,
          (SELECT count(*)::integer FROM observations observation
           JOIN contribution_requests request ON request.id = observation.admission_id
           WHERE request.subject_digest = '${"1".repeat(64)}') AS observations,
          (SELECT count(*)::integer FROM contribution_audit_events
           WHERE subject_digest = '${"1".repeat(64)}' AND action = 'admission')
            AS admissions
      `),
      [{ requests: 1, observations: 1, admissions: 1 }],
    );

    const conflictSettled = await Promise.all([
      rpc<AdmitResult>(
        "runtime",
        admissionSql({
          key: "75000000-0000-4000-8000-000000000002",
          subject: "3".repeat(64),
          payload: "4".repeat(64),
          actor: nativeIds.contributor1,
        }),
      ),
      rpc<AdmitResult>(
        "runtime",
        admissionSql({
          key: "75000000-0000-4000-8000-000000000002",
          subject: "3".repeat(64),
          payload: "5".repeat(64),
          actor: nativeIds.contributor1,
        }),
      ),
    ]);
    assert.deepEqual(
      conflictSettled
        .flat()
        .map((row) => row.result_code)
        .sort(),
      ["idempotency_conflict", "pending_review"],
    );
    assert.deepEqual(
      await query<{ requests: number; conflicts: number }>(`
        SELECT
          (SELECT count(*)::integer FROM contribution_requests
           WHERE subject_digest = '${"3".repeat(64)}') AS requests,
          (SELECT count(*)::integer FROM contribution_audit_events
           WHERE subject_digest = '${"3".repeat(64)}'
             AND action = 'idempotency_conflict') AS conflicts
      `),
      [{ requests: 1, conflicts: 1 }],
    );

    await pool.query(`
      SELECT contribution_set_control(
        '74000000-0000-4000-8000-000000000003', '${nativeIds.issuer}',
        true, true, 2, 4, 100, 200, 2, 72, 'adr-019-native-rate-edge'
      )
    `);
    const rateResults = (
      await Promise.all(
        [3, 4, 5].map((suffix) =>
          rpc<AdmitResult>(
            "runtime",
            admissionSql({
              key: `75000000-0000-4000-8000-00000000000${suffix}`,
              subject: "6".repeat(64),
              payload: suffix.toString().repeat(64),
              actor: nativeIds.contributor2,
            }),
          ),
        ),
      )
    ).flat();
    assert.deepEqual(
      rateResults.map((row) => row.result_code).sort(),
      ["pending_review", "pending_review", "rate_limited"],
    );
    assert.deepEqual(
      await query<{ bucket_count: number; total: number }>(`
        SELECT count(*)::integer AS bucket_count, sum(used_count)::integer AS total
        FROM contribution_rate_buckets
        WHERE dimension = 'subject' AND key_digest = '${"6".repeat(64)}'
      `),
      [{ bucket_count: 2, total: 4 }],
    );

    const faultTables = [
      { table: "contribution_rate_buckets", when: "" },
      {
        table: "contribution_audit_events",
        when: " WHEN (NEW.action = 'rate_allowed')",
      },
      { table: "sources", when: "" },
      { table: "contribution_requests", when: "" },
      { table: "observations", when: "" },
      {
        table: "contribution_audit_events",
        when: " WHEN (NEW.action = 'admission')",
      },
    ];
    for (const [index, fault] of faultTables.entries()) {
      const baseline = await query<{
        requests: number;
        observations: number;
        buckets: number;
        audits: number;
        sources: number;
      }>(`
        SELECT
          (SELECT count(*)::integer FROM contribution_requests) AS requests,
          (SELECT count(*)::integer FROM observations WHERE admission_id IS NOT NULL)
            AS observations,
          (SELECT count(*)::integer FROM contribution_rate_buckets) AS buckets,
          (SELECT count(*)::integer FROM contribution_audit_events) AS audits,
          (SELECT count(*)::integer FROM sources) AS sources
      `);
      await pool.query(`
        CREATE FUNCTION native_contract_fail_${index}()
        RETURNS trigger LANGUAGE plpgsql AS $$
        BEGIN RAISE EXCEPTION 'native injected admission step ${index}'; END;
        $$;
        CREATE TRIGGER native_contract_fail_${index}
          BEFORE INSERT ON ${fault.table}
          FOR EACH ROW${fault.when}
          EXECUTE FUNCTION native_contract_fail_${index}()
      `);
      const attempt = await Promise.allSettled([
        rpc(
          "runtime",
          admissionSql({
            key: `76000000-0000-4000-8000-00000000000${index}`,
            subject: (index + 8).toString(16).repeat(64),
            payload: (index + 1).toString().repeat(64),
            actor: `77000000-0000-4000-8000-${(index + 1).toString().padStart(12, "0")}`,
          }),
        ),
      ]);
      assert.equal(attempt[0].status, "rejected");
      await pool.query(`
        DROP TRIGGER native_contract_fail_${index} ON ${fault.table};
        DROP FUNCTION native_contract_fail_${index}()
      `);
      assert.deepEqual(
        await query<{
          requests: number;
          observations: number;
          buckets: number;
          audits: number;
          sources: number;
        }>(`
          SELECT
            (SELECT count(*)::integer FROM contribution_requests) AS requests,
            (SELECT count(*)::integer FROM observations
             WHERE admission_id IS NOT NULL) AS observations,
            (SELECT count(*)::integer FROM contribution_rate_buckets) AS buckets,
            (SELECT count(*)::integer FROM contribution_audit_events) AS audits,
            (SELECT count(*)::integer FROM sources) AS sources
        `),
        baseline,
        `admission step ${index} did not roll back`,
      );
    }

    await pool.query(`
      SELECT contribution_set_control(
        '74000000-0000-4000-8000-000000000004', '${nativeIds.issuer}',
        true, true, 20, 40, 100, 200, 2, 72, 'adr-019-native-moderation'
      )
    `);
    const moderationTarget = (
      await rpc<AdmitResult>(
        "runtime",
        admissionSql({
          key: "78000000-0000-4000-8000-000000000001",
          subject: "e".repeat(64),
          payload: "f".repeat(64),
          actor: nativeIds.contributor2,
          price: 1300,
        }),
      )
    )[0];
    const moderationCommands = [
      {
        key: "79000000-0000-4000-8000-000000000001",
        payload: "a".repeat(64),
        decision: "approve",
      },
      {
        key: "79000000-0000-4000-8000-000000000002",
        payload: "b".repeat(64),
        decision: "reject",
      },
    ];
    const moderationRace = await Promise.allSettled(
      moderationCommands.map((command) =>
        rpc(
          "moderator",
          `SELECT * FROM contribution_moderate(
            '${nativeIds.moderator}', '${command.key}', '${command.payload}',
            '${moderationTarget.observation_id}', '${command.decision}',
            'native_race', NULL
          )`,
        ),
      ),
    );
    assert.equal(
      moderationRace.filter((result) => result.status === "fulfilled").length,
      1,
    );
    assert.equal(
      moderationRace.filter((result) => result.status === "rejected").length,
      1,
    );
    assert.equal(
      (
        await query<{ count: number }>(`
          SELECT count(*)::integer AS count
          FROM contribution_moderation_decisions
          WHERE observation_id = '${moderationTarget.observation_id}'
        `)
      )[0].count,
      1,
    );

    const rollbackTarget = (
      await rpc<AdmitResult>(
        "runtime",
        admissionSql({
          key: "78000000-0000-4000-8000-000000000002",
          subject: "c".repeat(64),
          payload: "d".repeat(64),
          actor: nativeIds.contributor2,
          price: 1400,
        }),
      )
    )[0];
    const projectionBefore = await query<{ count: number; support: number }>(`
      SELECT count(*)::integer AS count,
        coalesce(sum(supporting_observation_count), 0)::integer AS support
      FROM contribution_projections WHERE place_id = '${nativeIds.place}'
    `);
    await pool.query(`
      CREATE FUNCTION native_contract_fail_projection_audit()
      RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN RAISE EXCEPTION 'native injected projection audit'; END;
      $$;
      CREATE TRIGGER native_contract_fail_projection_audit
        BEFORE INSERT ON contribution_audit_events
        FOR EACH ROW WHEN (NEW.action = 'projection_updated')
        EXECUTE FUNCTION native_contract_fail_projection_audit()
    `);
    const moderationRollback = await Promise.allSettled([
      rpc(
        "moderator",
        `SELECT * FROM contribution_moderate(
          '${nativeIds.moderator}', '79000000-0000-4000-8000-000000000003',
          '${"e".repeat(64)}', '${rollbackTarget.observation_id}', 'approve',
          'native_rollback', NULL
        )`,
      ),
    ]);
    assert.equal(moderationRollback[0].status, "rejected");
    await pool.query(`
      DROP TRIGGER native_contract_fail_projection_audit
        ON contribution_audit_events;
      DROP FUNCTION native_contract_fail_projection_audit()
    `);
    assert.equal(
      (
        await query<{ count: number }>(`
          SELECT count(*)::integer AS count
          FROM contribution_moderation_decisions
          WHERE observation_id = '${rollbackTarget.observation_id}'
        `)
      )[0].count,
      0,
    );
    assert.deepEqual(
      await query<{ count: number; support: number }>(`
        SELECT count(*)::integer AS count,
          coalesce(sum(supporting_observation_count), 0)::integer AS support
        FROM contribution_projections WHERE place_id = '${nativeIds.place}'
      `),
      projectionBefore,
    );
  } finally {
    await pool.end();
  }
}

function assertStaticContract(): void {
  for (const relativePath of requiredPaths) {
    assert.ok(existsSync(path.join(root, relativePath)), `missing ${relativePath}`);
  }
  for (const [name, expected] of Object.entries(frozenHashes)) {
    assert.equal(sha256(read(`src/db/migrations/${name}`)), expected, `${name} changed`);
  }
  assert.equal(
    sha256(read("src/db/migrations/meta/0012_snapshot.json")),
    expectedParentSnapshotHash,
    "0012 snapshot changed",
  );

  const journal = JSON.parse(read("src/db/migrations/meta/_journal.json")) as {
    entries: Array<{ idx: number; tag: string }>;
  };
  assert.deepEqual(
    journal.entries.at(-1),
    {
      idx: 13,
      version: "7",
      when: 1784439194861,
      tag: "0013_contribution_integrity",
      breakpoints: true,
    },
  );
  assert.deepEqual(
    journal.entries.slice(0, 13).map(({ idx, tag }) => ({ idx, tag })),
    [
      "0000_careless_piledriver",
      "0001_cute_harrier",
      "0002_calm_meteorite",
      "0003_condemned_sally_floyd",
      "0004_old_mordo",
      "0005_handy_brood",
      "0006_ordinary_meltdown",
      "0007_gray_king_cobra",
      "0008_sturdy_lockjaw",
      "0009_observation_provenance",
      "0010_public_source_ingestion_boundary",
      "0011_classy_the_stranger",
      "0012_guarded_presence",
    ].map((tag, idx) => ({ idx, tag })),
  );

  const migrationSql = migration(13).sql;
  for (const pillar of [
    "40-contribution-integrity.sql",
    "60-contribution-moderation.sql",
    "80-contribution-services.sql",
    "90-contribution-security.sql",
  ]) {
    assert.ok(
      migrationSql.includes(read(`src/db/pillars/${pillar}`).trim()),
      `${pillar} is not embedded exactly in 0013`,
    );
  }
  assert.match(migrationSql, /reporting_allowed" boolean DEFAULT false NOT NULL/);
  assert.match(migrationSql, /moderation_allowed" boolean DEFAULT false NOT NULL/);
  assert.match(migrationSql, /unavailable forbids price/);
  assert.match(migrationSql, /FORCE ROW LEVEL SECURITY/);
  assert.match(migrationSql, /REVOKE ALL ON TABLE/);
  assert.doesNotMatch(migrationSql, /GRANT (SELECT|INSERT|UPDATE|DELETE) ON TABLE[\s\S]*wetindey_contribution_runtime/);

  const snapshot = JSON.parse(
    read("src/db/migrations/meta/0013_snapshot.json"),
  ) as { prevId: string; id: string };
  assert.equal(snapshot.prevId, "3f304405-9ec4-490f-bef4-591126fcdbb8");
  assert.match(snapshot.id, /^[0-9a-f-]{36}$/);
}

async function main(): Promise<void> {
  console.log("REFUTED: Contribution 0013 contract has not yet established evidence.");
  assertStaticContract();
  assert.ok(moduleDir, "PGLITE_MODULE_DIR is required");
  const pglitePath = path.join(moduleDir, "@electric-sql/pglite/dist/index.js");
  assert.ok(existsSync(pglitePath), `missing PGlite module at ${pglitePath}`);
  const pgliteModule = (await import(pathToFileURL(pglitePath).href)) as {
    PGlite: PGliteConstructor;
  };

  const probe = await openDatabase(pgliteModule.PGlite);
  const versions = (
    await probe.query<{ version: string; postgis_version: string }>(
      "SELECT version(), postgis_version()",
    )
  ).rows[0];
  await probe.close();
  assert.match(versions.version, /^PostgreSQL 17\./);
  assert.match(versions.postgis_version, /^3\./);

  const blankFingerprint = await blankInstall(pgliteModule.PGlite);
  console.log("blank install and durable second-migrate: PASS");
  const upgradeFingerprint = await upgradedInstall(pgliteModule.PGlite);
  console.log("0000-0012 upgrade and integrity contract: PASS");
  assert.equal(blankFingerprint, upgradeFingerprint);
  await injectedMigrationRollback(pgliteModule.PGlite);
  console.log("injected migration rollback: PASS");
  if (process.env.CONTRIBUTION_NATIVE_DATABASE_URL) {
    await nativeConcurrencyAndFaultContract(
      process.env.CONTRIBUTION_NATIVE_DATABASE_URL,
    );
    console.log("native concurrent races and per-step rollback: PASS");
  }

  const manifest = JSON.parse(
    read("src/db/migrations/meta/0013_release_manifest.json"),
  ) as {
    release: string;
    id: string;
    prevId: string;
    kind: string;
    parent_commit: string;
    parent_migration_sha256: string;
    parent_snapshot_sha256: string;
    migration_sha256: string;
    snapshot_sha256: string;
    schema_fingerprint_sha256: string;
    source_sha256: Record<string, string>;
  };
  assert.equal(manifest.release, "0013_contribution_integrity");
  assert.equal(manifest.kind, "release_manifest");
  const snapshotIds = readdirSync(path.join(migrationsDir, "meta"))
    .filter((name) => /^\d{4}_snapshot\.json$/.test(name))
    .map(
      (name) =>
        (JSON.parse(read(`src/db/migrations/meta/${name}`)) as { id: string }).id,
    );
  assert.equal(
    snapshotIds.includes(manifest.prevId),
    false,
    "release manifest must not branch the Drizzle snapshot chain",
  );
  assert.equal(
    snapshotIds.includes(manifest.id),
    false,
    "release manifest compatibility id must not collide with a snapshot",
  );
  assert.equal(manifest.parent_commit, expectedParentCommit);
  assert.equal(manifest.parent_migration_sha256, expectedParentMigrationHash);
  assert.equal(manifest.parent_snapshot_sha256, expectedParentSnapshotHash);
  assert.equal(manifest.migration_sha256, sha256(migration(13).sql));
  assert.equal(
    manifest.snapshot_sha256,
    sha256(read("src/db/migrations/meta/0013_snapshot.json")),
  );
  assert.equal(manifest.schema_fingerprint_sha256, blankFingerprint);
  for (const [relativePath, expectedHash] of Object.entries(manifest.source_sha256)) {
    assert.equal(sha256(read(relativePath)), expectedHash, `${relativePath} manifest hash`);
  }

  console.log(
    JSON.stringify({
      verdict: "PASS",
      engine: versions.version,
      postgis: versions.postgis_version,
      blank_install: "PASS",
      upgrade_0000_0012: "PASS",
      second_migrate: "PASS (durable hash ledger skip)",
      injected_migration_rollback: "PASS",
      admission_transaction_rollback: "PASS",
      constraints_rls_grants_defaults: "PASS",
      native_concurrency_and_faults: process.env.CONTRIBUTION_NATIVE_DATABASE_URL
        ? "PASS"
        : "NOT RUN",
      schema_fingerprint_sha256: blankFingerprint,
      pglite_adapter:
        "Only bootstrap-superuser pg_has_role(..., SET) assertions adapted; catalog assertions retained.",
    }),
  );
}

main().catch((error: unknown) => {
  console.error("REFUTED");
  console.error(error);
  process.exitCode = 1;
});
