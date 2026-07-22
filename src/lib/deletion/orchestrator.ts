/**
 * ADR-021 P2 deletion-saga orchestrator (INERT).
 *
 * Drives the ordered cleanup policy through the FROZEN P1 phase machine: it
 * imports `transitionPhase`, `isTerminalPhase`, and the transition graph from
 * `./phases` unchanged, and advances a request only by the version-guarded
 * compare-and-set the graph allows. It owns retry/backoff, the terminal
 * `completed` state, the manual `blocked_manual` escalation, phase-idempotent
 * resume from durable state, and a redacted audit append per committed step.
 *
 * It is inert: it opens no connection and imports no real store. Every effect is
 * delegated to injected collaborators (the CAS store, the audit sink, and the
 * three cleanup runners), and the protected subject id is threaded in per step,
 * mirroring P1's `identityRef`. In this lane those collaborators are disposable
 * fixtures, so no real account is deleted and no shared store is touched.
 *
 * Ordering invariant: the machine's edges already forbid any cleanup phase
 * before `auth_deleted` (app/presence/blob cleanup are reachable only from
 * `auth_deleted` or `cleanup_retryable`). The orchestrator additionally refuses
 * to run when handed a pre-`auth_deleted` phase, so "no cleanup before auth is
 * proven deleted" holds at both layers.
 *
 * Attempt counting is monotonic across a cleanup episode: a forward step carries
 * `attempt_count` unchanged, and only a failure increments it, so a phase that
 * keeps failing downstream still climbs to the escalation ceiling instead of
 * resetting. Resume from `cleanup_retryable` re-enters the chain at
 * `app_cleanup_pending`; because every cleanup adapter is idempotent, replaying
 * an already-completed phase matches nothing and causes no double effect.
 */

import type { DeletionAuditAppend, DeletionAuditSink } from "./audit";
import {
  DeletionNotWiredError,
  assertDeletionSubjectId,
  type AppCleanupResult,
} from "./cleanup";
import type { BlobCleanupResult } from "./blob-enumeration";
import type { PresenceCleanupResult, PresenceDeleteInput } from "./presence";
import {
  isTerminalPhase,
  transitionPhase,
  type DeletionCasStore,
} from "./phases";
import type { DeletionPhase, DeletionRequestRow } from "./types";

/** Injected runners; the concrete P2 adapters satisfy these structurally. */
export interface AppCleanupRunner {
  run(subjectId: string): Promise<AppCleanupResult>;
}
export interface PresenceCleanupRunner {
  run(subjectId: string, input?: PresenceDeleteInput): Promise<PresenceCleanupResult>;
}
export interface BlobCleanupRunner {
  run(subjectId: string): Promise<BlobCleanupResult>;
}

export interface DeletionClock {
  now(): Date;
}

/** Bounded exponential backoff. `attempt` is 1-based (first failure is 1). */
export const DELETION_MAX_CLEANUP_ATTEMPTS = 5;
export const DELETION_BACKOFF_BASE_MS = 60_000;
export const DELETION_BACKOFF_CAP_MS = 3_600_000;

export function computeNextRetryAt(now: Date, attempt: number): Date {
  const exponent = Math.max(0, attempt - 1);
  const raw = DELETION_BACKOFF_BASE_MS * 2 ** exponent;
  const delay = Math.min(raw, DELETION_BACKOFF_CAP_MS);
  return new Date(now.getTime() + delay);
}

/** The redacted reason codes this orchestrator writes; all are valid tokens. */
export const DELETION_REASON_CODES = {
  enterAppCleanup: "enter_app_cleanup",
  appCleanupDone: "app_cleanup_done",
  presenceCleanupDone: "presence_cleanup_done",
  blobCleanupDone: "blob_cleanup_done",
  cleanupResume: "cleanup_resume",
  cleanupRetryScheduled: "cleanup_retry_scheduled",
  escalateBlockedManual: "escalate_blocked_manual",
} as const;

/** Phases from which the orchestrator will perform cleanup work. */
const CLEANUP_ENTRY_PHASES: ReadonlySet<DeletionPhase> = new Set<DeletionPhase>([
  "auth_deleted",
  "app_cleanup_pending",
  "presence_cleanup_pending",
  "blob_cleanup_pending",
  "cleanup_retryable",
]);

