/**
 * ADR-021 P1 deletion-saga persistence types (single source of truth).
 *
 * This module is pure: it holds only `const` label tuples, the union types
 * derived from them, and plain data-shape interfaces. It imports nothing with a
 * runtime side effect and must never import `server-only`, so both the Drizzle
 * schema (loaded offline by drizzle-kit generate) and server-only adapter code
 * can depend on it. The tuples here are the canonical labels the contract test
 * cross-checks against the `pgEnum` in `src/db/schema/deletion.ts` and against
 * the generated migration DDL.
 */

/**
 * The eight canonical saga phases, in forward order. A request walks this path
 * on the happy route: prove control of the account (challenge), then tear down
 * the authenticated identity, then the app, presence, and blob projections,
 * then finish.
 */
export const DELETION_CANONICAL_PHASES = [
  "challenge_pending",
  "verified",
  "auth_delete_pending",
  "auth_deleted",
  "app_cleanup_pending",
  "presence_cleanup_pending",
  "blob_cleanup_pending",
  "completed",
] as const;

/**
 * The four failure phases. `verification_expired` and `blocked_manual` are
 * terminal; the two `*_retryable` phases are transient holding states a worker
 * leaves by re-entering the phase they came from once `next_retry_at` elapses.
 */
export const DELETION_FAILURE_PHASES = [
  "verification_expired",
  "auth_delete_retryable",
  "cleanup_retryable",
  "blocked_manual",
] as const;

/**
 * All twelve phase labels, canonical first, in the exact order the `pgEnum` and
 * the generated `CREATE TYPE` must declare them.
 */
export const DELETION_PHASES = [
  ...DELETION_CANONICAL_PHASES,
  ...DELETION_FAILURE_PHASES,
] as const;

/**
 * Coarse terminal status carried alongside the fine-grained phase. `pending` is
 * the only non-terminal value; the saga sets one of the other three exactly
 * once, when it reaches a terminal phase.
 */
export const DELETION_OUTCOMES = [
  "pending",
  "completed",
  "failed",
  "expired",
] as const;

/** The two administrative deletion targets. Preview and Production are separate. */
export const DELETION_ENVIRONMENTS = ["preview", "production"] as const;

export type DeletionCanonicalPhase = (typeof DELETION_CANONICAL_PHASES)[number];
export type DeletionFailurePhase = (typeof DELETION_FAILURE_PHASES)[number];
export type DeletionPhase = (typeof DELETION_PHASES)[number];
export type DeletionOutcome = (typeof DELETION_OUTCOMES)[number];
export type DeletionEnvironment = (typeof DELETION_ENVIRONMENTS)[number];

/**
 * The exact administrative target the adapter must prove before any use. Every
 * field is required: a `null`/`undefined` descriptor or a missing field is an
 * ambiguous or incapable response and must fail closed, never match.
 */
export interface TargetDescriptor {
  readonly environment: DeletionEnvironment;
  readonly projectId: string;
  readonly branchId: string;
  readonly branchName: string;
  readonly database: string;
  readonly role: string;
}

/** The keys that make up a full, unambiguous target descriptor. */
export const TARGET_DESCRIPTOR_KEYS = [
  "environment",
  "projectId",
  "branchId",
  "branchName",
  "database",
  "role",
] as const satisfies readonly (keyof TargetDescriptor)[];

/**
 * A resolved target as observed from the live administrative connection. It may
 * be partial or absent; the guard is what proves it against a `TargetDescriptor`.
 */
export type ResolvedTarget = Partial<TargetDescriptor> | null | undefined;

/**
 * The persisted `deletion_requests` row shape. `version` and `updatedAt` are the
 * compare-and-set guards; `idempotencyKey` is globally unique.
 */
export interface DeletionRequestRow {
  readonly id: string;
  readonly idempotencyKey: string;
  readonly phase: DeletionPhase;
  readonly attemptCount: number;
  readonly nextRetryAt: Date | null;
  readonly outcome: DeletionOutcome;
  readonly version: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

/**
 * The persisted `deletion_audit` row shape. It is deliberately REDACTED: there
 * is no field for email, OTP, session token, raw challenge, coordinates, Blob
 * URL or key, raw provider response, stack trace, or payload. A challenge is
 * recorded only as its hex hash.
 */
export interface DeletionAuditRow {
  readonly id: string;
  readonly requestId: string;
  readonly fromPhase: DeletionPhase | null;
  readonly toPhase: DeletionPhase;
  readonly reasonCode: string;
  readonly challengeHash: string | null;
  readonly attempt: number;
  readonly createdAt: Date;
}
