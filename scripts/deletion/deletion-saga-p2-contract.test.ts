/**
 * ADR-021 P2 deletion-saga cleanup contract.
 *
 * Proves the INERT cleanup policy layered over the frozen P1 0018 tables and CAS
 * machine: correct ordering (no cleanup before `auth_deleted`), that detaching a
 * source (user_id -> NULL) RETAINS the source row and every observation, that
 * account-linked problem reports are deleted, that avatar Blob cleanup is
 * exact-prefix and paginated and treats already-absent as success only after it
 * proves none remain, that the Presence boundary is invoked idempotently and its
 * result proven with only tombstoned safety metadata retained, that idempotent
 * replay causes no double effect, that the saga reaches the terminal `completed`
 * and manual `blocked_manual` states, that every audit row is redacted, and that
 * NO real deletion can occur (the modules import no real store and every unwired
 * adapter fails closed).
 *
 * Shared-store rule: this harness drives only disposable in-memory fixtures. It
 * contacts no shared/preview/production database and no real Blob store, and it
 * changes no schema or migration.
 */

import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import {
  APP_CLEANUP_STEPS,
  AppCleanupAdapter,
  DeletionNotWiredError,
  DeletionSubjectError,
  assertDeletionSubjectId,
  buildAppCleanupStatements,
  isDeletionSubjectId,
  type AppCleanupExecutor,
  type AppCleanupStatement,
} from "../../src/lib/deletion/cleanup";
import {
  BlobCleanupAdapter,
  BlobPrefixViolationError,
  BlobResidueError,
  buildAvatarPrefix,
  type BlobListPage,
  type BlobStoreClient,
} from "../../src/lib/deletion/blob-enumeration";
import {
  PresenceCleanupAdapter,
  PresenceResidueError,
  buildPresenceDeleteCall,
  type PresenceDeleteCall,
  type PresenceDeletionBoundary,
  type PresenceResidue,
} from "../../src/lib/deletion/presence";
import {
  DeletionAuditRedactionError,
  DeletionAuditWriter,
  DeletionPurgeAdapter,
  DeletionPurgeError,
  DELETION_AUDIT_ALLOWED_KEYS,
  assertRedactedAudit,
  buildAuditInsert,
  buildPurgeStatements,
  type DeletionAuditAppend,
  type DeletionAuditSink,
  type PurgeStatement,
} from "../../src/lib/deletion/audit";
import {
  DELETION_BACKOFF_BASE_MS,
  DELETION_BACKOFF_CAP_MS,
  DeletionOrderingError,
  advanceOnce,
  computeNextRetryAt,
  driveDeletionSaga,
  type DeletionRequestReader,
  type DeletionSagaDeps,
} from "../../src/lib/deletion/orchestrator";
import {
  DELETION_PHASE_TRANSITIONS,
  isTerminalPhase,
  type DeletionCasStore,
  type DeletionPhasePatch,
} from "../../src/lib/deletion/phases";
import type { DeletionPhase, DeletionRequestRow } from "../../src/lib/deletion/types";

const root = path.resolve(import.meta.dirname, "../..");
const SUBJECT = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";
const HEX64 = "a".repeat(64);

// ---------------------------------------------------------------------------
// In-memory fixtures (disposable; no real store is ever touched)
// ---------------------------------------------------------------------------

interface AppRows {
  userProfiles: Array<{ userId: string }>;
  sources: Array<{ id: string; userId: string | null }>;
  observations: Array<{ id: string; sourceId: string }>;
  problemReports: Array<{ id: string; userId: string | null }>;
}

/** Applies the encoded app-cleanup statements by their declared step semantics. */
class FakeAppDb implements AppCleanupExecutor {
  constructor(readonly rows: AppRows) {}
  async execute(statement: AppCleanupStatement): Promise<number> {
    const subject = statement.values[0];
    switch (statement.step) {
      case "delete_user_profile": {
        const before = this.rows.userProfiles.length;
        this.rows.userProfiles = this.rows.userProfiles.filter((r) => r.userId !== subject);
        return before - this.rows.userProfiles.length;
      }
      case "null_source_user_id": {
        let n = 0;
        for (const s of this.rows.sources) {
          if (s.userId === subject) {
            s.userId = null;
            n += 1;
          }
        }
        return n;
      }
      case "delete_problem_reports": {
        const before = this.rows.problemReports.length;
        this.rows.problemReports = this.rows.problemReports.filter((r) => r.userId !== subject);
        return before - this.rows.problemReports.length;
      }
    }
  }
}