export class DeletionOrderingError extends Error {
  constructor(readonly phase: DeletionPhase) {
    super(
      `deletion cleanup requested before auth was proven deleted (phase '${phase}')`,
    );
    this.name = "DeletionOrderingError";
  }
}

export interface DeletionSagaDeps {
  readonly store: DeletionCasStore;
  readonly audit: DeletionAuditSink;
  readonly clock: DeletionClock;
  readonly app: AppCleanupRunner;
  readonly presence: PresenceCleanupRunner;
  readonly blob: BlobCleanupRunner;
  /** The protected subject ref, supplied per step (never persisted by P2). */
  readonly subjectId: string;
  readonly presenceInput?: PresenceDeleteInput;
  readonly maxAttempts?: number;
}

export type DeletionStepKind =
  | "advanced"
  | "completed"
  | "retry_scheduled"
  | "escalated"
  | "waiting"
  | "noop";

export interface DeletionStepResult {
  readonly kind: DeletionStepKind;
  readonly from: DeletionPhase;
  readonly to: DeletionPhase;
  readonly applied: boolean;
  readonly attempt: number;
}

function noop(row: DeletionRequestRow): DeletionStepResult {
  return {
    kind: "noop",
    from: row.phase,
    to: row.phase,
    applied: false,
    attempt: row.attemptCount,
  };
}

/**
 * Commits one legal edge via the CAS primitive, writing one redacted audit row
 * only when this worker wins the swap. A lost race is a clean no-op (the winning
 * worker owns the audit line).
 */
async function commit(
  deps: DeletionSagaDeps,
  row: DeletionRequestRow,
  to: DeletionPhase,
  attemptCount: number,
  nextRetryAt: Date | null,
  reasonCode: string,
): Promise<boolean> {
  const result = await transitionPhase(deps.store, {
    requestId: row.id,
    expectedVersion: row.version,
    from: row.phase,
    to,
    attemptCount,
    nextRetryAt,
  });
  if (!result.applied) {
    return false;
  }
  const append: DeletionAuditAppend = {
    requestId: row.id,
    fromPhase: row.phase,
    toPhase: to,
    reasonCode,
    challengeHash: null,
    attempt: attemptCount,
  };
  await deps.audit.append(append);
  return true;
}

/**
 * A cleanup phase failed operationally: increment the attempt, then either
 * schedule a backed-off retry (drop to `cleanup_retryable`) or, once the ceiling
 * is reached, escalate to the terminal `blocked_manual`.
 */
async function handleFailure(
  deps: DeletionSagaDeps,
  row: DeletionRequestRow,
): Promise<DeletionStepResult> {
  const attempt = row.attemptCount + 1;
  const maxAttempts = deps.maxAttempts ?? DELETION_MAX_CLEANUP_ATTEMPTS;

  if (attempt >= maxAttempts) {
    const applied = await commit(
      deps,
      row,
      "blocked_manual",
      attempt,
      null,
      DELETION_REASON_CODES.escalateBlockedManual,
    );
    return {
      kind: applied ? "escalated" : "noop",
      from: row.phase,
      to: "blocked_manual",
      applied,
      attempt,
    };
  }

  const nextRetryAt = computeNextRetryAt(deps.clock.now(), attempt);
  const applied = await commit(
    deps,
    row,
    "cleanup_retryable",
    attempt,
    nextRetryAt,
    DELETION_REASON_CODES.cleanupRetryScheduled,
  );
  return {
    kind: applied ? "retry_scheduled" : "noop",
    from: row.phase,
    to: "cleanup_retryable",
    applied,
    attempt,
  };
}

/**
 * Runs the given cleanup runner, then advances to `next` on success. A
 * `DeletionNotWiredError` propagates (this lane wires nothing real); any other
 * failure routes through retry/escalation. The runner runs BEFORE the CAS, and
 * because every runner is idempotent, losing the ensuing race is harmless.
 */
