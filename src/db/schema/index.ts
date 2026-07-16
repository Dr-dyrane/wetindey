import { pgTable, uuid, varchar, timestamp, text, integer, doublePrecision, boolean, jsonb, customType } from "drizzle-orm/pg-core";

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
    // Standard PostGIS WKT format e.g., "POINT(3.3798 6.5178)"
    const match = value.match(/POINT\(([^ ]+) ([^ ]+)\)/i);
    if (match) {
      return { lng: parseFloat(match[1]), lat: parseFloat(match[2]) };
    }
    return { lng: 0, lat: 0 };
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
});

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
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});

// 3. Items Table (Canonical food concepts e.g., Rice, Beans)
export const items = pgTable("items", {
  id: uuid("id").defaultRandom().primaryKey(),
  slug: varchar("slug", { length: 255 }).notNull().unique(),
  canonicalName: varchar("canonical_name", { length: 255 }).notNull(),
  description: text("description"),
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
});

// 5. Item Variants Table (Specific packaging or types e.g., Imported Parboiled, Local Stone-Free)
export const itemVariants = pgTable("item_variants", {
  id: uuid("id").defaultRandom().primaryKey(),
  itemId: uuid("item_id").references(() => items.id).notNull(),
  slug: varchar("slug", { length: 255 }).notNull().unique(),
  displayName: varchar("display_name", { length: 255 }).notNull(),
  attributes: jsonb("attributes"), // packaging details
  active: boolean("active").default(true).notNull()
});

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
  rawPayload: jsonb("raw_payload")
});

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
});
