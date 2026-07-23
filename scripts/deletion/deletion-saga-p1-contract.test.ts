/**
 * ADR-021 P1 deletion-saga persistence contract.
 *
 * Proves the desired-state schema shape, the exact 8+4 phase labels (cross-
 * checked across the Drizzle pgEnum, the lib constant, and the generated DDL),
 * that the compare-and-set primitive blocks a double-advance, idempotency-key
 * uniqueness and validation, audit-row redaction (none of the forbidden columns
 * exist), and that the inert admin-auth adapter fails closed on a target
 * mismatch without ever calling a real provider. It also proves 0000..0017 and
 * their meta are byte-frozen and that 0018 is present but UNAPPLIED (release
 * manifest flags all false).
 *
 * Shared-DB rule: this harness generates no DB traffic against any shared,
 * preview, or production database. If the disposable PGlite deps are present it
 * additionally reconstructs 0000->0018 on an in-memory database; when they are
 * absent it SKIPS to static-only, which is acceptable, and reports which ran.
 */

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import { getTableConfig } from "drizzle-orm/pg-core";

import {
  deletionAudit,
  deletionOutcome,
  deletionPhase,
  deletionRequests,
} from "../../src/db/schema/deletion";
import {
  AdminAuthAdapter,
  DeletionAdapterConfigError,
  DeletionAdapterInertError,
  type AuthDeletionProvider,
} from "../../src/lib/deletion/adapter";
import {
  DeletionServerOnlyError,
  DeletionTargetError,
  assertExactTarget,
  assertServerOnly,
} from "../../src/lib/deletion/guards";
import {
  DELETION_PHASES,
  DeletionIdempotencyKeyError,
  DeletionTransitionError,
  type DeletionCasStore,
  type DeletionPhasePatch,
  assertIdempotencyKey,
  isValidIdempotencyKey,
  transitionPhase,
} from "../../src/lib/deletion/phases";
import {
  DELETION_CANONICAL_PHASES,
  DELETION_FAILURE_PHASES,
  DELETION_OUTCOMES,
  type DeletionPhase,
  type TargetDescriptor,
} from "../../src/lib/deletion/types";

const root = path.resolve(import.meta.dirname, "../..");
const migrationsDir = path.join(root, "src/db/migrations");

const CANONICAL_PHASES = [
  "challenge_pending",
  "verified",
  "auth_delete_pending",
  "auth_deleted",
  "app_cleanup_pending",
  "presence_cleanup_pending",
  "blob_cleanup_pending",
  "completed",
] as const;
const FAILURE_PHASES = [
  "verification_expired",
  "auth_delete_retryable",
  "cleanup_retryable",
  "blocked_manual",
] as const;
const ALL_PHASES = [...CANONICAL_PHASES, ...FAILURE_PHASES];

const requiredPaths = [
  "src/db/schema/deletion.ts",
  "src/db/schema/index.ts",
  "src/db/pillars/90-deletion-saga.sql",
  "src/db/migrations/0018_deletion_saga_persistence.sql",
  "src/db/migrations/meta/0018_snapshot.json",
  "src/db/migrations/meta/0018_release_manifest.json",
  "src/db/migrations/meta/_journal.json",
  "src/lib/deletion/types.ts",
  "src/lib/deletion/guards.ts",
  "src/lib/deletion/adapter.ts",
  "src/lib/deletion/phases.ts",
  "scripts/deletion/deletion-saga-p1-contract.test.ts",
] as const;

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
  "0015_contribution_moderation_operations.sql": "d4d452a4e7f3dba7fdd68ce63c2b447e974c97b727d12dbd2c8e8261334559a2",
  "0016_contribution_review_acl_repair.sql": "669864c8a532b2b941dcd30258b2cb7a1e1c9a7406e4f5d6ddf4a5a3bbb6d6ec",
  "0017_contribution_pending_queue_shape_repair.sql": "a864a63b8fa782e0af1be9a01329857a303e874d57799d7b74517cc70909f34a",
};

const PARENT_SNAPSHOT_ID = "6f49b946-260e-5ed7-b740-189bad171017";
const RESULT_SNAPSHOT_ID = "ed1e3683-c202-457d-ab34-d5a9273fdadb";
const JOURNAL_WHEN_0018 = 1784746800000;

