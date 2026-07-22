import { sql } from "drizzle-orm";
import {
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

import { contributionModerationDecisions, observations } from "./index";

/**
 * ADR-028 evidence-media persistence (desired state).
 *
 * The enum and table below are declared here so drizzle-kit generate emits their
 * `CREATE TYPE`/`CREATE TABLE` DDL into the numbered 0019 migration. Roles,
 * grants, and row-level security are NOT declared here: they live in
 * `src/db/pillars/90-contribution-evidence-media.sql` and are merged into the
 * same migration after this generated DDL, exactly as 0018 appended
 * `90-deletion-saga.sql`. This module owns no boundary logic; the deterministic
 * key layout, the ingest sanitizer, the private Blob adapter, and the fail-
 * closed admission live under `src/lib/evidence-media`.
 *
 * The enum label tuple is kept byte-identical to
 * `src/lib/evidence-media/types.ts` (`EVIDENCE_MEDIA_STATES`); the P1 contract
 * test cross-checks the pgEnum `enumValues`, that lib constant, and the
 * generated DDL so they cannot drift.
 *
 * The table is REDACTED by construction: it carries a content hash, byte size,
 * MIME, and extension only. There is no column for EXIF, GPS/coordinates,
 * camera identity, metadata timestamp, thumbnail, filename, or raw payload. The
 * P1 contract test asserts none of those columns exist.
 */

/**
 * The three media lifecycle states, in declaration order. `pending` is the sole
 * admitted, non-displayable state; a row NEVER leaves `pending` without an
 * authorized moderation decision. This declaration order is the order the
 * generated `CREATE TYPE "public"."evidence_media_state"` must preserve.
 */
export const evidenceMediaState = pgEnum("evidence_media_state", [
  "pending",
  "approved",
  "rejected",
]);

/**
 * One row per attached media object. `observation_id` is the pending report
 * (`reportId`) the object binds to; `media_id` is the object id that lands in
 * the deterministic Blob key `contribution-evidence/{reportId}/{mediaId}.{ext}`.
 * `decision_id` links to the authorized moderation decision that resolved the
 * media out of `pending`; a `pending` row has none. `sanitized_at` records that
 * EXIF/GPS/metadata were stripped before the object was retained.
 */
export const contributionEvidenceMedia = pgTable(
  "contribution_evidence_media",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    observationId: uuid("observation_id")
      .notNull()
      .references(() => observations.id, { onDelete: "no action" }),
    mediaId: uuid("media_id").notNull().defaultRandom(),
    ext: varchar("ext", { length: 8 }).notNull(),
    contentType: varchar("content_type", { length: 100 }).notNull(),
    byteSize: integer("byte_size").notNull(),
    contentSha256: varchar("content_sha256", { length: 64 }).notNull(),
    state: evidenceMediaState("state").notNull().default("pending"),
    decisionId: uuid("decision_id").references(
      () => contributionModerationDecisions.id,
      { onDelete: "no action" },
    ),
    sanitizedAt: timestamp("sanitized_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("contribution_evidence_media_object_key").on(t.observationId, t.mediaId),
    index("contribution_evidence_media_report_state_idx").on(t.observationId, t.state),
    index("contribution_evidence_media_decision_idx").on(t.decisionId),
    check(
      "contribution_evidence_media_ext_check",
      sql`${t.ext} in ('jpg', 'png', 'webp')`,
    ),
    check(
      "contribution_evidence_media_content_type_check",
      sql`${t.contentType} in ('image/jpeg', 'image/png', 'image/webp')`,
    ),
    check(
      "contribution_evidence_media_byte_size_check",
      sql`${t.byteSize} > 0 and ${t.byteSize} <= 8388608`,
    ),
    check(
      "contribution_evidence_media_sha256_check",
      sql`${t.contentSha256} ~ '^[0-9a-f]{64}$'`,
    ),
    // Fail closed: a row is only ever displayable through an authorized decision.
    // `pending` carries no decision; `approved`/`rejected` must cite one.
    check(
      "contribution_evidence_media_decision_shape_check",
      sql`(${t.state} = 'pending' and ${t.decisionId} is null)
        or (${t.state} in ('approved', 'rejected') and ${t.decisionId} is not null)`,
    ),
    check(
      "contribution_evidence_media_expiry_check",
      sql`${t.expiresAt} is null or ${t.expiresAt} > ${t.createdAt}`,
    ),
  ],
);
