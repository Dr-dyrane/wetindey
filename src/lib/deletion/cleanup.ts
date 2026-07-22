/**
 * ADR-021 P2 ordered app-DB cleanup adapter (INERT) plus the P2 primitives the
 * other cleanup adapters share.
 *
 * This module encodes the app-database rows of the account-deletion policy and
 * proves them against an INJECTED executor only. It is inert by construction:
 * it imports no `db`, no `pg`, no `@vercel/blob`, and no other real store, so it
 * can only ever touch whatever fixture a caller hands it. This lane wires
 * nothing real, so no real account is ever deleted and no shared database is
 * ever contacted. With no executor wired, the adapter throws a clear
 * `DeletionNotWiredError` instead of silently succeeding.
 *
 * The subject identifier (the account's `user_id`) is threaded in as a runtime
 * ref, mirroring P1's `deleteAuthIdentity(actual, identityRef)`: the frozen 0018
 * `deletion_requests` row carries no subject column, and the durable resume
 * state (phase, version, attempt_count, next_retry_at) is enough for the CAS
 * machine. The protected subject is supplied by the caller each step and never
 * persisted by this lane.
 *
 * The encoded order matches the ADR: the profile row (PII) is deleted first,
 * then the account's sources are DETACHED to anonymous (user_id -> NULL) while
 * the source row and every observation are RETAINED unchanged, then the
 * account-linked problem reports are deleted in full. Presence and Blob are
 * separate phases (see ./presence and ./blob-enumeration); this file owns only
 * the app-database projection.
 */

import { assertServerOnly } from "./guards";

/**
 * Raised when a P2 adapter is asked to act but nothing is wired to drive it: no
 * disposable fixture and no real credential (this lane supplies none). It exists
 * so an unwired adapter fails loudly and safely rather than reaching a real
 * store or pretending success.
 */
export class DeletionNotWiredError extends Error {
  constructor(readonly boundary: string) {
    super(
      `deletion ${boundary} adapter is not wired: no disposable fixture or credential is present, so no real store is contacted`,
    );
    this.name = "DeletionNotWiredError";
  }
}

/**
 * The protected subject id every cleanup phase needs after the profile row is
 * gone. It must be a v-agnostic UUID (the shape of `neon_auth.user.id`,
 * `sources.user_id`, `user_profiles.user_id`, `problem_reports.user_id`). A
 * non-UUID fails closed so a malformed ref can never widen a `WHERE user_id = ?`
 * or a blob prefix.
 */
const DELETION_SUBJECT_ID_PATTERN =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

export class DeletionSubjectError extends Error {
  constructor() {
    super("deletion protected subject id must be a uuid");
    this.name = "DeletionSubjectError";
  }
}

export function isDeletionSubjectId(value: unknown): value is string {
  return typeof value === "string" && DELETION_SUBJECT_ID_PATTERN.test(value);
}

export function assertDeletionSubjectId(value: unknown): asserts value is string {
  if (!isDeletionSubjectId(value)) {
    throw new DeletionSubjectError();
  }
}

/** The three app-database steps, in the exact order the ADR policy runs them. */
export const APP_CLEANUP_STEPS = [
  "delete_user_profile",
  "null_source_user_id",
  "delete_problem_reports",
] as const;

export type AppCleanupStep = (typeof APP_CLEANUP_STEPS)[number];

/** A single parameterised statement for one app-cleanup step. */
export interface AppCleanupStatement {
  readonly step: AppCleanupStep;
  readonly text: string;
  readonly values: readonly [string];
}

/**
 * Encodes the app-database policy as three ordered, parameterised statements.
 * The subject id is bound as a value (never interpolated), so the statement
 * text is constant and cannot be widened by its input.
 *
 * 1. DELETE the profile row: it IS the PII, so erasure removes it.
 * 2. UPDATE sources SET user_id = NULL: the source row and all observations that
 *    reference it by `source_id` are RETAINED; only the account attribution is
 *    dropped, degrading the source to anonymous exactly as `sources.user_id`'s
 *    schema comment prescribes. Observations are never touched.
 * 3. DELETE the account-linked problem reports in full. Anonymous reports
 *    (user_id IS NULL) are never matched.
 */
export function buildAppCleanupStatements(
  subjectId: string,
): readonly [AppCleanupStatement, AppCleanupStatement, AppCleanupStatement] {
  assertDeletionSubjectId(subjectId);
  return [
    {
      step: "delete_user_profile",
      text: 'DELETE FROM "user_profiles" WHERE "user_id" = $1',
      values: [subjectId],
    },
    {
      step: "null_source_user_id",
      text: 'UPDATE "sources" SET "user_id" = NULL, "updated_at" = now() WHERE "user_id" = $1',
      values: [subjectId],
    },
    {
      step: "delete_problem_reports",
      text: 'DELETE FROM "problem_reports" WHERE "user_id" = $1',
      values: [subjectId],
    },
  ];
}

/** Runs one encoded statement against a fixture/credential; returns rows affected. */
export interface AppCleanupExecutor {
  execute(statement: AppCleanupStatement): Promise<number>;
}

export interface AppCleanupResult {
  readonly profilesDeleted: number;
  readonly sourcesDetached: number;
  readonly problemReportsDeleted: number;
}

/**
 * The inert app-database cleanup adapter. Construct it with an executor (a
 * disposable fixture in tests, a scoped credential in a later live phase) or
 * with nothing. `run` proves server-only execution and a valid subject, then
 * drives the three encoded statements in order. Re-running is idempotent: the
 * second pass matches zero rows (profile already gone, sources already null,
 * reports already deleted), so replay causes no double effect.
 */
export class AppCleanupAdapter {
  private readonly executor: AppCleanupExecutor | null;

  constructor(config?: { executor?: AppCleanupExecutor | null }) {
    this.executor = config?.executor ?? null;
  }

  isWired(): boolean {
    return this.executor !== null;
  }

  async run(subjectId: string): Promise<AppCleanupResult> {
    assertServerOnly();
    assertDeletionSubjectId(subjectId);
    if (!this.executor) {
      throw new DeletionNotWiredError("app-cleanup");
    }
    const [profile, sources, reports] = buildAppCleanupStatements(subjectId);
    const profilesDeleted = await this.executor.execute(profile);
    const sourcesDetached = await this.executor.execute(sources);
    const problemReportsDeleted = await this.executor.execute(reports);
    return { profilesDeleted, sourcesDetached, problemReportsDeleted };
  }
}