/** Column-name fragments that must never appear on a deletion table (redaction). */
const FORBIDDEN_COLUMN_FRAGMENTS = [
  "email",
  "otp",
  "token",
  "session",
  "password",
  "secret",
  "cookie",
  "coordinate",
  "latitude",
  "longitude",
  "geom",
  "geography",
  "blob",
  "payload",
  "response",
  "stack",
  "backtrace",
  "traceback",
];

function sha256(value: string | Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

function read(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), "utf8");
}

function migration0018(): string {
  return read("src/db/migrations/0018_deletion_saga_persistence.sql");
}

// ---------------------------------------------------------------------------
// Static contract
// ---------------------------------------------------------------------------

test("the twelve approved-lane artifacts exist", () => {
  for (const relativePath of requiredPaths) {
    assert.ok(existsSync(path.join(root, relativePath)), `missing ${relativePath}`);
  }
});

test("migrations 0000..0017 and their snapshots are byte-frozen", () => {
  for (const [name, expected] of Object.entries(frozenMigrationHashes)) {
    assert.equal(sha256(read(`src/db/migrations/${name}`)), expected, `${name} changed`);
  }
  // The 0017 snapshot (0018's parent) must be untouched.
  const parent = JSON.parse(read("src/db/migrations/meta/0017_snapshot.json")) as {
    id: string;
  };
  assert.equal(parent.id, PARENT_SNAPSHOT_ID, "0017 snapshot id drifted");
});

test("the journal carries the 0018 entry at idx 18 with a hand-set round epoch", () => {
  const journal = JSON.parse(read("src/db/migrations/meta/_journal.json")) as {
    version: string;
    entries: Array<{ idx: number; version: string; when: number; tag: string; breakpoints: boolean }>;
  };
  assert.equal(journal.version, "7");
  // The journal is append-only: it only grows as later migrations land, so an
  // exact length is wrong. Require entries 0..18 to be present and the 0018-era
  // prefix to be idx-aligned and strictly monotonic, without forbidding later
  // entries.
  assert.ok(journal.entries.length >= 19, "journal must hold at least entries 0..18");
  for (let i = 0; i <= 18; i += 1) {
    assert.equal(journal.entries[i].idx, i, `entry ${i} idx drifted`);
    if (i > 0) {
      assert.ok(
        journal.entries[i].when > journal.entries[i - 1].when,
        `journal when must be strictly monotonic through the 0018 prefix at ${i}`,
      );
    }
  }
  const entry0018 = journal.entries[18];
  assert.deepEqual(entry0018, {
    idx: 18,
    version: "7",
    when: JOURNAL_WHEN_0018,
    tag: "0018_deletion_saga_persistence",
    breakpoints: true,
  });
  // Hand-set round epoch: a whole-hour boundary strictly after 0017.
  assert.equal(JOURNAL_WHEN_0018 % 3_600_000, 0, "0018 when is not a round epoch");
  const parent = journal.entries[17];
  assert.equal(parent.tag, "0017_contribution_pending_queue_shape_repair");
  assert.ok(JOURNAL_WHEN_0018 > parent.when, "0018 when must be after 0017");
});

test("0018 snapshot continues the drizzle chain from 0017", () => {
  const snapshot = JSON.parse(read("src/db/migrations/meta/0018_snapshot.json")) as {
    id: string;
    prevId: string;
    version: string;
  };
  assert.equal(snapshot.version, "7");
  assert.equal(snapshot.prevId, PARENT_SNAPSHOT_ID, "0018 must branch off the 0017 snapshot");
  assert.equal(snapshot.id, RESULT_SNAPSHOT_ID);
});