async function runThenAdvance(
  deps: DeletionSagaDeps,
  row: DeletionRequestRow,
  work: () => Promise<unknown>,
  next: DeletionPhase,
  reasonCode: string,
): Promise<DeletionStepResult> {
  try {
    await work();
  } catch (error) {
    if (error instanceof DeletionNotWiredError) {
      throw error;
    }
    return handleFailure(deps, row);
  }
  const applied = await commit(
    deps,
    row,
    next,
    row.attemptCount,
    null,
    reasonCode,
  );
  const kind: DeletionStepKind = !applied
    ? "noop"
    : next === "completed"
      ? "completed"
      : "advanced";
  return { kind, from: row.phase, to: next, applied, attempt: row.attemptCount };
}

/**
 * Advance the saga by one step from its durable row. Terminal phases and phases
 * the orchestrator does not own are no-ops; pre-`auth_deleted` phases throw the
 * ordering guard.
 */
export async function advanceOnce(
  row: DeletionRequestRow,
  deps: DeletionSagaDeps,
): Promise<DeletionStepResult> {
  assertDeletionSubjectId(deps.subjectId);

  if (isTerminalPhase(row.phase)) {
    return noop(row);
  }
  if (!CLEANUP_ENTRY_PHASES.has(row.phase)) {
    throw new DeletionOrderingError(row.phase);
  }

  switch (row.phase) {
    case "auth_deleted": {
      const applied = await commit(
        deps,
        row,
        "app_cleanup_pending",
        row.attemptCount,
        null,
        DELETION_REASON_CODES.enterAppCleanup,
      );
      return {
        kind: applied ? "advanced" : "noop",
        from: row.phase,
        to: "app_cleanup_pending",
        applied,
        attempt: row.attemptCount,
      };
    }
    case "app_cleanup_pending":
      return runThenAdvance(
        deps,
        row,
        () => deps.app.run(deps.subjectId),
        "presence_cleanup_pending",
        DELETION_REASON_CODES.appCleanupDone,
      );
    case "presence_cleanup_pending":
      return runThenAdvance(
        deps,
        row,
        () => deps.presence.run(deps.subjectId, deps.presenceInput),
        "blob_cleanup_pending",
        DELETION_REASON_CODES.presenceCleanupDone,
      );
    case "blob_cleanup_pending":
      return runThenAdvance(
        deps,
        row,
        () => deps.blob.run(deps.subjectId),
        "completed",
        DELETION_REASON_CODES.blobCleanupDone,
      );
    case "cleanup_retryable": {
      // Wait out the backoff window before re-entering the chain.
      if (row.nextRetryAt && deps.clock.now().getTime() < row.nextRetryAt.getTime()) {
        return {
          kind: "waiting",
          from: row.phase,
          to: row.phase,
          applied: false,
          attempt: row.attemptCount,
        };
      }
      const applied = await commit(
        deps,
        row,
        "app_cleanup_pending",
        row.attemptCount,
        null,
        DELETION_REASON_CODES.cleanupResume,
      );
      return {
        kind: applied ? "advanced" : "noop",
        from: row.phase,
        to: "app_cleanup_pending",
        applied,
        attempt: row.attemptCount,
      };
    }
    default:
      return noop(row);
  }
}

/** Re-reads the durable row so multi-step driving resumes from committed state. */
export interface DeletionRequestReader {
  read(): Promise<DeletionRequestRow>;
}

/**
 * Drive the saga to a resting point: a terminal phase, a `waiting` backoff, an
 * escalation, or a lost race. Bounded so a stuck fixture cannot loop forever.
 */
export async function driveDeletionSaga(
  reader: DeletionRequestReader,
  deps: DeletionSagaDeps,
  maxSteps = 64,
): Promise<DeletionStepResult[]> {
  const steps: DeletionStepResult[] = [];
  for (let i = 0; i < maxSteps; i += 1) {
    const row = await reader.read();
    if (isTerminalPhase(row.phase) || !CLEANUP_ENTRY_PHASES.has(row.phase)) {
      break;
    }
    const step = await advanceOnce(row, deps);
    steps.push(step);
    if (
      step.kind === "completed" ||
      step.kind === "escalated" ||
      step.kind === "waiting" ||
      (step.kind === "noop" && !step.applied)
    ) {
      break;
    }
  }
  return steps;
}