function seedAppDb(): AppRows {
  return {
    userProfiles: [{ userId: SUBJECT }],
    sources: [
      { id: "src-subject", userId: SUBJECT },
      { id: "src-anon", userId: null },
      { id: "src-other", userId: OTHER },
    ],
    observations: [
      { id: "obs-1", sourceId: "src-subject" },
      { id: "obs-2", sourceId: "src-subject" },
      { id: "obs-3", sourceId: "src-anon" },
    ],
    problemReports: [
      { id: "pr-1", userId: SUBJECT },
      { id: "pr-2", userId: null },
      { id: "pr-3", userId: OTHER },
    ],
  };
}

/** A well-behaved Blob store: paginates and honours the prefix. */
class FakeBlob implements BlobStoreClient {
  listCalls = 0;
  delCalls = 0;
  constructor(
    public objects: Array<{ pathname: string; url: string }>,
    readonly pageSize = 2,
  ) {}
  async list(input: { prefix: string; cursor: string | null }): Promise<BlobListPage> {
    this.listCalls += 1;
    const matching = this.objects.filter((o) => o.pathname.startsWith(input.prefix));
    const start = input.cursor ? Number.parseInt(input.cursor, 10) : 0;
    const slice = matching.slice(start, start + this.pageSize);
    const next = start + slice.length;
    const hasMore = next < matching.length;
    return {
      blobs: slice.map((o) => ({ pathname: o.pathname, url: o.url })),
      cursor: hasMore ? String(next) : null,
      hasMore,
    };
  }
  async del(urls: readonly string[]): Promise<void> {
    this.delCalls += 1;
    this.objects = this.objects.filter((o) => !urls.includes(o.url));
  }
}

/** A mis-scoped store that ignores the prefix, to prove the fail-closed guard. */
class MisScopedBlob implements BlobStoreClient {
  delCalls = 0;
  constructor(public objects: Array<{ pathname: string; url: string }>) {}
  async list(): Promise<BlobListPage> {
    return {
      blobs: this.objects.map((o) => ({ pathname: o.pathname, url: o.url })),
      cursor: null,
      hasMore: false,
    };
  }
  async del(): Promise<void> {
    this.delCalls += 1;
  }
}

class FakePresence implements PresenceDeletionBoundary {
  deleteCalls = 0;
  lastCall: PresenceDeleteCall | null = null;
  private state = {
    leases: 1,
    prefs: 1,
    blocks: 1,
    rateBuckets: 1,
    reportsAttributed: 2,
    tombstoned: 0,
  };
  async deleteAccount(call: PresenceDeleteCall): Promise<void> {
    this.deleteCalls += 1;
    this.lastCall = call;
    // Pseudonymise attributed reports (retain as tombstones), erase the rest.
    this.state.tombstoned += this.state.reportsAttributed;
    this.state.leases = 0;
    this.state.prefs = 0;
    this.state.blocks = 0;
    this.state.rateBuckets = 0;
    this.state.reportsAttributed = 0;
  }
  async probeResidue(): Promise<PresenceResidue> {
    return {
      liveLeases: this.state.leases,
      preferences: this.state.prefs,
      blocks: this.state.blocks,
      rateBuckets: this.state.rateBuckets,
      reportsAttributed: this.state.reportsAttributed,
      tombstonedReports: this.state.tombstoned,
    };
  }
}

/** A leaky boundary that fails to clear a lease, to prove the residue guard. */
class LeakyPresence implements PresenceDeletionBoundary {
  async deleteAccount(): Promise<void> {}
  async probeResidue(): Promise<PresenceResidue> {
    return {
      liveLeases: 1,
      preferences: 0,
      blocks: 0,
      rateBuckets: 0,
      reportsAttributed: 0,
      tombstonedReports: 0,
    };
  }
}