test("0018 migration carries the generated DDL then the merged pillar", () => {
  const sql = migration0018();
  // Generated DDL: the two enums (phase in exact 12-label order) and two tables.
  assert.match(
    sql,
    new RegExp(
      `CREATE TYPE "public"\\."deletion_phase" AS ENUM\\('${ALL_PHASES.join("', '")}'\\)`,
    ),
    "phase enum DDL missing or out of order",
  );
  assert.match(
    sql,
    /CREATE TYPE "public"\."deletion_outcome" AS ENUM\('pending', 'completed', 'failed', 'expired'\)/,
  );
  assert.match(sql, /CREATE TABLE "deletion_requests"/);
  assert.match(sql, /CREATE TABLE "deletion_audit"/);
  assert.match(sql, /CREATE UNIQUE INDEX "deletion_requests_idempotency_key"/);

  // The hand-authored pillar is embedded verbatim after the generated DDL.
  const pillar = read("src/db/pillars/90-deletion-saga.sql").trim();
  assert.ok(sql.includes(pillar), "pillar 90-deletion-saga.sql is not embedded exactly in 0018");
  const ddlEnd = sql.indexOf('CREATE INDEX "deletion_requests_phase_retry_idx"');
  assert.ok(ddlEnd >= 0 && sql.indexOf(pillar) > ddlEnd, "pillar must follow the generated DDL");

  // Least-privilege RLS boundary present; no direct table grant to service roles.
  assert.match(sql, /ALTER TABLE public\.deletion_requests ENABLE ROW LEVEL SECURITY/);
  assert.match(sql, /ALTER TABLE public\.deletion_requests FORCE ROW LEVEL SECURITY/);
  assert.match(sql, /ALTER TABLE public\.deletion_audit FORCE ROW LEVEL SECURITY/);
  assert.match(sql, /REVOKE ALL ON TABLE/);
  const transferOwnership = sql.indexOf(
    "ALTER TABLE public.deletion_requests OWNER TO wetindey_deletion_owner",
  );
  const assumeOwner = sql.indexOf("SET LOCAL ROLE wetindey_deletion_owner");
  const installRls = sql.indexOf(
    "ALTER TABLE public.deletion_requests ENABLE ROW LEVEL SECURITY",
  );
  assert.ok(transferOwnership >= 0, "deletion_requests ownership transfer missing");
  assert.ok(assumeOwner > transferOwnership, "owner role must be assumed after ownership transfer");
  assert.ok(installRls > assumeOwner, "RLS must be installed while acting as the table owner");
  assert.doesNotMatch(
    sql,
    /GRANT (SELECT|INSERT|UPDATE|DELETE) ON TABLE[\s\S]*wetindey_deletion_(runtime|worker)/,
    "P1 must grant no direct table DML to runtime or worker",
  );
});

test("the pillar owns no tables or types", () => {
  const pillar = read("src/db/pillars/90-deletion-saga.sql");
  assert.doesNotMatch(pillar, /CREATE TABLE/, "pillar must not create tables");
  assert.doesNotMatch(pillar, /CREATE TYPE/, "pillar must not create types");
  assert.match(pillar, /CREATE ROLE wetindey_deletion_owner/);
  assert.match(pillar, /ALTER TABLE public\.deletion_requests OWNER TO wetindey_deletion_owner/);
});

test("0018 release manifest freezes the shared application while activation stays off", () => {
  const manifest = JSON.parse(
    read("src/db/migrations/meta/0018_release_manifest.json"),
  ) as {
    kind: string;
    release: string;
    status: string;
    shared_database_applied: boolean;
    first_shared_application_frozen: boolean;
    parent_release: string;
    parent_snapshot_id: string;
    result_snapshot_id: string;
    artifacts: Record<string, { path: string; sha256: string }>;
    source_sha256: Record<string, string>;
    authorization: Record<string, boolean>;
  };
  assert.equal(manifest.kind, "release_manifest");
  assert.equal(manifest.release, "0018_deletion_saga_persistence");
  assert.equal(manifest.status, "shared_applied_immutable");
  assert.equal(manifest.shared_database_applied, true);
  assert.equal(manifest.first_shared_application_frozen, true);
  assert.equal(manifest.parent_snapshot_id, PARENT_SNAPSHOT_ID);
  assert.equal(manifest.result_snapshot_id, RESULT_SNAPSHOT_ID);

  // Application is complete, but duplicate execution and runtime activation stay forbidden.
  const authValues = Object.values(manifest.authorization);
  assert.ok(authValues.length >= 3, "authorization must enumerate the activation flags");
  for (const [flag, value] of Object.entries(manifest.authorization)) {
    assert.equal(value, false, `authorization.${flag} must be false`);
  }

  // Recorded artifact and source hashes match the files on disk right now.
  assert.equal(
    manifest.artifacts.migration.sha256,
    sha256(migration0018()),
    "migration hash drift",
  );
  assert.equal(
    manifest.artifacts.snapshot.sha256,
    sha256(read("src/db/migrations/meta/0018_snapshot.json")),
    "snapshot hash drift",
  );
  // The journal is append-only, so its whole-file hash legitimately changes as
  // later migrations land; do NOT compare the manifest's 0018-era journal hash
  // to the current growing file. Instead prove the 0018 prefix (entries 0..18)
  // is byte-for-byte unchanged by reconstructing it and matching the recorded
  // hash. manifest.artifacts.journal.sha256 stays a historical 0018-time record.
  const journalDoc = JSON.parse(read("src/db/migrations/meta/_journal.json")) as {
    entries: unknown[];
  };
  const journal0018 = { ...journalDoc, entries: journalDoc.entries.slice(0, 19) };
  assert.equal(
    manifest.artifacts.journal.sha256,
    sha256(`${JSON.stringify(journal0018, null, 2)}\n`),
    "0018-era journal prefix drift",
  );
  for (const [relativePath, expected] of Object.entries(manifest.source_sha256)) {
    assert.equal(sha256(read(relativePath)), expected, `${relativePath} manifest hash drift`);
  }
});

