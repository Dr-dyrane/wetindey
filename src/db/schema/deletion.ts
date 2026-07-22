import { sql } from "drizzle-orm";
import {
  bigint,
  check,
  index,
  integer,
  pgEnum,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

/**
 * ADR-021 P1 deletion-saga persistence (desired state).
 *
 * The two tables and two enums below are declared here so drizzle-kit generate
 * emits their `CREATE TYPE`/`CREATE TABLE` DDL into the numbered 0018 migration.
 * Roles, grants, and row-level security are NOT declared here: they live in
 * `src/db/pillars/90-deletion-saga.sql` and are merged into the same migration
 * after this generated DDL, exactly as 0013 appended its hand SQL. This module
 * owns no boundary logic; the compare-and-set phase primitive, fail-closed
 * target guards, and the inert admin-auth adapter live under `src/lib/deletion`.
 *
 * The enum label tuples are kept byte-identical to
 * `src/lib/deletion/types.ts`; the P1 contract test cross-checks the pgEnum
 * `enumValues`, that lib constant, and the generated DDL so they cannot drift.
 */

/**
 * The twelve deletion phases: the eight canonical saga phases in forward order,
 * followed by the four failure phases. This declaration order is the order the
 * generated `CREATE TYPE "public"."deletion_phase"` must preserve.
 */
export const deletionPhase = pgEnum("deletion_phase", [
  // Canonical (8), in saga order.
  "challenge_pending",
  "verified",
  "auth_delete_pending",
  "auth_deleted",
  "app_cleanup_pending",
  "presence_cleanup_pending",
  "blob_cleanup_pending",
  "completed",
  // Failure (4).
  "verification_expired",
  "auth_delete_retryable",
  "cleanup_retryable",
  "blocked_manual",
]);

/**
 * Coarse terminal status. `pending` is the sole non-terminal value; the saga
 * writes one of the other three exactly once, when it reaches a terminal phase.
 */
export const deletionOutcome = pgEnum("deletion_outcome", [
  "pending",
  "completed",
  "failed",
  "expired",
]);

/**
 * One row per deletion request. `idempotency_key` is globally unique so a
 * retried submission re-attaches to the existing saga rather than starting a
 * second one. `version` and `updated_at` are the compare-and-set guards: a
 * worker advances a phase only with `WHERE id = ? AND version = ?`, so two
 * workers can never double-advance the same request.
 */
export const deletionRequests = pgTable(
  "deletion_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    idempotencyKey: varchar("idempotency_key", { length: 128 }).notNull(),
    phase: deletionPhase("phase").notNull().default("challenge_pending"),
    attemptCount: integer("attempt_count").notNull().default(0),
    nextRetryAt: timestamp("next_retry_at", { withTimezone: true }),
    outcome: deletionOutcome("outcome").notNull().default("pending"),
    version: bigint("version", { mode: "number" }).notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("deletion_requests_idempotency_key").on(t.idempotencyKey),
    index("deletion_requests_phase_retry_idx").on(t.phase, t.nextRetryAt),
    check("deletion_requests_attempt_check", sql`${t.attemptCount} >= 0`),
    check("deletion_requests_version_check", sql`${t.version} > 0`),
    check(
      "deletion_requests_idempotency_key_check",
      sql`char_length(${t.idempotencyKey}) >= 8`,
    ),
  ],
);

/**
 * Append-only audit of phase transitions. REDACTED by construction: there is no
 * column for email, OTP, session token, raw challenge, coordinates, Blob URL or
 * key, raw provider response, stack trace, or payload. A challenge is recorded
 * only as its hex hash. The P1 contract test asserts none of those columns
 * exist.
 */
export const deletionAudit = pgTable(
  "deletion_audit",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    requestId: uuid("request_id")
      .notNull()
      .references(() => deletionRequests.id, { onDelete: "no action" }),
    fromPhase: deletionPhase("from_phase"),
    toPhase: deletionPhase("to_phase").notNull(),
    reasonCode: varchar("reason_code", { length: 64 }).notNull(),
    challengeHash: varchar("challenge_hash", { length: 64 }),
    attempt: integer("attempt").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("deletion_audit_request_idx").on(t.requestId, t.createdAt),
    check("deletion_audit_attempt_check", sql`${t.attempt} >= 0`),
    check(
      "deletion_audit_reason_check",
      sql`${t.reasonCode} ~ '^[a-z0-9_]{2,64}$'`,
    ),
    check(
      "deletion_audit_challenge_hash_check",
      sql`${t.challengeHash} is null or ${t.challengeHash} ~ '^[0-9a-f]{64}$'`,
    ),
  ],
);