function makeRow(phase: DeletionPhase, over: Partial<DeletionRequestRow> = {}): DeletionRequestRow {
  return {
    id: "req-1",
    idempotencyKey: "del_p2_contract_0001",
    phase,
    attemptCount: 0,
    nextRetryAt: null,
    outcome: phase === "completed" ? "completed" : "pending",
    version: 1,
    createdAt: new Date("2026-07-22T00:00:00.000Z"),
    updatedAt: new Date("2026-07-22T00:00:00.000Z"),
    ...over,
  };
}

/** A version-guarded in-memory saga store that is also a durable-row reader. */
class FakeSagaStore implements DeletionCasStore, DeletionRequestReader {
  swaps = 0;
  constructor(public row: DeletionRequestRow) {}
  async compareAndSwap(input: {
    requestId: string;
    expectedVersion: number;
    patch: DeletionPhasePatch;
  }): Promise<boolean> {
    if (this.row.version !== input.expectedVersion) return false;
    this.row = {
      ...this.row,
      phase: input.patch.phase,
      outcome: input.patch.outcome,
      attemptCount: input.patch.attemptCount,
      nextRetryAt: input.patch.nextRetryAt,
      version: this.row.version + 1,
      updatedAt: new Date(),
    };
    this.swaps += 1;
    return true;
  }
  async read(): Promise<DeletionRequestRow> {
    return this.row;
  }
}

class FakeAudit implements DeletionAuditSink {
  rows: DeletionAuditAppend[] = [];
  async append(row: DeletionAuditAppend): Promise<void> {
    assertRedactedAudit(row);
    this.rows.push(row);
  }
}

class FakeClock {
  constructor(public t: Date) {}
  now(): Date {
    return this.t;
  }
  advance(ms: number): void {
    this.t = new Date(this.t.getTime() + ms);
  }
}

function makeDeps(over: Partial<DeletionSagaDeps> & Pick<DeletionSagaDeps, "store" | "audit">): DeletionSagaDeps {
  return {
    clock: new FakeClock(new Date("2026-07-22T00:00:00.000Z")),
    app: new AppCleanupAdapter({ executor: new FakeAppDb(seedAppDb()) }),
    presence: new PresenceCleanupAdapter({ boundary: new FakePresence() }),
    blob: new BlobCleanupAdapter({ client: new FakeBlob([]) }),
    subjectId: SUBJECT,
    ...over,
  };
}

// ---------------------------------------------------------------------------
// Structural: no real deletion is possible
// ---------------------------------------------------------------------------

const P2_SOURCE_FILES = [
  "src/lib/deletion/cleanup.ts",
  "src/lib/deletion/blob-enumeration.ts",
  "src/lib/deletion/presence.ts",
  "src/lib/deletion/audit.ts",
  "src/lib/deletion/orchestrator.ts",
  "scripts/deletion/deletion-saga-p2-contract.test.ts",
] as const;

test("the P2 lane artifacts exist", () => {
  for (const rel of P2_SOURCE_FILES) {
    assert.ok(existsSync(path.join(root, rel)), `missing ${rel}`);
  }
});