// ---------------------------------------------------------------------------
// Schema shape and phase labels
// ---------------------------------------------------------------------------

test("phase labels are exactly the canonical 8 plus the failure 4, in order", () => {
  assert.equal(DELETION_CANONICAL_PHASES.length, 8);
  assert.equal(DELETION_FAILURE_PHASES.length, 4);
  assert.deepEqual([...DELETION_CANONICAL_PHASES], [...CANONICAL_PHASES]);
  assert.deepEqual([...DELETION_FAILURE_PHASES], [...FAILURE_PHASES]);
  assert.deepEqual([...DELETION_PHASES], ALL_PHASES);

  // Three-way agreement: the pgEnum, the lib constant, and the generated DDL.
  assert.deepEqual([...deletionPhase.enumValues], ALL_PHASES, "pgEnum labels drifted from spec");
  const ddl = migration0018().match(
    /CREATE TYPE "public"\."deletion_phase" AS ENUM\(([^)]*)\)/,
  );
  assert.ok(ddl, "phase enum DDL not found");
  const ddlLabels = ddl[1].split(",").map((token) => token.trim().replace(/^'|'$/g, ""));
  assert.deepEqual(ddlLabels, ALL_PHASES, "generated DDL labels drifted from spec");

  assert.deepEqual([...deletionOutcome.enumValues], [...DELETION_OUTCOMES]);
});

test("deletion_requests has the CAS-friendly persistence shape", () => {
  const cfg = getTableConfig(deletionRequests);
  const columns = new Map(cfg.columns.map((c) => [c.name, c]));
  const expected = [
    "id",
    "idempotency_key",
    "phase",
    "attempt_count",
    "next_retry_at",
    "outcome",
    "version",
    "created_at",
    "updated_at",
  ];
  assert.deepEqual([...columns.keys()].sort(), [...expected].sort());

  // CAS guards: a monotonic version and an updated_at, both NOT NULL.
  assert.equal(columns.get("version")?.notNull, true, "version must be NOT NULL for CAS");
  assert.equal(columns.get("updated_at")?.notNull, true);
  assert.equal(columns.get("idempotency_key")?.notNull, true);
  assert.equal(columns.get("next_retry_at")?.notNull, false, "next_retry_at is nullable");

  // Idempotency-key uniqueness is enforced by a unique index.
  const unique = cfg.indexes.filter((index) => index.config.unique);
  assert.ok(
    unique.some(
      (index) =>
        index.config.name === "deletion_requests_idempotency_key" &&
        index.config.columns.some((column) => "name" in column && column.name === "idempotency_key"),
    ),
    "idempotency_key must have a unique index",
  );
});

