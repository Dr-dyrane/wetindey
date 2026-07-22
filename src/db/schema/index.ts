import { sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  bigint,
  boolean,
  check,
  customType,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

export const observationProvenance = pgEnum("observation_provenance", [
  "synthetic",
  "observed",
  "partner",
  "reference",
  "inferred"
]);

export const contributionOperation = pgEnum("contribution_operation", [
  "report_price",
  "visit_confirmation",
  "correction",
]);

export const contributionRateDimension = pgEnum("contribution_rate_dimension", [
  "subject",
  "network",
]);

export const contributionDecision = pgEnum("contribution_decision", [
  "approve",
  "reject",
  "reverse",
]);

export const contributionAssignmentStatus = pgEnum("contribution_assignment_status", [
  "active",
  "suspended",
  "revoked",
]);

export const contributionProjectionState = pgEnum("contribution_projection_state", [
  "available",
  "unavailable",
  "conflict",
]);

export const contributionAuditAction = pgEnum("contribution_audit_action", [
  "rate_allowed",
  "rate_denied",
  "admission",
  "idempotency_conflict",
  "moderation_approved",
  "moderation_rejected",
  "moderation_reversed",
  "projection_updated",
  "assignment_updated",
  "control_updated",
]);

/**
 * Decode a PostGIS POINT from hex-encoded EWKB.
 *
 * This is what `node-postgres` actually hands back for a `geography` column ,
 * e.g. "0101000020E6100000FDA4DAA7E3310A402BF697DD93E71940", NOT the WKT
 * "POINT(3.37 6.51)" you might expect. PostGIS only emits WKT if you ask for it
 * explicitly via ST_AsText().
 *
 * Layout (little-endian, the only form Postgres emits over the wire):
 *   byte  0      endianness   01 = little
 *   bytes 1-4    type         01000020 = Point, with the SRID flag set
 *   bytes 5-8    SRID         E6100000 = 4326
 *   bytes 9-16   X (lng)      IEEE-754 double
 *   bytes 17-24  Y (lat)      IEEE-754 double
 */
function decodeEwkbPoint(hex: string): { lng: number; lat: number } | null {
  // 21 bytes minimum: 1 endian + 4 type + 4 srid + 8 x + 8 y = 25 bytes = 50 hex chars
  if (!/^[0-9A-Fa-f]+$/.test(hex) || hex.length < 50) return null;

  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(hex.substr(i * 2, 2), 16);

  const view = new DataView(bytes.buffer);
  const little = bytes[0] === 1;
  const type = view.getUint32(1, little);
  // Low 16 bits carry the geometry type; 1 = Point. 0x20000000 flags an SRID.
  if ((type & 0xffff) !== 1) return null;
  const hasSrid = (type & 0x20000000) !== 0;
  const offset = hasSrid ? 9 : 5;

  const lng = view.getFloat64(offset, little);
  const lat = view.getFloat64(offset + 8, little);
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null;
  return { lng, lat };
}

// Custom PostGIS Geography Type mapping for Drizzle
export const geographyPoint = customType<{
  data: { lng: number; lat: number };
  driverData: string;
}>({
  dataType() {
    return "geography";
  },
  toDriver(value) {
    return `POINT(${value.lng} ${value.lat})`;
  },
  fromDriver(value) {
    // The wire format. This is the path that actually runs.
    const ewkb = decodeEwkbPoint(value);
    if (ewkb) return ewkb;

    // Also accept WKT, for queries that select ST_AsText() explicitly.
    const wkt = value.match(/POINT\s*\(\s*(-?[\d.eE+]+)\s+(-?[\d.eE+]+)\s*\)/i);
    if (wkt) return { lng: parseFloat(wkt[1]), lat: parseFloat(wkt[2]) };

    /**
     * Fail loudly. The previous version returned { lng: 0, lat: 0 } here, and
     * because the WKT regex never matched the EWKB the driver really sends,
     * EVERY place in the app silently became (0,0), a point in the Gulf of
     * Guinea. Markers stacked in the ocean, distances were nonsense, and
     * selecting an item flew the map out to sea, which read as "the map
     * broke". A silent wrong answer hid that for the life of the project; an
     * exception would have surfaced it on the first query.
     */
    throw new Error(
      `geographyPoint: could not decode location from driver value ${JSON.stringify(value).slice(0, 60)}`
    );
  }
});

// 1. Areas Table (Pilot bounding zones e.g., Yaba, Lagos)
export const areas = pgTable("areas", {
  id: uuid("id").defaultRandom().primaryKey(),
  slug: varchar("slug", { length: 255 }).notNull().unique(),
  name: varchar("name", { length: 255 }).notNull(),
  type: varchar("type", { length: 100 }).notNull(), // 'neighborhood', 'lga', etc.
  parentAreaId: uuid("parent_area_id"),
  center: geographyPoint("center").notNull(),
  coverageStatus: varchar("coverage_status", { length: 50 }).default("inactive").notNull(), // 'active', 'inactive'
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
}, (t) => [
  /**
   * GIST on a geography column is what makes ST_DWithin an index scan instead
   * of a seq scan. Forward-looking at 9 rows, the planner will ignore it until
   * `areas` grows past the pilot, but it is the standard companion to any
   * geography column and costs nothing to carry.
   *
   * Note it does NOT accelerate `ORDER BY ST_Distance(center, ...)` at
   * actions.ts:1029. Only the `<->` kNN operator uses GIST for ordering.
   */
  index("areas_center_gist_idx").using("gist", t.center)
]);

// 2. Places Table (Markets, stalls, kiosks, shops)
export const places = pgTable("places", {
  id: uuid("id").defaultRandom().primaryKey(),
  slug: varchar("slug", { length: 255 }).notNull().unique(),
  name: varchar("name", { length: 255 }).notNull(),
  placeType: varchar("place_type", { length: 100 }).notNull(), // 'open_market', 'supermarket', 'kiosk'
  areaId: uuid("area_id").references(() => areas.id).notNull(),
  location: geographyPoint("location").notNull(),
  address: text("address"),
  openingInformation: text("opening_information"),
  verificationStatus: varchar("verification_status", { length: 50 }).default("unverified").notNull(),
  contactVisibility: varchar("contact_visibility", { length: 50 }).default("private").notNull(),
  /**
   * How a trader has agreed to be reached, and at what address on that channel.
   *
   * `getPlaceContactPolicy` (actions.ts:1082) already reads `contactVisibility`
   * and already documents why it cannot work: ":1066-1067, there is also no
   * channel column, no phone, no handle, so even an explicit 'public' does
   * not yield something to dial". The policy function is not missing logic; it
   * is missing a column. This is that column.
   *
   * Both are nullable with no default, and NULL is meaningful: "this trader has
   * published no channel". That is exactly what the app answers today, so
   * adding these changes no current answer, an existing row keeps behaving as
   * it does now. The pair travels together: a value without a kind is not
   * dialable, and a kind without a value is not a contact.
   *
   * This is PII belonging to a real trader. `contactVisibility` remains the
   * gate; a reader must check it before exposing `contactChannelValue`. The
   * column being non-null is consent to store, never consent to publish.
   */
  contactChannelKind: varchar("contact_channel_kind", { length: 50 }), // 'phone', 'whatsapp', 'sms'
  contactChannelValue: varchar("contact_channel_value", { length: 255 }), // E.164 for phone/whatsapp
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
}, (t) => [
  /**
   * The only spatial index the live code can actually use, and only for the two
   * `ST_DWithin(location, ...)` geography predicates, getPlacesNear
   * (actions.ts:977) and getCoverageForPoint (actions.ts:1034).
   *
   * It deliberately does NOT help getItemNarrowingOptions (actions.ts:729) or
   * getOffersNarrowed (actions.ts:790), which filter with
   * `ST_DistanceSphere(location::geometry, origin) <= radius`. That is a
   * function result compared to a constant, not an indexable operator, and the
   * ::geometry cast leaves this geography index behind regardless. Those two
   * stay seq scans until the predicate becomes ST_DWithin. See `integration`.
   */
  index("places_location_gist_idx").using("gist", t.location),
  // FK join, both live-ish callers: actions.ts:931 and :1026 leftJoin on area_id.
  index("places_area_id_idx").on(t.areaId)
]);

// 3. Items Table (Canonical food concepts e.g., Rice, Beans)
export const items = pgTable("items", {
  id: uuid("id").defaultRandom().primaryKey(),
  slug: varchar("slug", { length: 255 }).notNull().unique(),
  canonicalName: varchar("canonical_name", { length: 255 }).notNull(),
  description: text("description"),
  // Remotely hosted product photo. Nullable: an item is valid without one and
  // the UI falls back to a generated monogram tile.
  imageUrl: text("image_url"),
  // Most sources are CC BY / CC BY-SA, which oblige us to credit the author and
  // name the licence wherever the photo is shown. Store both alongside the URL
  // so a credit can never drift away from the image it belongs to.
  imageAttribution: text("image_attribution"),
  imageLicense: varchar("image_license", { length: 64 }),
  imageSourceUrl: text("image_source_url"),
  category: varchar("category", { length: 100 }).default("food").notNull(),
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
}, (t) => [
  index("items_category_idx").on(t.category)
]);

// 4. Item Aliases (Local variations or synonyms e.g., 'Ewa', 'Shinkafa')
export const itemAliases = pgTable("item_aliases", {
  id: uuid("id").defaultRandom().primaryKey(),
  itemId: uuid("item_id").references(() => items.id).notNull(),
  alias: varchar("alias", { length: 255 }).notNull(),
  locale: varchar("locale", { length: 50 }).default("en").notNull(),
  normalizedAlias: varchar("normalized_alias", { length: 255 }).notNull(),
  weight: integer("weight").default(1).notNull() // ranking priority weights
}, (t) => [
  // searchFoodItems leftJoins aliases on item_id (actions.ts:32).
  index("item_aliases_item_id_idx").on(t.itemId)
  // Deliberately no index for the `ilike(alias, '%q%')` at actions.ts:39. A
  // leading wildcard cannot use a btree; it needs GIN + pg_trgm, and pg_trgm is
  // NOT installed on this database (verified: pg_extension holds only postgis
  // and plpgsql). Installing an extension is a privilege decision, not a schema
  // one, and at 87 aliases the planner would seq scan anyway. See `blockers`.
]);

// 5. Item Variants Table (Specific packaging or types e.g., Imported Parboiled, Local Stone-Free)
export const itemVariants = pgTable("item_variants", {
  id: uuid("id").defaultRandom().primaryKey(),
  itemId: uuid("item_id").references(() => items.id).notNull(),
  slug: varchar("slug", { length: 255 }).notNull().unique(),
  displayName: varchar("display_name", { length: 255 }).notNull(),
  attributes: jsonb("attributes"), // packaging details
  active: boolean("active").default(true).notNull()
}, (t) => [
  // eq(itemVariants.itemId, ...) is the entry point of nearly every read path:
  // actions.ts:156, :745, :793, plus the joins at :224 and :432.
  index("item_variants_item_id_idx").on(t.itemId)
]);

// 6. Units Table (Standardized packaging sizes/weights)
export const units = pgTable("units", {
  id: uuid("id").defaultRandom().primaryKey(),
  code: varchar("code", { length: 50 }).notNull().unique(), // '50kg_bag', '1kg_measure', 'paint_bucket'
  displayName: varchar("display_name", { length: 100 }).notNull(),
  dimension: varchar("dimension", { length: 50 }).notNull(), // 'mass', 'volume', 'count'
  canonicalQuantity: doublePrecision("canonical_quantity").notNull(),
  notes: text("notes")
});

/**
 * 7. Sources Table, an IDENTITY table with a category column.
 *
 * What a row means, as of this migration: one contributor of observations ,
 * an account, or the anonymous shared row for a category.
 *
 * What a row meant before it: a category, and nothing else. The table held
 * exactly three rows (seed.ts:253-256, 'Contributor', 'Public data',
 * 'Vendor'; verified against the live database), and every app contribution
 * resolved to the single shared 'Contributor' row (actions.ts:313-322). The
 * table was fixed-size; it now grows with the contributor base.
 *
 * `sourceType` is unchanged and stays non-null, it remains the category of
 * the row. `userId` is the column that makes a row an identity rather than a
 * category.
 *
 * The column ships ahead of its writer. This migration only opens the column;
 * the write path that resolves a session to a per-user row is a separate
 * change against actions.ts. Until that lands, every row carries NULL here and
 * the table answers exactly as it does today, which is what makes the
 * migration safe to apply on its own, not what makes it finished.
 *
 * This is the row `distinct_source_count` counts (actions.ts:785) and the key
 * `assessTrust` groups observation weights by (trust.ts:482-492). While every
 * row was a category, that count was a count of CATEGORIES presented as a
 * count of people: trust.ts:405 renders it as "N different people", and
 * against the live database it reads 2 for 163 offer groups and 3 for 156,
 * because the seed spread observations across all three category rows. No
 * number of real contributors moved it, and no single contributor could push
 * it above 1 through the app.
 */
export const sources = pgTable("sources", {
  id: uuid("id").defaultRandom().primaryKey(),
  sourceType: varchar("source_type", { length: 100 }).notNull(), // 'Contributor', 'Public data', 'Vendor'
  /**
   * The account this source belongs to, when it belongs to one.
   *
   * `uuid`, because that is the type of `neon_auth.user.id`.
   *
   * NULL is meaningful and permanent: "no account behind this source". It is
   * what the anonymous shared row per category carries, and what a
   * contribution arriving without a session resolves to. Anonymous
   * contribution is the product's default and ADR-003 keeps it working, an
   * unattributed row weighs less, it is never refused.
   *
   * There is deliberately NO foreign key to `neon_auth.user`. Neon manages
   * that schema and may rewrite it, and a hard FK into a managed table is a
   * liability. NDPR erasure also wants SET NULL semantics, which a loose
   * column gives without a constraint to fight: an id left dangling by a
   * deleted account degrades to "unrecognised", the same answer this app
   * gives every contributor today, rather than blocking the delete.
   */
  userId: uuid("user_id"),
  status: varchar("status", { length: 50 }).default("active").notNull(),
  reliabilityScoreInternal: integer("reliability_score_internal").default(70).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
}, (t) => [
  /**
   * For the lookup the write path will do: resolve a session to a source row
   * by `user_id` before it has a `source_id` to write onto the observation.
   * That lands on the hot path of every attributed submission. The index ships
   * with the column so the writer never has to add one under load.
   *
   * Not unique: the column is nullable, and the anonymous rows all hold NULL.
   * A UNIQUE index would permit those (Postgres treats NULLs as distinct), but
   * it would encode "one source row per user", an invariant the write path
   * owns, and one this lane cannot verify from the schema alone.
   */
  index("sources_user_id_idx").on(t.userId)
]);

/**
 * Fail-closed policy and activation boundary for ADR-019.
 *
 * Schema presence never reopens reporting. The two switches are independent so
 * pending admission may be exercised without granting moderation, and neither
 * can be activated accidentally by a migration default.
 */
export const contributionControl = pgTable(
  "contribution_control",
  {
    id: integer("id").primaryKey().default(1),
    reportingAllowed: boolean("reporting_allowed").notNull().default(false),
    moderationAllowed: boolean("moderation_allowed").notNull().default(false),
    subjectLimit15m: integer("subject_limit_15m").notNull().default(5),
    subjectLimitDay: integer("subject_limit_day").notNull().default(20),
    networkLimit15m: integer("network_limit_15m").notNull().default(30),
    networkLimitDay: integer("network_limit_day").notNull().default(100),
    unavailableMinSources: integer("unavailable_min_sources").notNull().default(2),
    projectionWindowHours: integer("projection_window_hours").notNull().default(72),
    policyVersion: varchar("policy_version", { length: 64 }).notNull().default("adr-019-v1"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check("contribution_control_singleton_check", sql`${t.id} = 1`),
    check(
      "contribution_control_limits_check",
      sql`${t.subjectLimit15m} > 0
        and ${t.subjectLimitDay} >= ${t.subjectLimit15m}
        and ${t.networkLimit15m} > 0
        and ${t.networkLimitDay} >= ${t.networkLimit15m}
        and ${t.unavailableMinSources} >= 2
        and ${t.projectionWindowHours} between 1 and 168`,
    ),
    check(
      "contribution_control_policy_check",
      sql`length(trim(${t.policyVersion})) between 1 and 64`,
    ),
  ],
);

/**
 * One durable result for one caller-minted idempotency key in one server-
 * resolved subject scope. A failed transaction leaves no row; a completed row
 * is the stable replay response.
 */
export const contributionRequests = pgTable(
  "contribution_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    operation: contributionOperation("operation").notNull(),
    idempotencyKey: uuid("idempotency_key").notNull(),
    subjectDigest: varchar("subject_digest", { length: 64 }).notNull(),
    payloadDigest: varchar("payload_digest", { length: 64 }).notNull(),
    sourceId: uuid("source_id").references(() => sources.id).notNull(),
    observationId: uuid("observation_id"),
    resultCode: varchar("result_code", { length: 32 }).notNull().default("pending_review"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("contribution_requests_subject_idempotency_key").on(
      t.operation,
      t.subjectDigest,
      t.idempotencyKey,
    ),
    uniqueIndex("contribution_requests_observation_key").on(t.observationId),
    index("contribution_requests_source_created_idx").on(t.sourceId, t.createdAt.desc()),
    check(
      "contribution_requests_digest_check",
      sql`${t.subjectDigest} ~ '^[0-9a-f]{64}$'
        and ${t.payloadDigest} ~ '^[0-9a-f]{64}$'`,
    ),
    check(
      "contribution_requests_result_check",
      sql`${t.resultCode} = 'pending_review'`,
    ),
    check(
      "contribution_requests_completion_check",
      sql`${t.completedAt} >= ${t.createdAt}`,
    ),
  ],
);

/**
 * Durable fixed-window counters. RPC-level advisory locks make inspection and
 * consumption atomic across all applicable dimensions before these rows move.
 */
export const contributionRateBuckets = pgTable(
  "contribution_rate_buckets",
  {
    operation: contributionOperation("operation").notNull(),
    dimension: contributionRateDimension("dimension").notNull(),
    keyDigest: varchar("key_digest", { length: 64 }).notNull(),
    windowStartedAt: timestamp("window_started_at", { withTimezone: true }).notNull(),
    windowSeconds: integer("window_seconds").notNull(),
    usedCount: integer("used_count").notNull().default(0),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({
      columns: [
        t.operation,
        t.dimension,
        t.keyDigest,
        t.windowStartedAt,
        t.windowSeconds,
      ],
      name: "contribution_rate_buckets_pk",
    }),
    index("contribution_rate_buckets_expiry_idx").on(t.expiresAt),
    check(
      "contribution_rate_buckets_digest_check",
      sql`${t.keyDigest} ~ '^[0-9a-f]{64}$'`,
    ),
    check(
      "contribution_rate_buckets_window_check",
      sql`${t.windowSeconds} in (900, 86400)
        and ${t.usedCount} >= 0
        and ${t.expiresAt} = ${t.windowStartedAt} + make_interval(secs => ${t.windowSeconds})`,
    ),
  ],
);

// 8. Observations Table (Raw, immutable price reports)
export const observations = pgTable("observations", {
  id: uuid("id").defaultRandom().primaryKey(),
  itemVariantId: uuid("item_variant_id").references(() => itemVariants.id).notNull(),
  unitId: uuid("unit_id").references(() => units.id).notNull(),
  placeId: uuid("place_id").references(() => places.id).notNull(),
  availabilityState: varchar("availability_state", { length: 50 }).notNull(), // 'available', 'unavailable'
  priceAmount: integer("price_amount"), // stored in kobo/cents equivalent to prevent floating errors
  currency: varchar("currency", { length: 10 }).default("NGN").notNull(),
  observedAt: timestamp("observed_at").notNull(),
  submittedAt: timestamp("submitted_at").defaultNow().notNull(),
  sourceId: uuid("source_id").references(() => sources.id).notNull(),
  collectionMethod: varchar("collection_method", { length: 100 }).notNull(), // 'app_entry', 'scraper', 'sms'
  provenance: observationProvenance("provenance").default("synthetic").notNull(),
  moderationStatus: varchar("moderation_status", { length: 50 }).default("pending").notNull(), // 'pending', 'approved', 'rejected'
  admissionId: uuid("admission_id").references(() => contributionRequests.id),
  correctsObservationId: uuid("corrects_observation_id").references(
    (): AnyPgColumn => observations.id,
  ),
  notes: text("notes"),
  /**
   * Did the trip actually end in a purchase?
   *
   * Today this lives in `raw_payload` as JSON (actions.ts:606), and
   * actions.ts:596-597 says why in its own words: "`did_buy` has no column, and
   * the conversion signal is worth more than the schema change it is waiting
   * on." This is the schema change it was waiting on.
   *
   * It earns a column rather than staying JSON because it is the only evidence
   * in the product that a price was not just *seen* but *paid*, the difference
   * between a listed number and a real transaction. As a jsonb key it cannot be
   * aggregated, indexed, or constrained without a functional index over a shape
   * nothing validates; as a column it can.
   *
   * Three states, so nullable is the point, not laziness:
   *   true , went, bought
   *   false, went, did not buy
   *   NULL , never asked (every observation not from a visit confirmation, and
   *           every row written before this migration)
   * A default of false would be a lie: it would file 942 existing observations
   * as "went and declined to buy" when nobody was ever asked. This repo has
   * been burned once by a plausible default standing in for missing data.
   */
  didBuy: boolean("did_buy"),
  rawPayload: jsonb("raw_payload")
}, (t) => [
  /**
   * The hottest query in the app and the one that grows fastest. Every write
   * re-derives the offer by aggregating this exact triple: actions.ts:304-306
   * (submitObservation's recompute), reached again through the visit paths.
   * 942 rows today, and observations are immutable, this table only ever grows.
   */
  index("observations_variant_unit_place_idx").on(t.itemVariantId, t.unitId, t.placeId),
  uniqueIndex("observations_admission_key").on(t.admissionId),
  index("observations_correction_idx").on(t.correctsObservationId),
  check(
    "observations_contribution_claim_check",
    sql`${t.admissionId} is null
      or (
        ${t.provenance} = 'observed'
        and ${t.moderationStatus} = 'pending'
        and (
          (${t.availabilityState} = 'available' and ${t.priceAmount} is not null and ${t.priceAmount} > 0)
          or (${t.availabilityState} = 'unavailable' and ${t.priceAmount} is null)
        )
      )`,
  ),
  check(
    "observations_correction_not_self_check",
    sql`${t.correctsObservationId} is null or ${t.correctsObservationId} <> ${t.id}`,
  ),
]);

export const contributionModeratorAssignments = pgTable(
  "contribution_moderator_assignments",
  {
    accountId: uuid("account_id").primaryKey(),
    status: contributionAssignmentStatus("status").notNull().default("suspended"),
    issuedByAccountId: uuid("issued_by_account_id").notNull(),
    reviewedByAccountId: uuid("reviewed_by_account_id").notNull(),
    effectiveAt: timestamp("effective_at", { withTimezone: true }).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("contribution_moderator_assignments_status_idx").on(t.status, t.expiresAt),
    check(
      "contribution_moderator_assignments_separation_check",
      sql`${t.accountId} <> ${t.issuedByAccountId}
        and ${t.accountId} <> ${t.reviewedByAccountId}
        and ${t.issuedByAccountId} <> ${t.reviewedByAccountId}`,
    ),
    check(
      "contribution_moderator_assignments_time_check",
      sql`${t.expiresAt} is null or ${t.expiresAt} > ${t.effectiveAt}`,
    ),
  ],
);

/**
 * Append-only decisions. `reverse` points at the effective approve/reject
 * decision it cancels; a subsequent approve/reject is another row.
 */
export const contributionModerationDecisions = pgTable(
  "contribution_moderation_decisions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    observationId: uuid("observation_id").references(() => observations.id).notNull(),
    decision: contributionDecision("decision").notNull(),
    actorAccountId: uuid("actor_account_id").notNull(),
    priorDecisionId: uuid("prior_decision_id").references(
      (): AnyPgColumn => contributionModerationDecisions.id,
    ),
    requestId: uuid("request_id").notNull(),
    payloadDigest: varchar("payload_digest", { length: 64 }).notNull(),
    reasonCode: varchar("reason_code", { length: 64 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("contribution_moderation_decisions_request_key").on(t.requestId),
    uniqueIndex("contribution_moderation_decisions_reversal_key").on(t.priorDecisionId),
    index("contribution_moderation_decisions_observation_created_idx").on(
      t.observationId,
      t.createdAt.desc(),
    ),
    check(
      "contribution_moderation_decisions_shape_check",
      sql`(${t.decision} = 'reverse' and ${t.priorDecisionId} is not null)
        or (${t.decision} in ('approve', 'reject') and ${t.priorDecisionId} is null)`,
    ),
    check(
      "contribution_moderation_decisions_digest_check",
      sql`${t.payloadDigest} ~ '^[0-9a-f]{64}$'`,
    ),
    check(
      "contribution_moderation_decisions_reason_check",
      sql`${t.reasonCode} ~ '^[a-z0-9_]{2,64}$'`,
    ),
  ],
);

export const contributionAuditEvents = pgTable(
  "contribution_audit_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    requestId: uuid("request_id").notNull(),
    action: contributionAuditAction("action").notNull(),
    actorAccountId: uuid("actor_account_id"),
    subjectDigest: varchar("subject_digest", { length: 64 }),
    observationId: uuid("observation_id").references(() => observations.id),
    decisionId: uuid("decision_id").references(() => contributionModerationDecisions.id),
    reasonCode: varchar("reason_code", { length: 64 }).notNull(),
    details: jsonb("details").notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("contribution_audit_events_request_idx").on(t.requestId, t.createdAt),
    index("contribution_audit_events_observation_idx").on(t.observationId, t.createdAt),
    check(
      "contribution_audit_events_digest_check",
      sql`${t.subjectDigest} is null or ${t.subjectDigest} ~ '^[0-9a-f]{64}$'`,
    ),
    check(
      "contribution_audit_events_reason_check",
      sql`${t.reasonCode} ~ '^[a-z0-9_]{2,64}$'`,
    ),
    check(
      "contribution_audit_events_details_check",
      sql`length(${t.details}::text) <= 4096`,
    ),
  ],
);

/**
 * ADR-019's approved-only projection, separate from legacy offers_current.
 * Phase 1 writes only this boundary; Phase 2 must deliberately switch reads.
 */
export const contributionProjections = pgTable(
  "contribution_projections",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    itemVariantId: uuid("item_variant_id").references(() => itemVariants.id).notNull(),
    unitId: uuid("unit_id").references(() => units.id).notNull(),
    placeId: uuid("place_id").references(() => places.id).notNull(),
    state: contributionProjectionState("state").notNull(),
    priceKind: varchar("price_kind", { length: 50 }),
    priceMin: integer("price_min"),
    priceMax: integer("price_max"),
    currency: varchar("currency", { length: 10 }).notNull().default("NGN"),
    lastObservedAt: timestamp("last_observed_at").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    supportingObservationCount: integer("supporting_observation_count").notNull(),
    availableSourceCount: integer("available_source_count").notNull().default(0),
    unavailableSourceCount: integer("unavailable_source_count").notNull().default(0),
    policyVersion: varchar("policy_version", { length: 64 }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("contribution_projections_subject_key").on(
      t.itemVariantId,
      t.unitId,
      t.placeId,
    ),
    index("contribution_projections_expiry_idx").on(t.expiresAt),
    check(
      "contribution_projections_counts_check",
      sql`${t.supportingObservationCount} > 0
        and ${t.availableSourceCount} >= 0
        and ${t.unavailableSourceCount} >= 0`,
    ),
    check(
      "contribution_projections_price_check",
      sql`(
          ${t.state} = 'available'
          and ${t.priceMin} is not null
          and ${t.priceMin} > 0
          and ${t.priceKind} in ('Exact', 'Range')
          and (
            (${t.priceKind} = 'Exact' and ${t.priceMax} is null)
            or (${t.priceKind} = 'Range' and ${t.priceMax} is not null and ${t.priceMax} > ${t.priceMin})
          )
        )
        or (
          ${t.state} = 'unavailable'
          and ${t.priceKind} is null
          and ${t.priceMin} is null
          and ${t.priceMax} is null
          and ${t.unavailableSourceCount} >= 2
        )
        or (
          ${t.state} = 'conflict'
          and (
            (${t.priceKind} is null and ${t.priceMin} is null and ${t.priceMax} is null)
            or (
              ${t.priceMin} is not null
              and ${t.priceMin} > 0
              and ${t.priceKind} in ('Exact', 'Range')
              and (
                (${t.priceKind} = 'Exact' and ${t.priceMax} is null)
                or (${t.priceKind} = 'Range' and ${t.priceMax} is not null and ${t.priceMax} > ${t.priceMin})
              )
            )
          )
        )`,
    ),
    check(
      "contribution_projections_expiry_check",
      sql`${t.expiresAt} > ${t.lastObservedAt}`,
    ),
    check(
      "contribution_projections_policy_check",
      sql`length(trim(${t.policyVersion})) between 1 and 64`,
    ),
  ],
);

// 9. Offers Current (Materialized derived current offers table)
export const offersCurrent = pgTable("offers_current", {
  id: uuid("id").defaultRandom().primaryKey(),
  itemVariantId: uuid("item_variant_id").references(() => itemVariants.id).notNull(),
  unitId: uuid("unit_id").references(() => units.id).notNull(),
  placeId: uuid("place_id").references(() => places.id).notNull(),
  availabilityState: varchar("availability_state", { length: 50 }).notNull(), // 'available', 'unavailable'
  priceKind: varchar("price_kind", { length: 50 }).notNull(), // 'Exact', 'Range'
  priceMin: integer("price_min").notNull(),
  priceMax: integer("price_max"),
  currency: varchar("currency", { length: 10 }).default("NGN").notNull(),
  freshnessState: varchar("freshness_state", { length: 50 }).notNull(), // 'confirmed', 'caution', 'unavailable'
  trustLevel: varchar("trust_level", { length: 50 }).notNull(),
  lastObservedAt: timestamp("last_observed_at").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  supportingObservationCount: integer("supporting_observation_count").default(1).notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
}, (t) => [
  /**
   * The natural key, and the table's missing invariant.
   *
   * "offers_current" means one current offer per (variant, unit, place). The
   * code already assumes it: actions.ts:284-289, :521-526 and :570-575 all
   * select this triple with `.limit(1)` and treat the single row as *the*
   * offer. Nothing enforced it, so the read-select-then-insert-or-update in
   * submitObservation is a race, two concurrent reports for the same triple
   * can both miss on the select and both insert, after which one duplicate is
   * silently invisible to every subsequent `.limit(1)` and its price never
   * updates again.
   *
   * UNIQUE turns that from silent divergence into an error at the moment it
   * happens, which is this codebase's stated rule about (0,0).
   *
   * Verified safe to apply: `select count(*) from (select item_variant_id,
   * unit_id, place_id from offers_current group by 1,2,3 having count(*) > 1)`
   * returns 0 groups against the live database, across all 478 rows.
   *
   * Its leading column also serves every bare `item_variant_id` lookup
   * (actions.ts:163, :743), so no separate index on that column is warranted ,
   * a redundant one would only cost write throughput.
   */
  uniqueIndex("offers_current_variant_unit_place_key").on(t.itemVariantId, t.unitId, t.placeId),
  // getPlaceOffers filters on place alone (actions.ts:226); not a prefix of the
  // key above, so it needs its own index.
  index("offers_current_place_id_idx").on(t.placeId),
  // eq(offersCurrent.unitId, ...) filter at actions.ts:798, and the units join
  // at :175/:225/:762/:832, also not a usable prefix of the natural key.
  index("offers_current_unit_id_idx").on(t.unitId),
  /**
   * Serves the "freshest" ranking (actions.ts:803) and MAX(last_observed_at)
   * per item in getPopularItems, both of which are scoped by variant first.
   * Honest caveat: the freshest ordering is `last_observed_at desc, distance
   * asc`, and the distance term is computed, so the planner may still sort.
   * The variant-scoped prefix is what earns this one.
   */
  index("offers_current_variant_last_observed_idx").on(t.itemVariantId, t.lastObservedAt.desc())
]);

/**
 * 10. Problem Reports, free-text "something is wrong" reports from users.
 *
 * There is DELIBERATELY NO ADMIN UI behind this table, by the owner's own spec:
 * "we are admin, it's our site... we read the db directly, make inference". The
 * whole read surface is one query at psql, `select * from problem_reports order
 * by created_at desc`. Everything below is shaped for that reader, not for a
 * moderation queue that does not exist.
 *
 * NO status / moderation column, and its absence is a decision. `observations`
 * carries `moderation_status` and it is 'approved' on 949/949 rows, not because
 * that is the column default (the default is 'pending', see :298) but because
 * the seed and both write paths explicitly write 'approved' and nothing writes
 * 'rejected'. A status column here would be that same constant wearing the
 * costume of a fact.
 * A report is read once by a human and acted on outside the app; there is no
 * state for the app to track.
 *
 * `userId` is nullable with NO foreign key, the exact precedent of
 * `sources.userId` above (see its comment): ADR-003 makes contribution
 * anonymous-first, an anonymous report is the product's default and is never
 * refused, and a hard FK into Neon's managed `neon_auth.user` is a liability
 * NDPR erasure would rather see degrade to "unrecognised" than block.
 *
 * The context columns (`placeId` / `itemVariantId` / `unitId` / `contextLabel`)
 * are nullable with NO foreign key for a second, mechanical reason on top of the
 * first: `db:seed` TRUNCATEs `places` CASCADE and re-inserts with fresh
 * defaultRandom() UUIDs (keyed by slug), so a real FK would either CASCADE-delete
 * every report on the next seed or block the seed outright. `contextLabel` is a
 * denormalised human string ("Rice (imported) · 50kg bag · Mile 12 Market") so a
 * report stays legible at psql with no join and survives a re-seed that moves the
 * ids underneath it.
 *
 * These four columns SHIP AHEAD OF A WRITER, the same way `sources.userId` and
 * `observations.didBuy` did. The entry point that captures an offer in context
 * (a "report a problem" button inside a detail sheet) is not built in this
 * change; the only opener today is the Profile row, which is cold, no offer is
 * on screen there. So every row written now carries NULL here, and NULL is the
 * honest value: "filed without an offer in context", not a default pretending to
 * be a fact. The column earns its migration now because adding it later is a
 * second migration against a table the owner reads by hand.
 */
export const problemReports = pgTable("problem_reports", {
  id: uuid("id").defaultRandom().primaryKey(),
  // 'price_wrong' | 'place_wrong' | 'app_bug' | 'other'. varchar+comment, not a
  // pg enum, matching every other categorical column here; the closed set is
  // enforced at the write boundary by zod (src/lib/validation.ts), not by the DB.
  kind: varchar("kind", { length: 50 }).notNull(),
  // The report itself. Capped at 1000 chars by validation before it reaches here
  //, a text column is a free storage-exhaustion vector for an unthrottled public
  // write, and length is the only in-scope guard (there is no rate limiter yet).
  body: text("body").notNull(),
  userId: uuid("user_id"),
  placeId: uuid("place_id"),
  itemVariantId: uuid("item_variant_id"),
  unitId: uuid("unit_id"),
  contextLabel: text("context_label"),
  // 'en' | 'pidgin' | 'yoruba', the locale the reporter was reading. Answers
  // "did they see English, or something we translated?" when a bug is about copy.
  appLocale: varchar("app_locale", { length: 50 }),
  createdAt: timestamp("created_at").defaultNow().notNull()
}, (t) => [
  // The only read this table has is `order by created_at desc`. The index serves
  // it directly rather than sorting the whole table every time the owner looks.
  index("problem_reports_created_at_idx").on(t.createdAt.desc())
]);

/**
 * 11. User Profiles: a signed-in user's OWN contact channel.
 *
 * WHOSE CONTACT THIS IS, AND WHOSE IT IS NOT. These columns hold the LOGGED-IN
 * USER'S personal contact (a contributor, or a shopper who chose to leave a way
 * to be reached). They are ENTIRELY SEPARATE from `places.contact_channel_kind` /
 * `contact_channel_value` above, which are the SELLER's / stall's contact and are
 * gated by `places.contactVisibility`. Do not read, write, or cross-wire the two:
 * one is an account holder reachable at their own option, the other is a trader
 * published under a visibility policy. They only share a column shape.
 *
 * `userId` is NOT NULL and UNIQUE, and both differ from `sources.userId` on
 * purpose. There is no anonymous profile: a row here is only ever written by
 * `updateMyProfile`, which resolves the session server-side and refuses without
 * one, so a row with no owner is a state the write path cannot produce and would
 * mean nothing (whose contact is it?). UNIQUE states the real invariant, one
 * profile per user, AND is the ON CONFLICT target the upsert writes against.
 *
 * There is deliberately NO foreign key to `neon_auth.user`, the same reasoning as
 * `sources.userId` (see its comment): Neon manages that schema and may rewrite
 * it, and a hard FK into a managed table is a liability. The difference from
 * sources is the erasure shape. A source degrades to anonymous on NDPR erasure
 * (its user_id goes NULL and its price data survives unattributed); a profile row
 * IS the PII, so erasure DELETES it rather than nulling it. Neither case wants a
 * constraint to fight.
 *
 * The contact pair travels together, mirroring the places idiom: a value without
 * a kind is not dialable, and a kind without a value is not a contact. Both are
 * nullable, and NULL on both means "no channel on file". The both-or-neither rule
 * is enforced at the write boundary by zod (src/lib/validation.ts), not the DB.
 */
export const userProfiles = pgTable("user_profiles", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull(),
  contactChannelKind: varchar("contact_channel_kind", { length: 50 }), // 'phone', 'whatsapp', 'sms'
  contactChannelValue: varchar("contact_channel_value", { length: 255 }),
  /**
   * A Vercel Blob URL for this user's avatar, or NULL when they have uploaded
   * none. Nullable and defaultless for the same reason the contact pair is: NULL
   * means "no avatar on file", exactly what an existing row answers today, so
   * this column changes no current answer.
   *
   * Written only by `uploadMyAvatar` (which put()s the image and stores the URL
   * it returns) and nulled by `removeMyAvatar` (which del()s the blob). The Blob
   * host is allow-listed in next.config.ts so next/image will render it.
   * Nearby presence never reads contact data from this profile and keeps its
   * separately consented display fields in `presence_preferences`.
   */
  avatarUrl: text("avatar_url"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
}, (t) => [
  /**
   * One profile per user, and the ON CONFLICT target `updateMyProfile` upserts
   * against. UNIQUE here, unlike `sources_user_id_idx` which is a plain index
   * because the anonymous rows all hold NULL and Postgres treats NULLs as
   * distinct. Every profile row carries a real owner, so a second row for one
   * user is a bug rather than a second identity, and the unique index is what
   * both expresses that and lets the upsert find the row to update.
   */
  uniqueIndex("user_profiles_user_id_key").on(t.userId)
]);

export * from "./reviews";
export * from "./ingestion";
export * from "./presence";
export * from "./deletion";
