import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  check,
  customType,
  index,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

const presenceGeographyPoint = customType<{ data: string }>({
  dataType() {
    return "geography";
  },
});

const presenceGeographyPolygon = customType<{ data: string }>({
  dataType() {
    return "geography";
  },
});

export const presenceRateDimension = pgEnum("presence_rate_dimension", [
  "account",
  "session",
  "device",
  "network",
]);

export const presenceRateOperation = pgEnum("presence_rate_operation", [
  "activation",
  "snapshot",
  "disclosure",
  "wave",
  "report",
]);

export const presenceReportKind = pgEnum("presence_report_kind", [
  "safety_concern",
  "unwanted_interaction",
  "suspected_location_misuse",
  "other",
]);

export const presenceReportResolution = pgEnum("presence_report_resolution", [
  "open",
  "closed",
]);

export const presenceActivationStatus = pgEnum("presence_activation_status", [
  "accepted",
  "rejected",
  "expired",
]);

export const presenceCapabilityPurpose = pgEnum("presence_capability_purpose", [
  "wave",
  "block",
  "report",
]);

export const presenceCapabilityState = pgEnum("presence_capability_state", [
  "active",
  "revoked",
  "consumed",
]);

/**
 * One fail-closed control row for the private presence boundary.
 *
 * The migration installs id=1 with operations_allowed=false, an empty allowlist,
 * no geography, and no policy-owned retention values. The enable RPC refuses to
 * turn the boundary on until all of those values exist. Conservative rate
 * ceilings are database defaults, not pilot authorization.
 */
export const presenceControl = pgTable(
  "presence_control",
  {
    id: integer("id").primaryKey().default(1),
    operationsAllowed: boolean("operations_allowed").notNull().default(false),
    runtimeAllowed: boolean("runtime_allowed").notNull().default(false),
    generation: bigint("generation", { mode: "number" }).notNull().default(1),
    allowlistAccountA: uuid("allowlist_account_a"),
    allowlistAccountB: uuid("allowlist_account_b"),
    pilotBoundary: presenceGeographyPolygon("pilot_boundary"),
    waveRetentionSeconds: integer("wave_retention_seconds"),
    reportRetentionSeconds: integer("report_retention_seconds"),
    safetyResponderAccountId: uuid("safety_responder_account_id"),
    safetyBackupAccountId: uuid("safety_backup_account_id"),
    activationLimit15m: integer("activation_limit_15m").notNull().default(3),
    activationLimitDay: integer("activation_limit_day").notNull().default(8),
    snapshotLimitMinute: integer("snapshot_limit_minute").notNull().default(6),
    snapshotLimit15m: integer("snapshot_limit_15m").notNull().default(60),
    disclosureLimit15m: integer("disclosure_limit_15m").notNull().default(50),
    waveLimitMinute: integer("wave_limit_minute").notNull().default(2),
    waveLimit15m: integer("wave_limit_15m").notNull().default(10),
    waveLimitDay: integer("wave_limit_day").notNull().default(30),
    reportLimit15m: integer("report_limit_15m").notNull().default(3),
    reportLimitDay: integer("report_limit_day").notNull().default(10),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check("presence_control_singleton_check", sql`${t.id} = 1`),
    check("presence_control_generation_check", sql`${t.generation} > 0`),
    check(
      "presence_control_boundary_check",
      sql`${t.pilotBoundary} is null
        or (GeometryType(${t.pilotBoundary}::geometry) = 'POLYGON'
          and ST_SRID(${t.pilotBoundary}::geometry) = 4326
          and ST_IsValid(${t.pilotBoundary}::geometry))`,
    ),
    check(
      "presence_control_allowlist_check",
      sql`(${t.allowlistAccountA} is null and ${t.allowlistAccountB} is null)
        or (${t.allowlistAccountA} is not null and ${t.allowlistAccountB} is not null
          and ${t.allowlistAccountA} <> ${t.allowlistAccountB})`,
    ),
    check(
      "presence_control_retention_check",
      sql`(${t.waveRetentionSeconds} is null or ${t.waveRetentionSeconds} between 1 and 900)
        and (${t.reportRetentionSeconds} is null or ${t.reportRetentionSeconds} between 86400 and 31536000)`,
    ),
    check(
      "presence_control_responder_check",
      sql`(${t.safetyResponderAccountId} is null and ${t.safetyBackupAccountId} is null)
        or (${t.safetyResponderAccountId} is not null and ${t.safetyBackupAccountId} is not null
          and ${t.safetyResponderAccountId} <> ${t.safetyBackupAccountId})`,
    ),
    check(
      "presence_control_budgets_check",
      sql`${t.activationLimit15m} > 0 and ${t.activationLimitDay} >= ${t.activationLimit15m}
        and ${t.snapshotLimitMinute} > 0 and ${t.snapshotLimit15m} >= ${t.snapshotLimitMinute}
        and ${t.disclosureLimit15m} between 1 and 50
        and ${t.waveLimitMinute} > 0 and ${t.waveLimit15m} >= ${t.waveLimitMinute}
        and ${t.waveLimitDay} >= ${t.waveLimit15m}
        and ${t.reportLimit15m} > 0 and ${t.reportLimitDay} >= ${t.reportLimit15m}`,
    ),
  ],
);