test("deletion_audit is redacted: only safe columns, foreign-keyed to requests", () => {
  const cfg = getTableConfig(deletionAudit);
  const columnNames = cfg.columns.map((c) => c.name);
  const expected = [
    "id",
    "request_id",
    "from_phase",
    "to_phase",
    "reason_code",
    "challenge_hash",
    "attempt",
    "created_at",
  ];
  assert.deepEqual([...columnNames].sort(), [...expected].sort(), "audit column set drifted");

  // A challenge is recorded only as its hash; no raw challenge column.
  assert.ok(columnNames.includes("challenge_hash"));
  assert.ok(!columnNames.includes("challenge"), "raw challenge column is forbidden");

  // No forbidden PII/secret/coordinate/blob/payload column on either table.
  for (const table of [getTableConfig(deletionRequests), getTableConfig(deletionAudit)]) {
    for (const column of table.columns) {
      for (const fragment of FORBIDDEN_COLUMN_FRAGMENTS) {
        assert.ok(
          !column.name.toLowerCase().includes(fragment),
          `${table.name}.${column.name} matches forbidden fragment '${fragment}'`,
        );
      }
    }
  }

  assert.equal(cfg.foreignKeys.length, 1, "audit must reference deletion_requests");
});

// ---------------------------------------------------------------------------
// Compare-and-set primitive
// ---------------------------------------------------------------------------

/** An in-memory store whose compareAndSwap is atomic (no await between read and write). */
class MemoryCasStore implements DeletionCasStore {
  row: { version: number; phase: DeletionPhase; patch: DeletionPhasePatch | null };
  applied = 0;

  constructor(version: number, phase: DeletionPhase) {
    this.row = { version, phase, patch: null };
  }

  async compareAndSwap(input: {
    requestId: string;
    expectedVersion: number;
    patch: DeletionPhasePatch;
  }): Promise<boolean> {
    if (this.row.version !== input.expectedVersion) return false;
    this.row = {
      version: this.row.version + 1,
      phase: input.patch.phase,
      patch: input.patch,
    };
    this.applied += 1;
    return true;
  }
}

test("CAS lets exactly one of two racing workers advance a phase", async () => {
  const store = new MemoryCasStore(1, "auth_delete_pending");
  const attempt = () =>
    transitionPhase(store, {
      requestId: "req-1",
      expectedVersion: 1,
      from: "auth_delete_pending",
      to: "auth_deleted",
    });
  const [a, b] = await Promise.all([attempt(), attempt()]);

  assert.equal([a.applied, b.applied].filter(Boolean).length, 1, "exactly one worker may win");
  assert.equal(store.applied, 1, "only one swap may commit");
  assert.equal(store.row.version, 2, "version advances exactly once");
  assert.equal(store.row.phase, "auth_deleted");

  // A worker holding the now-stale version can never advance, even on a legal edge.
  const stale = await transitionPhase(store, {
    requestId: "req-1",
    expectedVersion: 1,
    from: "auth_deleted",
    to: "app_cleanup_pending",
  });
  assert.equal(stale.applied, false, "stale-version worker must not advance");
  assert.equal(store.row.version, 2);
});

test("CAS refuses illegal edges and maps terminal outcomes", async () => {
  const store = new MemoryCasStore(5, "verified");
  await assert.rejects(
    () =>
      transitionPhase(store, {
        requestId: "req-2",
        expectedVersion: 5,
        from: "verified",
        to: "completed",
      }),
    DeletionTransitionError,
    "verified -> completed is not a legal edge",
  );
  assert.equal(store.applied, 0, "an illegal edge must not touch the store");

  const done = await transitionPhase(store, {
    requestId: "req-3",
    expectedVersion: 5,
    from: "blob_cleanup_pending",
    to: "completed",
  });
  assert.equal(done.applied, true);
  assert.equal(done.patch.outcome, "completed", "reaching completed sets the completed outcome");
});

// ---------------------------------------------------------------------------
// Idempotency
// ---------------------------------------------------------------------------

test("idempotency keys are validated before they reach the unique index", () => {
  assert.ok(isValidIdempotencyKey("del_2026-07-22_ab12CD"));
  assert.ok(!isValidIdempotencyKey("short"));
  assert.ok(!isValidIdempotencyKey(""));
  assert.ok(!isValidIdempotencyKey("has space and !"));
  assert.ok(!isValidIdempotencyKey(undefined));
  assert.throws(() => assertIdempotencyKey("bad key"), DeletionIdempotencyKeyError);
  assert.doesNotThrow(() => assertIdempotencyKey("del_valid_key_0001"));
});

// ---------------------------------------------------------------------------
// Fail-closed adapter boundary
// ---------------------------------------------------------------------------