test("P2 modules import no real store, so no real deletion can occur", () => {
  // A module that cannot import `db`, `pg`, `@vercel/blob`, or the auth session
  // cannot contact a shared database or real Blob bucket: inertness is structural.
  const forbidden = [
    /from\s+["']@\/db["']/,
    /from\s+["']pg["']/,
    /from\s+["']@vercel\/blob["']/,
    /from\s+["']server-only["']/,
    /from\s+["']@\/lib\/auth["']/,
  ];
  for (const rel of P2_SOURCE_FILES.slice(0, 5)) {
    const src = readFileSync(path.join(root, rel), "utf8");
    for (const pattern of forbidden) {
      assert.doesNotMatch(src, pattern, `${rel} must not import a real store (${pattern})`);
    }
  }
});

test("every unwired adapter fails closed with a clear NotWiredError", async () => {
  await assert.rejects(() => new AppCleanupAdapter().run(SUBJECT), DeletionNotWiredError);
  await assert.rejects(() => new BlobCleanupAdapter().run(SUBJECT), DeletionNotWiredError);
  await assert.rejects(() => new PresenceCleanupAdapter().run(SUBJECT), DeletionNotWiredError);
  await assert.rejects(() => new DeletionAuditWriter().append({
    requestId: "req-1",
    fromPhase: "auth_deleted",
    toPhase: "app_cleanup_pending",
    reasonCode: "enter_app_cleanup",
    challengeHash: null,
    attempt: 0,
  }), DeletionNotWiredError);
  await assert.rejects(() => new DeletionPurgeAdapter().run(new Date()), DeletionNotWiredError);
});

// ---------------------------------------------------------------------------
// Subject guard and statement parameterisation
// ---------------------------------------------------------------------------

test("the protected subject id must be a uuid and is bound, never interpolated", () => {
  assert.ok(isDeletionSubjectId(SUBJECT));
  assert.ok(!isDeletionSubjectId("not-a-uuid"));
  assert.ok(!isDeletionSubjectId(""));
  assert.throws(() => assertDeletionSubjectId("' OR 1=1 --"), DeletionSubjectError);
  assert.throws(() => buildAppCleanupStatements("nope"), DeletionSubjectError);
  assert.throws(() => buildAvatarPrefix("nope"), DeletionSubjectError);

  const [profile, sources, reports] = buildAppCleanupStatements(SUBJECT);
  assert.deepEqual([profile.step, sources.step, reports.step], [...APP_CLEANUP_STEPS]);
  assert.equal(profile.text, 'DELETE FROM "user_profiles" WHERE "user_id" = $1');
  assert.equal(sources.text, 'UPDATE "sources" SET "user_id" = NULL, "updated_at" = now() WHERE "user_id" = $1');
  assert.equal(reports.text, 'DELETE FROM "problem_reports" WHERE "user_id" = $1');
  for (const s of [profile, sources, reports]) {
    assert.deepEqual(s.values, [SUBJECT]);
    assert.ok(!s.text.includes(SUBJECT), "subject id must be a bound value, not inlined");
  }
});

// ---------------------------------------------------------------------------
// App cleanup: detach source (retain row + observations), delete reports
// ---------------------------------------------------------------------------

test("app cleanup deletes the profile, detaches sources keeping the row and every observation, deletes account reports", async () => {
  const rows = seedAppDb();
  const observationsBefore = JSON.stringify(rows.observations);
  const sourceIdsBefore = rows.sources.map((s) => s.id).sort();

  const adapter = new AppCleanupAdapter({ executor: new FakeAppDb(rows) });
  const result = await adapter.run(SUBJECT);

  assert.equal(result.profilesDeleted, 1);
  assert.equal(result.sourcesDetached, 1);
  assert.equal(result.problemReportsDeleted, 1);

  // Profile (the PII) is gone.
  assert.equal(rows.userProfiles.length, 0);

  // The source ROW is retained; only its attribution is dropped.
  assert.deepEqual(rows.sources.map((s) => s.id).sort(), sourceIdsBefore, "no source row may be deleted");
  assert.equal(rows.sources.find((s) => s.id === "src-subject")?.userId, null, "subject source detached");
  assert.equal(rows.sources.find((s) => s.id === "src-other")?.userId, OTHER, "another account's source untouched");

  // Observations are byte-for-byte unchanged, and each still resolves to a source.
  assert.equal(JSON.stringify(rows.observations), observationsBefore, "observations must be untouched");
  for (const obs of rows.observations) {
    assert.ok(rows.sources.some((s) => s.id === obs.sourceId), "every observation still resolves to a retained source");
  }

  // Account-linked reports deleted; anonymous and other-account reports retained.
  assert.deepEqual(rows.problemReports.map((r) => r.id).sort(), ["pr-2", "pr-3"]);
});

// ---------------------------------------------------------------------------
// Blob: exact-prefix, paginated, verified-empty, fail-closed
// ---------------------------------------------------------------------------

function seedBlobObjects(): Array<{ pathname: string; url: string }> {
  return [
    { pathname: `avatars/${SUBJECT}.png-r1`, url: "u1" },
    { pathname: `avatars/${SUBJECT}.jpg-r2`, url: "u2" },
    { pathname: `avatars/${SUBJECT}.webp-r3`, url: "u3" },
    { pathname: `avatars/${SUBJECT}.png-r4`, url: "u4" },
    { pathname: `avatars/${SUBJECT}.jpg-r5`, url: "u5" },
    { pathname: `avatars/${OTHER}.png-x`, url: "foreign" },
    { pathname: `other/${SUBJECT}.png`, url: "unrelated" },
  ];
}

test("blob cleanup is exact-prefix and paginated, deletes every random-suffixed key, and spares foreign objects", async () => {
  const blob = new FakeBlob(seedBlobObjects(), 2);
  const adapter = new BlobCleanupAdapter({ client: blob });
  const result = await adapter.run(SUBJECT);

  assert.equal(result.prefix, `avatars/${SUBJECT}.`);
  assert.equal(result.deletedCount, 5, "all five random-suffixed avatars removed");
  assert.ok(result.pagesScanned >= 3, "five objects at pageSize 2 forces multiple pages (paginated)");
  assert.equal(result.verifiedEmpty, true);

  // Foreign and unrelated objects survive.
  assert.deepEqual(blob.objects.map((o) => o.url).sort(), ["foreign", "unrelated"]);
});

test("blob cleanup treats already-absent as success only after enumeration proves none remain", async () => {
  const blob = new FakeBlob(seedBlobObjects(), 2);
  const adapter = new BlobCleanupAdapter({ client: blob });
  await adapter.run(SUBJECT);
  const replay = await adapter.run(SUBJECT);
  assert.equal(replay.deletedCount, 0, "replay deletes nothing");
  assert.equal(replay.verifiedEmpty, true, "still verified empty by a fresh enumeration");
});

test("blob cleanup fails closed when a store returns an object outside the exact prefix", async () => {
  const store = new MisScopedBlob([{ pathname: `avatars/${OTHER}.png-x`, url: "foreign" }]);
  const adapter = new BlobCleanupAdapter({ client: store });
  await assert.rejects(() => adapter.run(SUBJECT), BlobPrefixViolationError);
  assert.equal(store.delCalls, 0, "a mis-scoped object is never deleted");
});

test("blob cleanup fails closed if a matching object survives the delete", async () => {
  const stubborn: BlobStoreClient = {
    async list(input) {
      return {
        blobs: [{ pathname: `${input.prefix}png-r1`, url: "stuck" }],
        cursor: null,
        hasMore: false,
      } satisfies BlobListPage;
    },
    async del() {
      // Silently fails to delete: the residue guard must catch it.
    },
  };
  await assert.rejects(() => new BlobCleanupAdapter({ client: stubborn }).run(SUBJECT), BlobResidueError);
});

// ---------------------------------------------------------------------------
// Presence: idempotent invocation, proven result, tombstone-only residue
// ---------------------------------------------------------------------------

test("presence cleanup invokes the boundary, proves a clear result, and retains only tombstoned reports", async () => {
  const boundary = new FakePresence();
  const adapter = new PresenceCleanupAdapter({ boundary });
  const result = await adapter.run(SUBJECT, { sessionDigest: HEX64 });

  assert.equal(boundary.deleteCalls, 1);
  assert.equal(boundary.lastCall?.fn, "public.presence_delete_account");
  assert.equal(boundary.lastCall?.actor, SUBJECT);
  assert.equal(boundary.lastCall?.sessionDigest, HEX64);
  assert.equal(result.residueClear, true);
  assert.equal(result.tombstonedReports, 2, "the account's safety reports are retained as tombstones");

  // Idempotent: a second invocation changes nothing attributable and stays clear.
  const replay = await adapter.run(SUBJECT);
  assert.equal(boundary.deleteCalls, 2);
  assert.equal(replay.residueClear, true);
  assert.equal(replay.tombstonedReports, 2, "replay adds no new tombstone and clears no retained one");
});

test("presence cleanup fails closed when residue attributable to the actor remains", async () => {
  await assert.rejects(
    () => new PresenceCleanupAdapter({ boundary: new LeakyPresence() }).run(SUBJECT),
    PresenceResidueError,
  );
});

test("presence delete-call rejects a non-hex digest", () => {
  assert.throws(() => buildPresenceDeleteCall(SUBJECT, { deviceDigest: "not-hex" }));
  const call = buildPresenceDeleteCall(SUBJECT, {});
  assert.equal(call.sessionDigest, null);
  assert.equal(call.deviceDigest, null);
  assert.equal(call.networkDigest, null);
});

// ---------------------------------------------------------------------------
// Redacted audit and retention purge
// ---------------------------------------------------------------------------

test("audit redaction rejects forbidden fields, bad reason codes, and bad hashes", () => {
  const ok: DeletionAuditAppend = {
    requestId: "req-1",
    fromPhase: "app_cleanup_pending",
    toPhase: "presence_cleanup_pending",
    reasonCode: "app_cleanup_done",
    challengeHash: null,
    attempt: 0,
  };
  assert.doesNotThrow(() => assertRedactedAudit(ok));

  const withEmail = { ...ok, email: "a@b.co" } as unknown as DeletionAuditAppend;
  assert.throws(() => assertRedactedAudit(withEmail), DeletionAuditRedactionError);

  const withBlobUrl = { ...ok, blobUrl: "https://x" } as unknown as DeletionAuditAppend;
  assert.throws(() => assertRedactedAudit(withBlobUrl), DeletionAuditRedactionError);

  assert.throws(() => assertRedactedAudit({ ...ok, reasonCode: "Not A Token!" }), DeletionAuditRedactionError);
  assert.throws(() => assertRedactedAudit({ ...ok, challengeHash: "xyz" }), DeletionAuditRedactionError);
  assert.throws(() => assertRedactedAudit({ ...ok, attempt: -1 }), DeletionAuditRedactionError);
});

test("the audit INSERT names only the seven redacted columns", () => {
  const insert = buildAuditInsert({
    requestId: "req-1",
    fromPhase: null,
    toPhase: "app_cleanup_pending",
    reasonCode: "enter_app_cleanup",
    challengeHash: null,
    attempt: 0,
  });
  assert.equal(
    insert.text,
    'INSERT INTO "deletion_audit" ("request_id", "from_phase", "to_phase", "reason_code", "challenge_hash", "attempt") VALUES ($1, $2, $3, $4, $5, $6)',
  );
  for (const forbidden of ["email", "otp", "token", "session", "coordinate", "payload", "blob", "url"]) {
    assert.ok(!insert.text.includes(forbidden), `audit insert must not name a '${forbidden}' column`);
  }
});

test("purge deletes aged terminal rows audit-first, and rejects a bad cutoff", async () => {
  const cutoff = new Date("2026-01-01T00:00:00.000Z");
  const [auditStmt, requestStmt] = buildPurgeStatements(cutoff);
  assert.match(auditStmt.text, /DELETE FROM "deletion_audit"/);
  assert.match(auditStmt.text, /"outcome" <> 'pending'/);
  assert.match(requestStmt.text, /DELETE FROM "deletion_requests"/);
  assert.match(requestStmt.text, /"updated_at" < \$1/);
  assert.deepEqual(auditStmt.values, [cutoff]);

  const order: string[] = [];
  const executor = {
    async execute(statement: PurgeStatement): Promise<number> {
      order.push(statement.text.startsWith('DELETE FROM "deletion_audit"') ? "audit" : "requests");
      return 3;
    },
  };
  const result = await new DeletionPurgeAdapter({ executor }).run(cutoff);
  assert.deepEqual(order, ["audit", "requests"], "audit rows purge before their requests (FK-safe)");
  assert.deepEqual(result, { auditRowsPurged: 3, requestsPurged: 3 });

  assert.throws(() => buildPurgeStatements(new Date("nope")), DeletionPurgeError);
});

// ---------------------------------------------------------------------------
// Orchestrator: ordering, happy path, retry/escalate, idempotent replay
// ---------------------------------------------------------------------------

test("no cleanup phase is reachable before auth_deleted (graph and orchestrator agree)", async () => {
  const cleanupPhases: DeletionPhase[] = [
    "app_cleanup_pending",
    "presence_cleanup_pending",
    "blob_cleanup_pending",
  ];
  // Graph: no pre-auth phase points at a cleanup phase.
  const preAuth: DeletionPhase[] = [
    "challenge_pending",
    "verified",
    "auth_delete_pending",
    "auth_delete_retryable",
  ];
  for (const phase of preAuth) {
    for (const target of DELETION_PHASE_TRANSITIONS[phase]) {
      assert.ok(!cleanupPhases.includes(target), `${phase} must not reach ${target}`);
    }
  }
  // app_cleanup_pending is reachable only from auth_deleted or cleanup_retryable.
  const sources = (Object.keys(DELETION_PHASE_TRANSITIONS) as DeletionPhase[]).filter((from) =>
    DELETION_PHASE_TRANSITIONS[from].includes("app_cleanup_pending"),
  );
  assert.deepEqual(sources.sort(), ["auth_deleted", "cleanup_retryable"]);

  // Orchestrator: a pre-auth phase throws the ordering guard, and no runner runs.
  const app = new AppCleanupAdapter({ executor: new FakeAppDb(seedAppDb()) });
  let appRuns = 0;
  const deps = makeDeps({
    store: new FakeSagaStore(makeRow("verified")),
    audit: new FakeAudit(),
    app: { run: async (id) => { appRuns += 1; return app.run(id); } },
  });
  await assert.rejects(() => advanceOnce(makeRow("verified"), deps), DeletionOrderingError);
  assert.equal(appRuns, 0, "no cleanup runs before auth_deleted");
});

test("the saga drives auth_deleted -> completed and writes an ordered, redacted audit trail", async () => {
  const appRows = seedAppDb();
  const blob = new FakeBlob(seedBlobObjects(), 2);
  const presence = new FakePresence();
  const store = new FakeSagaStore(makeRow("auth_deleted"));
  const audit = new FakeAudit();
  const deps = makeDeps({
    store,
    audit,
    app: new AppCleanupAdapter({ executor: new FakeAppDb(appRows) }),
    presence: new PresenceCleanupAdapter({ boundary: presence }),
    blob: new BlobCleanupAdapter({ client: blob }),
  });

  const steps = await driveDeletionSaga(store, deps);

  assert.equal(store.row.phase, "completed");
  assert.equal(store.row.outcome, "completed");
  assert.ok(isTerminalPhase(store.row.phase));
  assert.equal(steps.at(-1)?.kind, "completed");

  // Effects landed exactly once.
  assert.equal(appRows.userProfiles.length, 0);
  assert.equal(appRows.sources.find((s) => s.id === "src-subject")?.userId, null);
  assert.equal(appRows.problemReports.length, 2);
  assert.equal(presence.deleteCalls, 1);
  assert.deepEqual(blob.objects.map((o) => o.url).sort(), ["foreign", "unrelated"]);

  // Audit trail: ordered reason codes, all redacted, no challenge hash on cleanup.
  assert.deepEqual(
    audit.rows.map((r) => r.reasonCode),
    ["enter_app_cleanup", "app_cleanup_done", "presence_cleanup_done", "blob_cleanup_done"],
  );
  const allowed = new Set<string>(DELETION_AUDIT_ALLOWED_KEYS);
  for (const row of audit.rows) {
    assert.doesNotThrow(() => assertRedactedAudit(row));
    for (const key of Object.keys(row)) assert.ok(allowed.has(key), `audit key '${key}' is not allowed`);
    assert.equal(row.challengeHash, null);
  }
});

test("idempotent replay of every cleanup adapter causes no double effect", async () => {
  const appRows = seedAppDb();
  const blob = new FakeBlob(seedBlobObjects(), 2);
  const presence = new FakePresence();
  const app = new AppCleanupAdapter({ executor: new FakeAppDb(appRows) });
  const blobAdapter = new BlobCleanupAdapter({ client: blob });
  const presenceAdapter = new PresenceCleanupAdapter({ boundary: presence });

  await app.run(SUBJECT);
  await presenceAdapter.run(SUBJECT);
  await blobAdapter.run(SUBJECT);

  const sourcesAfter = JSON.stringify(appRows.sources);
  const reportsAfter = JSON.stringify(appRows.problemReports);
  const blobAfter = JSON.stringify(blob.objects);

  // Second pass: nothing left to change anywhere.
  assert.deepEqual(await app.run(SUBJECT), { profilesDeleted: 0, sourcesDetached: 0, problemReportsDeleted: 0 });
  const blobReplay = await blobAdapter.run(SUBJECT);
  assert.equal(blobReplay.deletedCount, 0);
  const presenceReplay = await presenceAdapter.run(SUBJECT);
  assert.equal(presenceReplay.tombstonedReports, 2);

  assert.equal(JSON.stringify(appRows.sources), sourcesAfter, "no source row changed on replay");
  assert.equal(JSON.stringify(appRows.problemReports), reportsAfter);
  assert.equal(JSON.stringify(blob.objects), blobAfter, "no blob object changed on replay");
});

test("a persistently failing cleanup phase retries with backoff then escalates to blocked_manual", async () => {
  const store = new FakeSagaStore(makeRow("auth_deleted"));
  const audit = new FakeAudit();
  const clock = new FakeClock(new Date("2026-07-22T00:00:00.000Z"));
  let appRuns = 0;
  const deps = makeDeps({
    store,
    audit,
    clock,
    maxAttempts: 3,
    app: {
      async run() {
        appRuns += 1;
        throw new Error("app cleanup failed (operational)");
      },
    },
  });

  // Enter cleanup.
  await advanceOnce(store.row, deps);
  assert.equal(store.row.phase as string, "app_cleanup_pending");

  // Fail -> retryable -> resume, until the attempt ceiling escalates.
  for (let guard = 0; guard < 10; guard += 1) {
    if (isTerminalPhase(store.row.phase)) break;
    const step = await advanceOnce(store.row, deps);
    if (step.kind === "retry_scheduled") {
      assert.equal(store.row.phase as string, "cleanup_retryable");
      assert.ok(store.row.nextRetryAt instanceof Date);
      clock.advance(DELETION_BACKOFF_CAP_MS); // jump past the backoff window
    }
  }

  assert.equal(store.row.phase as string, "blocked_manual");
  assert.equal(store.row.outcome, "failed");
  assert.ok(isTerminalPhase(store.row.phase));
  assert.equal(appRuns, 3, "the failing phase is attempted exactly maxAttempts times");
  assert.ok(audit.rows.some((r) => r.reasonCode === "escalate_blocked_manual"));

  // A terminal request is inert to further driving.
  const before = store.swaps;
  const step = await advanceOnce(store.row, deps);
  assert.equal(step.kind, "noop");
  assert.equal(store.swaps, before, "no swap on a terminal request");
});

test("two racing workers advance the saga at most once (CAS reuse)", async () => {
  const store = new FakeSagaStore(makeRow("auth_deleted"));
  const audit = new FakeAudit();
  const deps = makeDeps({ store, audit });
  const row = store.row;
  const [a, b] = await Promise.all([advanceOnce(row, deps), advanceOnce(row, deps)]);
  assert.equal([a.applied, b.applied].filter(Boolean).length, 1, "exactly one worker advances");
  assert.equal(store.swaps, 1);
  assert.equal(audit.rows.length, 1, "only the winning worker writes an audit row");
});

test("backoff is monotonic and capped", () => {
  const now = new Date("2026-07-22T00:00:00.000Z");
  const d1 = computeNextRetryAt(now, 1).getTime() - now.getTime();
  const d2 = computeNextRetryAt(now, 2).getTime() - now.getTime();
  const d3 = computeNextRetryAt(now, 3).getTime() - now.getTime();
  assert.equal(d1, DELETION_BACKOFF_BASE_MS);
  assert.equal(d2, DELETION_BACKOFF_BASE_MS * 2);
  assert.ok(d3 > d2);
  assert.equal(computeNextRetryAt(now, 99).getTime() - now.getTime(), DELETION_BACKOFF_CAP_MS, "capped");
});
