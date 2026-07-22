/**
 * ADR-021 P1 compare-and-set phase primitive and idempotency helpers.
 *
 * The saga's phase machine lives here in application code, NOT in a database
 * function: a worker advances a request only through `transitionPhase`, which
 * issues a version-guarded compare-and-set. Two workers that both read the same
 * row version can therefore never double-advance it: exactly one swap applies,
 * the other observes a stale version and does nothing. This module is pure and
 * import-safe (no `server-only`, no I/O), so tests can drive it directly.
 */

import {
  DELETION_CANONICAL_PHASES,
  DELETION_FAILURE_PHASES,
  DELETION_PHASES,
  type DeletionOutcome,
  type DeletionPhase,
} from "./types";

export {
  DELETION_CANONICAL_PHASES,
  DELETION_FAILURE_PHASES,
  DELETION_PHASES,
};

/** The three terminal phases the saga can rest in. */
export const DELETION_TERMINAL_PHASES = [
  "completed",
  "verification_expired",
  "blocked_manual",
] as const;

export type DeletionTerminalPhase = (typeof DELETION_TERMINAL_PHASES)[number];

export function isTerminalPhase(phase: DeletionPhase): phase is DeletionTerminalPhase {
  return (DELETION_TERMINAL_PHASES as readonly DeletionPhase[]).includes(phase);
}

/**
 * The only legal forward transitions. The happy path walks the canonical
 * phases; each cleanup and the auth delete may drop into a `*_retryable`
 * holding phase and re-enter; any active phase may escalate to `blocked_manual`.
 * Terminal phases have no outgoing edges.
 */
export const DELETION_PHASE_TRANSITIONS: Record<DeletionPhase, readonly DeletionPhase[]> = {
  challenge_pending: ["verified", "verification_expired", "blocked_manual"],
  verified: ["auth_delete_pending", "blocked_manual"],
  auth_delete_pending: ["auth_deleted", "auth_delete_retryable", "blocked_manual"],
  auth_delete_retryable: ["auth_delete_pending", "blocked_manual"],
  auth_deleted: ["app_cleanup_pending", "blocked_manual"],
  app_cleanup_pending: ["presence_cleanup_pending", "cleanup_retryable", "blocked_manual"],
  presence_cleanup_pending: ["blob_cleanup_pending", "cleanup_retryable", "blocked_manual"],
  blob_cleanup_pending: ["completed", "cleanup_retryable", "blocked_manual"],
  cleanup_retryable: [
    "app_cleanup_pending",
    "presence_cleanup_pending",
    "blob_cleanup_pending",
    "blocked_manual",
  ],
  completed: [],
  verification_expired: [],
  blocked_manual: [],
};

/** The coarse outcome a terminal phase resolves to; non-terminal phases stay `pending`. */
export function phaseOutcome(phase: DeletionPhase): DeletionOutcome {
  switch (phase) {
    case "completed":
      return "completed";
    case "verification_expired":
      return "expired";
    case "blocked_manual":
      return "failed";
    default:
      return "pending";
  }
}

export class DeletionTransitionError extends Error {
  constructor(
    readonly from: DeletionPhase,
    readonly to: DeletionPhase,
  ) {
    super(`illegal deletion phase transition: ${from} -> ${to}`);
    this.name = "DeletionTransitionError";
  }
}

export function isLegalTransition(from: DeletionPhase, to: DeletionPhase): boolean {
  return DELETION_PHASE_TRANSITIONS[from].includes(to);
}

export function assertLegalTransition(from: DeletionPhase, to: DeletionPhase): void {
  if (!isLegalTransition(from, to)) {
    throw new DeletionTransitionError(from, to);
  }
}

/** The fields a phase advance writes. `version` and `updatedAt` are bumped by the store. */
export interface DeletionPhasePatch {
  readonly phase: DeletionPhase;
  readonly outcome: DeletionOutcome;
  readonly attemptCount: number;
  readonly nextRetryAt: Date | null;
}

/**
 * The compare-and-set store the primitive drives. An implementation MUST apply
 * the patch atomically only when the stored `version` still equals
 * `expectedVersion`, bumping the version on success, and return whether it
 * applied. The canonical SQL implementation is `buildPhaseAdvanceStatement`.
 */
export interface DeletionCasStore {
  compareAndSwap(input: {
    requestId: string;
    expectedVersion: number;
    patch: DeletionPhasePatch;
  }): Promise<boolean>;
}

export interface TransitionResult {
  readonly applied: boolean;
  readonly from: DeletionPhase;
  readonly to: DeletionPhase;
  readonly expectedVersion: number;
  readonly patch: DeletionPhasePatch;
}

/**
 * The CAS phase-transition primitive. Validates the edge, then asks the store
 * to swap phases only if the row is still at `expectedVersion`. Returns
 * `applied: false` when another worker won the race; never throws on a losing
 * race (only on an illegal edge).
 */
export async function transitionPhase(
  store: DeletionCasStore,
  params: {
    requestId: string;
    expectedVersion: number;
    from: DeletionPhase;
    to: DeletionPhase;
    attemptCount?: number;
    nextRetryAt?: Date | null;
  },
): Promise<TransitionResult> {
  assertLegalTransition(params.from, params.to);
  const patch: DeletionPhasePatch = {
    phase: params.to,
    outcome: phaseOutcome(params.to),
    attemptCount: params.attemptCount ?? 0,
    nextRetryAt: params.nextRetryAt ?? null,
  };
  const applied = await store.compareAndSwap({
    requestId: params.requestId,
    expectedVersion: params.expectedVersion,
    patch,
  });
  return {
    applied,
    from: params.from,
    to: params.to,
    expectedVersion: params.expectedVersion,
    patch,
  };
}

/**
 * The canonical version-guarded UPDATE a Postgres-backed `DeletionCasStore`
 * runs. The `WHERE ... AND version = $6` clause is the compare; `version + 1`
 * is the set. A row count of 1 means this worker won; 0 means it lost the race.
 */
export function buildPhaseAdvanceStatement(input: {
  requestId: string;
  expectedVersion: number;
  patch: DeletionPhasePatch;
}): { text: string; values: unknown[] } {
  return {
    text:
      'UPDATE "deletion_requests" SET ' +
      '"phase" = $1, "outcome" = $2, "attempt_count" = $3, "next_retry_at" = $4, ' +
      '"version" = "version" + 1, "updated_at" = now() ' +
      'WHERE "id" = $5 AND "version" = $6',
    values: [
      input.patch.phase,
      input.patch.outcome,
      input.patch.attemptCount,
      input.patch.nextRetryAt,
      input.requestId,
      input.expectedVersion,
    ],
  };
}

/**
 * Idempotency-key contract. A submission carries a caller-chosen key; the unique
 * index on `deletion_requests.idempotency_key` is what makes a retry re-attach
 * to the existing saga instead of starting a second one. The key must be a
 * bounded, URL-safe token; anything else is rejected before it reaches the DB.
 */
export const DELETION_IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9._:-]{8,128}$/;

export class DeletionIdempotencyKeyError extends Error {
  constructor() {
    super("deletion idempotency key must be a bounded url-safe token of length 8..128");
    this.name = "DeletionIdempotencyKeyError";
  }
}

export function isValidIdempotencyKey(key: unknown): key is string {
  return typeof key === "string" && DELETION_IDEMPOTENCY_KEY_PATTERN.test(key);
}

export function assertIdempotencyKey(key: unknown): asserts key is string {
  if (!isValidIdempotencyKey(key)) {
    throw new DeletionIdempotencyKeyError();
  }
}