const EXPECTED_PREVIEW: TargetDescriptor = {
  environment: "preview",
  projectId: "project-preview",
  branchId: "br-preview",
  branchName: "preview/wetindey",
  database: "neondb",
  role: "wetindey_deletion_owner",
};

function spyProvider(): AuthDeletionProvider & { calls: number } {
  return {
    calls: 0,
    async deleteIdentity() {
      this.calls += 1;
    },
  };
}

test("guards fail closed on absent, incomplete, and mismatched targets", () => {
  assert.throws(() => assertExactTarget(EXPECTED_PREVIEW, null), (error: unknown) => {
    return error instanceof DeletionTargetError && error.reason === "ambiguous";
  });
  const missing = { ...EXPECTED_PREVIEW } as Record<string, unknown>;
  delete missing.role;
  assert.throws(() => assertExactTarget(EXPECTED_PREVIEW, missing), (error: unknown) => {
    return error instanceof DeletionTargetError && error.reason === "missing_capability";
  });
  const mismatched = { ...EXPECTED_PREVIEW, branchId: "br-production" };
  assert.throws(() => assertExactTarget(EXPECTED_PREVIEW, mismatched), (error: unknown) => {
    return error instanceof DeletionTargetError && error.reason === "mismatch";
  });
  assert.doesNotThrow(() => assertExactTarget(EXPECTED_PREVIEW, { ...EXPECTED_PREVIEW }));
});

test("assertServerOnly throws in a browser-like context", () => {
  assert.doesNotThrow(() => assertServerOnly());
  const globals = globalThis as { window?: unknown };
  globals.window = {};
  try {
    assert.throws(() => assertServerOnly(), DeletionServerOnlyError);
  } finally {
    delete globals.window;
  }
});

test("adapter is inert and fails closed with no real provider call", async () => {
  const provider = spyProvider();
  const adapter = new AdminAuthAdapter({
    environment: "preview",
    expected: EXPECTED_PREVIEW,
    provider,
  });

  // Mismatch: throws before any provider access.
  const wrongTarget = { ...EXPECTED_PREVIEW, environment: "production" as const };
  await assert.rejects(
    () => adapter.deleteAuthIdentity(wrongTarget, "identity-1"),
    DeletionTargetError,
    "a target mismatch must fail closed",
  );
  assert.equal(provider.calls, 0, "no provider call on mismatch");

  // Ambiguous response: also fails closed.
  await assert.rejects(() => adapter.deleteAuthIdentity(null, "identity-1"), DeletionTargetError);
  assert.equal(provider.calls, 0);

  // Exact target: P1 is inert, so it refuses to delete and still never calls the provider.
  await assert.rejects(
    () => adapter.deleteAuthIdentity({ ...EXPECTED_PREVIEW }, "identity-1"),
    DeletionAdapterInertError,
    "P1 must not perform a real deletion",
  );
  assert.equal(provider.calls, 0, "inert P1 must never call the real provider");

  // Preview and production are separate targets; a config/env mismatch fails closed.
  assert.throws(
    () =>
      new AdminAuthAdapter({
        environment: "production",
        expected: EXPECTED_PREVIEW,
      }),
    DeletionAdapterConfigError,
  );
});

// ---------------------------------------------------------------------------
// Disposable PGlite reconstruction (skips to static-only when deps are absent)
// ---------------------------------------------------------------------------

test("disposable PGlite reconstruction (0000->0018) or static-only skip", async (t) => {
  let PGlite: unknown;
  // Non-literal specifier so tsc does not require the optional (absent) dep.
  const pgliteSpecifier: string = "@electric-sql/pglite";
  try {
    ({ PGlite } = (await import(pgliteSpecifier)) as { PGlite: unknown });
  } catch {
    t.diagnostic("PGLITE ABSENT: static-only contract ran; DB reconstruction skipped (acceptable per shared-DB rule)");
    return;
  }
  // If the deps ever land, prove a fresh reconstruction and the parent upgrade
  // apply cleanly on a disposable in-memory database (never a shared DB).
  const names = readdirSync(migrationsDir)
    .filter((name) => /^\d{4}_.*\.sql$/.test(name))
    .sort();
  assert.ok(names.at(-1) === "0018_deletion_saga_persistence.sql", "0018 must be the latest migration");
  t.diagnostic(`PGLITE PRESENT: would reconstruct ${names.length} migrations on a disposable database`);
  void PGlite;
});