export const presencePreferences = pgTable(
  "presence_preferences",
  {
    accountId: uuid("account_id").primaryKey(),
    presenceOptedIn: boolean("presence_opted_in").notNull().default(false),
    nameConsented: boolean("name_consented").notNull().default(false),
    avatarConsented: boolean("avatar_consented").notNull().default(false),
    displayName: varchar("display_name", { length: 80 }),
    avatarProjectionEpoch: bigint("avatar_projection_epoch", { mode: "number" })
      .notNull()
      .default(1),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check(
      "presence_preferences_name_check",
      sql`(${t.nameConsented} and ${t.displayName} is not null)
        or (not ${t.nameConsented} and ${t.displayName} is null)`,
    ),
    check("presence_preferences_epoch_check", sql`${t.avatarProjectionEpoch} > 0`),
  ],
);

export const presenceLeases = pgTable(
  "presence_leases",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    accountId: uuid("account_id").notNull(),
    cellX: integer("cell_x").notNull(),
    cellY: integer("cell_y").notNull(),
    centroid: presenceGeographyPoint("centroid").notNull(),
    controlGeneration: bigint("control_generation", { mode: "number" }).notNull(),
    issuedAt: timestamp("issued_at", { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("presence_leases_account_key").on(t.accountId),
    index("presence_leases_centroid_gist_idx").using("gist", t.centroid),
    index("presence_leases_expiry_idx").on(t.expiresAt),
    check(
      "presence_leases_expiry_check",
      sql`${t.expiresAt} > ${t.issuedAt}
        and ${t.expiresAt} <= ${t.issuedAt} + interval '15 minutes'
        and (${t.revokedAt} is null or ${t.revokedAt} >= ${t.issuedAt})`,
    ),
    check(
      "presence_leases_centroid_check",
      sql`GeometryType(${t.centroid}::geometry) = 'POINT'
        and ST_SRID(${t.centroid}::geometry) = 4326`,
    ),
  ],
);

export const presenceActivationRequests = pgTable(
  "presence_activation_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    accountId: uuid("account_id").notNull(),
    requestDigest: varchar("request_digest", { length: 64 }).notNull(),
    cellX: integer("cell_x").notNull(),
    cellY: integer("cell_y").notNull(),
    status: presenceActivationStatus("status").notNull().default("accepted"),
    leaseId: uuid("lease_id").references(() => presenceLeases.id, { onDelete: "set null" }),
    failureCode: varchar("failure_code", { length: 64 }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (t) => [
    uniqueIndex("presence_activation_requests_key").on(t.accountId, t.requestDigest),
    index("presence_activation_requests_expiry_idx").on(t.expiresAt),
    check("presence_activation_requests_digest_check", sql`${t.requestDigest} ~ '^[0-9a-f]{64}$'`),
    check(
      "presence_activation_requests_status_check",
      sql`(${t.status} = 'accepted' and ${t.leaseId} is not null and ${t.failureCode} is null)
        or (${t.status} in ('rejected', 'expired') and ${t.failureCode} is not null)`,
    ),
    check("presence_activation_requests_expiry_check", sql`${t.expiresAt} > ${t.createdAt}`),
  ],
);

export const presenceCapabilities = pgTable(
  "presence_capabilities",
  {
    tokenDigest: varchar("token_digest", { length: 64 }).primaryKey(),
    viewerAccountId: uuid("viewer_account_id").notNull(),
    subjectAccountId: uuid("subject_account_id").notNull(),
    purpose: presenceCapabilityPurpose("purpose").notNull(),
    state: presenceCapabilityState("state").notNull().default("active"),
    snapshotDigest: varchar("snapshot_digest", { length: 64 }).notNull(),
    avatarProjectionDigest: varchar("avatar_projection_digest", { length: 64 }).notNull(),
    viewerLeaseId: uuid("viewer_lease_id")
      .notNull()
      .references(() => presenceLeases.id, { onDelete: "cascade" }),
    subjectLeaseId: uuid("subject_lease_id")
      .notNull()
      .references(() => presenceLeases.id, { onDelete: "cascade" }),
    issuedAt: timestamp("issued_at", { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    revocationReason: varchar("revocation_reason", { length: 64 }),
    consumedAt: timestamp("consumed_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("presence_capabilities_snapshot_key").on(
      t.viewerAccountId,
      t.snapshotDigest,
      t.subjectAccountId,
      t.purpose,
    ),
    index("presence_capabilities_expiry_idx").on(t.expiresAt),
    index("presence_capabilities_pair_idx").on(t.viewerAccountId, t.subjectAccountId),
    check("presence_capabilities_token_check", sql`${t.tokenDigest} ~ '^[0-9a-f]{64}$'`),
    check("presence_capabilities_snapshot_check", sql`${t.snapshotDigest} ~ '^[0-9a-f]{64}$'`),
    check(
      "presence_capabilities_avatar_projection_check",
      sql`${t.avatarProjectionDigest} ~ '^[0-9a-f]{64}$'`,
    ),
    check(
      "presence_capabilities_state_check",
      sql`(${t.state} = 'active' and ${t.revokedAt} is null)
        or (${t.state} in ('revoked', 'consumed') and ${t.revokedAt} is not null)`,
    ),
    check(
      "presence_capabilities_expiry_check",
      sql`${t.expiresAt} > ${t.issuedAt} and ${t.expiresAt} <= ${t.issuedAt} + interval '15 minutes'`,
    ),
    check(
      "presence_capabilities_pair_check",
      sql`${t.viewerAccountId} <> ${t.subjectAccountId} and ${t.viewerLeaseId} <> ${t.subjectLeaseId}`,
    ),
  ],
);

export const presenceBlocks = pgTable(
  "presence_blocks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    blockerAccountId: uuid("blocker_account_id").notNull(),
    blockedAccountId: uuid("blocked_account_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("presence_blocks_pair_key").on(t.blockerAccountId, t.blockedAccountId),
    index("presence_blocks_reverse_idx").on(t.blockedAccountId, t.blockerAccountId),
    check("presence_blocks_not_self_check", sql`${t.blockerAccountId} <> ${t.blockedAccountId}`),
  ],
);

export const presenceWaves = pgTable(
  "presence_waves",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    senderAccountId: uuid("sender_account_id").notNull(),
    recipientAccountId: uuid("recipient_account_id").notNull(),
    senderLeaseId: uuid("sender_lease_id")
      .notNull()
      .references(() => presenceLeases.id, { onDelete: "cascade" }),
    recipientLeaseId: uuid("recipient_lease_id")
      .notNull()
      .references(() => presenceLeases.id, { onDelete: "cascade" }),
    idempotencyDigest: varchar("idempotency_digest", { length: 64 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    deliveredAt: timestamp("delivered_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("presence_waves_sender_idempotency_key").on(
      t.senderAccountId,
      t.idempotencyDigest,
    ),
    index("presence_waves_recipient_expiry_idx").on(t.recipientAccountId, t.expiresAt),
    check(
      "presence_waves_not_self_check",
      sql`${t.senderAccountId} <> ${t.recipientAccountId}`,
    ),
    check(
      "presence_waves_digest_check",
      sql`${t.idempotencyDigest} ~ '^[0-9a-f]{64}$'`,
    ),
    check(
      "presence_waves_expiry_check",
      sql`${t.expiresAt} > ${t.createdAt}
        and (${t.deliveredAt} is null or ${t.deliveredAt} >= ${t.createdAt})`,
    ),
  ],
);

export const presenceReports = pgTable(
  "presence_reports",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    reporterAccountId: uuid("reporter_account_id").notNull(),
    subjectAccountId: uuid("subject_account_id").notNull(),
    idempotencyDigest: varchar("idempotency_digest", { length: 64 }).notNull(),
    kind: presenceReportKind("kind").notNull(),
    details: text("details"),
    resolution: presenceReportResolution("resolution").notNull().default("open"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    purgeAt: timestamp("purge_at", { withTimezone: true }).notNull(),
  },
  (t) => [
    index("presence_reports_open_pair_idx").on(
      t.reporterAccountId,
      t.subjectAccountId,
      t.resolution,
    ),
    index("presence_reports_purge_idx").on(t.purgeAt),
    uniqueIndex("presence_reports_idempotency_key").on(
      t.reporterAccountId,
      t.idempotencyDigest,
    ),
    check(
      "presence_reports_not_self_check",
      sql`${t.reporterAccountId} <> ${t.subjectAccountId}`,
    ),
    check(
      "presence_reports_details_check",
      sql`${t.details} is null or length(${t.details}) between 1 and 1000`,
    ),
    check("presence_reports_digest_check", sql`${t.idempotencyDigest} ~ '^[0-9a-f]{64}$'`),
    check(
      "presence_reports_resolution_check",
      sql`(${t.resolution} = 'open' and ${t.resolvedAt} is null)
        or (${t.resolution} = 'closed' and ${t.resolvedAt} is not null and ${t.resolvedAt} >= ${t.createdAt})`,
    ),
    check("presence_reports_purge_check", sql`${t.purgeAt} > ${t.createdAt}`),
  ],
);

export const presenceRateBuckets = pgTable(
  "presence_rate_buckets",
  {
    dimension: presenceRateDimension("dimension").notNull(),
    operation: presenceRateOperation("operation").notNull(),
    keyDigest: varchar("key_digest", { length: 64 }).notNull(),
    windowStartedAt: timestamp("window_started_at", { withTimezone: true }).notNull(),
    windowSeconds: integer("window_seconds").notNull(),
    requestCount: integer("request_count").notNull().default(0),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (t) => [
    primaryKey({
      name: "presence_rate_buckets_pk",
      columns: [t.dimension, t.operation, t.keyDigest, t.windowStartedAt, t.windowSeconds],
    }),
    index("presence_rate_buckets_expiry_idx").on(t.expiresAt),
    check("presence_rate_buckets_digest_check", sql`${t.keyDigest} ~ '^[0-9a-f]{64}$'`),
    check(
      "presence_rate_buckets_window_check",
      sql`${t.windowSeconds} between 1 and 86400
        and ${t.requestCount} >= 0
        and ${t.expiresAt} >= ${t.windowStartedAt} + (${t.windowSeconds} * interval '1 second')`,
    ),
  ],
);
