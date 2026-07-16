import { pgTable, uuid, varchar, timestamp, text, integer, doublePrecision, boolean, jsonb, customType, index, uniqueIndex } from "drizzle-orm/pg-core";

/**
 * Decode a PostGIS POINT from hex-encoded EWKB.
 *
 * This is what `node-postgres` actually hands back for a `geography` column —
 * e.g. "0101000020E6100000FDA4DAA7E3310A402BF697DD93E71940" — NOT the WKT
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
     * EVERY place in the app silently became (0,0) — a point in the Gulf of
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
   * of a seq scan. Forward-looking at 9 rows — the planner will ignore it until
   * `areas` grows past the pilot — but it is the standard companion to any
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
   * and already documents why it cannot work: ":1066-1067 — there is also no
   * channel column — no phone, no handle — so even an explicit 'public' does
   * not yield something to dial". The policy function is not missing logic; it
   * is missing a column. This is that column.
   *
   * Both are nullable with no default, and NULL is meaningful: "this trader has
   * published no channel". That is exactly what the app answers today, so
   * adding these changes no current answer — an existing row keeps behaving as
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
   * `ST_DWithin(location, ...)` geography predicates — getPlacesNear
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
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});

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

// 7. Sources Table (Users, public databases, or vendors)
export const sources = pgTable("sources", {
  id: uuid("id").defaultRandom().primaryKey(),
  sourceType: varchar("source_type", { length: 100 }).notNull(), // 'Contributor', 'Public data', 'Vendor'
  status: varchar("status", { length: 50 }).default("active").notNull(),
  reliabilityScoreInternal: integer("reliability_score_internal").default(70).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});

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
  moderationStatus: varchar("moderation_status", { length: 50 }).default("pending").notNull(), // 'pending', 'approved', 'rejected'
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
   * in the product that a price was not just *seen* but *paid* — the difference
   * between a listed number and a real transaction. As a jsonb key it cannot be
   * aggregated, indexed, or constrained without a functional index over a shape
   * nothing validates; as a column it can.
   *
   * Three states, so nullable is the point, not laziness:
   *   true  — went, bought
   *   false — went, did not buy
   *   NULL  — never asked (every observation not from a visit confirmation, and
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
   * 942 rows today, and observations are immutable — this table only ever grows.
   */
  index("observations_variant_unit_place_idx").on(t.itemVariantId, t.unitId, t.placeId)
]);

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
   * submitObservation is a race — two concurrent reports for the same triple
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
   * (actions.ts:163, :743), so no separate index on that column is warranted —
   * a redundant one would only cost write throughput.
   */
  uniqueIndex("offers_current_variant_unit_place_key").on(t.itemVariantId, t.unitId, t.placeId),
  // getPlaceOffers filters on place alone (actions.ts:226); not a prefix of the
  // key above, so it needs its own index.
  index("offers_current_place_id_idx").on(t.placeId),
  // eq(offersCurrent.unitId, ...) filter at actions.ts:798, and the units join
  // at :175/:225/:762/:832 — also not a usable prefix of the natural key.
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
