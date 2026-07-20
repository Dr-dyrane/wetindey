import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";
import { eq } from "drizzle-orm";
import * as schema from "./schema";
import { ITEM_IMAGES, assertItemImages } from "./itemImages";
import { SW_LAGOS_AREAS, SW_LAGOS_PLACES } from "./lagosSouthWest";
import { NIGERIA_ADMIN, NEIGHBOURHOOD_LGA, assertAdminTree } from "./lagosAdmin";
import {
  SEED_UNITS,
  SEED_ITEMS,
  EXTRA_PLACES,
  allSeedVariants,
  getConsumerPrimaryVariant,
  normalizeAlias,
  assertSeedContent,
} from "./seedContent";

/**
 * Freshness policy.
 *
 * These are the shared trust windows: stale after 24 hours and expired after
 * 72. The seed derives freshness from the same policy as live reads and writes,
 * so seeded data and live data mean the same thing.
 *
 * The old seed's comment said "expires in 7 days" while the code wrote 72h.
 * 72 is the number that was actually in force, so 72 it is; the comment was the
 * lie. docs/product/USER-FLOW.md open question 2 asks which is real — this is the
 * answer until a human overrides it.
 */
const STALE_HOURS = 24;
const EXPIRATION_HOURS = 72;
const SEED_VERSION = "wetindey-sample-v1";

/**
 * A dependency-free, stable PRNG keyed by source identifiers rather than
 * database ids or insertion order. FNV-1a supplies the 32-bit seed and
 * Mulberry32 supplies the repeatable stream.
 */
const createStableRandom = (key: string): (() => number) => {
  let state = 2_166_136_261;
  for (let i = 0; i < key.length; i++) {
    state ^= key.charCodeAt(i);
    state = Math.imul(state, 16_777_619);
  }
  state >>>= 0;

  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  };
};

/** Fisher-Yates with an injected stable random stream. */
const shuffledWith = <T>(values: readonly T[], random: () => number): T[] => {
  const shuffled = [...values];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};

/** Attach the verified Commons photo for a slug, if we have one. */
const withImage = (slug: string) => {
  const img = ITEM_IMAGES[slug];
  if (!img) return {};
  return {
    imageUrl: img.url,
    imageAttribution: img.attribution,
    imageLicense: img.license,
    imageSourceUrl: img.sourceUrl
  };
};

const hoursAgo = (anchor: Date, h: number) =>
  new Date(anchor.getTime() - h * 3600 * 1000);

const run = async () => {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("DATABASE_URL environment variable is missing.");
    process.exit(1);
  }
  const runStartedAt = new Date();

  // Fail before writing anything, naming the offender. A variant pointing at a
  // missing unit code would otherwise surface as a null far from its cause.
  assertSeedContent();

  // A photo keyed to a slug no item has is a silent monogram on the landing
  // list. Four shipped that way before this check existed.
  assertItemImages(SEED_ITEMS.map((i) => i.slug));

  console.log("Connecting to Neon Postgres...");
  const pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });

  const db = drizzle(pool, { schema });

  // 1. Verify connection and enable PostGIS extension
  console.log("Checking and enabling PostGIS extension...");
  await db.execute(`CREATE EXTENSION IF NOT EXISTS postgis;`);
  console.log("✓ PostGIS extension verified.");

  // 2. Run schema migrations
  console.log("Running Drizzle database schema migrations...");
  await migrate(db, { migrationsFolder: "./src/db/migrations" });
  console.log("✓ Database migrations completed successfully.");

  // 3. Clear existing table entries to ensure idempotent seeding
  console.log("Cleaning existing database tables...");
  await db.execute(`TRUNCATE TABLE offers_current CASCADE;`);
  await db.execute(`TRUNCATE TABLE observations CASCADE;`);
  await db.execute(`TRUNCATE TABLE sources CASCADE;`);
  await db.execute(`TRUNCATE TABLE places CASCADE;`);
  await db.execute(`TRUNCATE TABLE areas CASCADE;`);
  await db.execute(`TRUNCATE TABLE item_aliases CASCADE;`);
  await db.execute(`TRUNCATE TABLE item_variants CASCADE;`);
  await db.execute(`TRUNCATE TABLE items CASCADE;`);
  await db.execute(`TRUNCATE TABLE units CASCADE;`);
  console.log("✓ Clean complete.");

  // 4. Units
  console.log(`Seeding ${SEED_UNITS.length} units...`);
  const unitRows = await db.insert(schema.units).values(
    SEED_UNITS.map((u) => ({
      code: u.code,
      displayName: u.displayName,
      dimension: u.dimension,
      canonicalQuantity: u.canonicalQuantity,
      notes: u.notes ?? null
    }))
  ).returning();
  const unitByCode = new Map(unitRows.map((u) => [u.code, u]));

  // 5. Items, aliases, variants
  console.log(`Seeding ${SEED_ITEMS.length} items...`);
  const itemRows = await db.insert(schema.items).values(
    SEED_ITEMS.map((i) => ({
      slug: i.slug,
      canonicalName: i.canonicalName,
      description: i.description,
      category: i.category ?? "food",
      ...withImage(i.slug)
    }))
  ).returning();
  const itemBySlug = new Map(itemRows.map((i) => [i.slug, i]));

  const aliasRows = SEED_ITEMS.flatMap((i) =>
    i.aliases.map((a) => ({
      itemId: itemBySlug.get(i.slug)!.id,
      alias: a.alias,
      locale: a.locale,
      // normalizedAlias and weight were written by the old seed and read by
      // nothing; search matched raw `alias` and ranked by nothing. They are
      // written correctly here so the ranking they exist for becomes possible.
      normalizedAlias: normalizeAlias(a.alias),
      weight: a.weight
    }))
  );
  await db.insert(schema.itemAliases).values(aliasRows);
  console.log(`✓ ${aliasRows.length} aliases across ${SEED_ITEMS.length} items.`);

  const seedVariants = allSeedVariants();
  const variantRows = await db.insert(schema.itemVariants).values(
    seedVariants.map((v) => ({
      itemId: itemBySlug.get(v.itemSlug)!.id,
      slug: v.slug,
      displayName: v.displayName,
      attributes: v.attributes ?? null
    }))
  ).returning();
  const variantBySlug = new Map(variantRows.map((v) => [v.slug, v]));
  console.log(`✓ ${variantRows.length} variants (${(variantRows.length / itemRows.length).toFixed(1)} per item — narrowing needs > 1).`);

  /**
   * 6. Areas, as a TREE.
   *
   * `areas.parentAreaId` and `areas.type` have been in the schema since the
   * first migration. `type` was written as the literal "neighborhood" for every
   * row and `parentAreaId` was never written at all, so all nine areas sat flat
   * with a NULL parent — a hierarchy column with no hierarchy in it.
   *
   * It is filled now because it is how a person says where they are: Lagos →
   * Amuwo Odofin → Festac. Asking for a latitude is an engineer's idea of manual
   * entry.
   *
   * Inserted parents-first so a child can resolve its parent's id in the same
   * pass. The country and state rows are single-child on purpose — the picker
   * shows them as settled facts, not choices.
   */
  const neighbourhoods = [
    ...SW_LAGOS_AREAS.map((a) => ({ slug: a.slug, name: a.name, center: a.center })),
    { slug: "yaba", name: "Yaba", center: { lat: 6.5178, lng: 3.3798 } },
    { slug: "ebute-metta", name: "Ebute Metta", center: { lat: 6.4944, lng: 3.3814 } },
    { slug: "bariga", name: "Bariga", center: { lat: 6.5332, lng: 3.3934 } },
    { slug: "surulere", name: "Surulere", center: { lat: 6.5028, lng: 3.3592 } },
    { slug: "mushin", name: "Mushin", center: { lat: 6.5262, lng: 3.3533 } }
  ];

  // Throws on an area with no LGA rather than orphaning it in the picker.
  assertAdminTree(neighbourhoods.map((n) => n.slug));

  console.log("Seeding the administrative tree...");
  const ancestorRows = await db.insert(schema.areas).values(
    NIGERIA_ADMIN.map((n) => ({
      slug: n.slug,
      name: n.name,
      type: n.level,
      center: { lng: n.center.lng, lat: n.center.lat },
      /**
       * Only what the pilot serves is marked active, so the picker cannot offer
       * a branch with nothing behind it.
       *
       * This line read `n.level === "lga" ? "active" : "active"` — both arms the
       * same, so the condition decided nothing and every ancestor shipped active,
       * INCLUDING THE COUNTRY. It sat directly under the sentence above, which
       * says the opposite. Measured before the fix: country 1 area / 0 places,
       * state 1 / 0, lga 6 / 0, neighbourhood 9 / 60.
       *
       * That is not cosmetic. `getCoverageForPoint` picks the NEAREST area
       * `WHERE coverage_status = 'active'`, limit 1 — so `Nigeria` was a
       * candidate answer, and measured, it wins: a point in Abuja resolves to
       * "Nigeria, 0 places, 140 km" because the country centroid beats every
       * neighbourhood by ~383 km.
       *
       * NO ANCESTOR IS EVER AN ANSWER — not the country, not the state, and NOT
       * the LGA. A first pass at this kept LGAs active, reasoning that they are
       * "the branch the picker drills through". That is false: `getAreaTree`
       * filters on `type = 'neighborhood'` and walks `parent_area_id`; it selects
       * `coverage_status` and never filters on it, and no component reads the
       * column at all. The ONLY thing `active` does on an LGA is make a 0-place
       * row eligible here.
       *
       * And that is fatal, because 5 of the 6 LGAs share an EXACT centroid — 0
       * metres — with one of their own neighbourhoods (Amuwo Odofin, Mushin, Ojo,
       * Somolu/Bariga, Surulere). `ORDER BY ST_Distance ASC LIMIT 1` has no
       * tiebreaker, so the LGA wins arbitrarily: a user standing in Mushin, where
       * 6 places sit at that exact coordinate, is told "Mushin, 0 places".
       * Keeping LGAs active left 5 of the 9 pilot neighbourhoods broken — the
       * same 5 as before the fix. It would have fixed Abuja and left Lagos.
       *
       * So: only neighbourhoods, which are inserted active below and are the only
       * rows carrying places. The schema default is already `inactive`; this now
       * agrees with it rather than arguing with it.
       *
       * The tie itself still wants a deterministic ORDER BY in
       * `getCoverageForPoint` — coincident centroids will recur. LANES H31.
       */
      coverageStatus: "inactive"
    }))
  ).returning();
  const ancestorBySlug = new Map(ancestorRows.map((a) => [a.slug, a]));

  // Parents resolved in a second pass: NIGERIA_ADMIN is ordered root-first, but
  // relying on insertion order for id resolution is a trap the next edit springs.
  for (const n of NIGERIA_ADMIN) {
    if (!n.parent) continue;
    await db.update(schema.areas)
      .set({ parentAreaId: ancestorBySlug.get(n.parent)!.id })
      .where(eq(schema.areas.slug, n.slug));
  }

  const insertedAreas = await db.insert(schema.areas).values(
    neighbourhoods.map((a) => ({
      slug: a.slug,
      name: a.name,
      type: "neighborhood",
      center: { lng: a.center.lng, lat: a.center.lat },
      parentAreaId: ancestorBySlug.get(NEIGHBOURHOOD_LGA[a.slug])!.id,
      coverageStatus: "active"
    }))
  ).returning();
  const areaBySlug = new Map(insertedAreas.map((a) => [a.slug, a]));
  console.log(`✓ ${NIGERIA_ADMIN.length} ancestors + ${insertedAreas.length} neighbourhoods, parented.`);

  // 7. Places
  const legacyPlaces = [
    { slug: "tejuosho-market", name: "Tejuosho Market", placeType: "open_market", area: "yaba", lng: 3.3850, lat: 6.5130, address: "Tejuosho Road, Yaba, Lagos", verified: true },
    { slug: "sabo-market", name: "Sabo Market Stall 12", placeType: "open_market", area: "yaba", lng: 3.3720, lat: 6.5050, address: "Sabo Market, Yaba, Lagos", verified: true },
    { slug: "yaba-kiosk", name: "Yaba Bus Stop Kiosk", placeType: "kiosk", area: "yaba", lng: 3.3770, lat: 6.5200, address: "Near University Road, Yaba", verified: false },
    { slug: "oyinbo-market", name: "Oyinbo Market", placeType: "open_market", area: "ebute-metta", lng: 3.3820, lat: 6.4950, address: "Oyingbo Road, Ebute Metta, Lagos", verified: true },
    { slug: "otto-market-stall", name: "Otto Market Stall", placeType: "open_market", area: "ebute-metta", lng: 3.3750, lat: 6.4880, address: "Otto Area, Ebute Metta", verified: false },
    { slug: "ebute-metta-corner-shop", name: "Ebute Metta Corner Shop", placeType: "supermarket", area: "ebute-metta", lng: 3.3800, lat: 6.4900, address: "Herbert Macaulay Way, Ebute Metta", verified: true },
    { slug: "bariga-market", name: "Bariga Market", placeType: "open_market", area: "bariga", lng: 3.3950, lat: 6.5350, address: "Bariga Road, Lagos", verified: true },
    { slug: "somolu-retail-shop", name: "Somolu Retail Shop", placeType: "kiosk", area: "bariga", lng: 3.3880, lat: 6.5300, address: "Somolu Area, Lagos", verified: false },
    { slug: "akoka-stalls", name: "Akoka Market Stalls", placeType: "open_market", area: "bariga", lng: 3.3910, lat: 6.5220, address: "Near UNILAG Gate, Akoka", verified: true },
    { slug: "ojuelegba-market", name: "Ojuelegba Market", placeType: "open_market", area: "surulere", lng: 3.3600, lat: 6.5120, address: "Under Bridge, Ojuelegba, Surulere", verified: true },
    { slug: "lawanson-market", name: "Lawanson Market", placeType: "open_market", area: "surulere", lng: 3.3520, lat: 6.4980, address: "Lawanson Road, Surulere", verified: true },
    { slug: "adeniran-ogunsanya-mall", name: "Adeniran Ogunsanya Mall", placeType: "supermarket", area: "surulere", lng: 3.3580, lat: 6.4950, address: "Adeniran Ogunsanya St, Surulere", verified: true },
    { slug: "mushin-olosha-market", name: "Mushin Olosha Market", placeType: "open_market", area: "mushin", lng: 3.3550, lat: 6.5280, address: "Agege Motor Road, Mushin", verified: true },
    { slug: "ojuwoye-market", name: "Ojuwoye Market", placeType: "open_market", area: "mushin", lng: 3.3510, lat: 6.5240, address: "Ojuwoye Street, Mushin", verified: true },
    { slug: "mushin-retail-kiosk", name: "Mushin Retail Kiosk", placeType: "kiosk", area: "mushin", lng: 3.3540, lat: 6.5310, address: "Laspotech Area, Mushin", verified: false }
  ] as const;

  console.log("Seeding places...");
  const placesList = await db.insert(schema.places).values([
    ...SW_LAGOS_PLACES.map((p) => ({
      slug: p.slug, name: p.name, placeType: p.placeType,
      areaId: areaBySlug.get(p.area)!.id,
      location: { lng: p.location.lng, lat: p.location.lat },
      address: p.address, verificationStatus: p.verified ? "verified" : "unverified"
    })),
    ...EXTRA_PLACES.map((p) => ({
      slug: p.slug, name: p.name, placeType: p.placeType,
      areaId: areaBySlug.get(p.area)!.id,
      location: { lng: p.location.lng, lat: p.location.lat },
      address: p.address, verificationStatus: p.verified ? "verified" : "unverified"
    })),
    ...legacyPlaces.map((p) => ({
      slug: p.slug, name: p.name, placeType: p.placeType,
      areaId: areaBySlug.get(p.area)!.id,
      location: { lng: p.lng, lat: p.lat },
      address: p.address, verificationStatus: p.verified ? "verified" : "unverified"
    }))
  ]).returning();
  console.log(`✓ ${placesList.length} places across ${insertedAreas.length} areas.`);

  // 8. Sources
  const [sContrib, sPublic, sVendor] = await db.insert(schema.sources).values([
    { sourceType: "Contributor", status: "active", reliabilityScoreInternal: 98 },
    { sourceType: "Public data", status: "active", reliabilityScoreInternal: 85 },
    { sourceType: "Vendor", status: "active", reliabilityScoreInternal: 75 }
  ]).returning();
  const sourcesList = [sContrib, sPublic, sVendor];

  /**
   * 9. Observations, and offers DERIVED from them.
   *
   * The old seed made the trust data fiction, in three separate ways:
   *
   *   1. It wrote ONE observation per offer while setting
   *      supportingObservationCount to a random 1-4. 138 of 178 offers therefore
   *      claimed more reports than existed — and confidenceScore is
   *      supportingObservationCount * 10, so the number users read as
   *      "confidence" was invented.
   *   2. It chose freshnessState at random, INDEPENDENTLY of observedAt. An
   *      offer seen five minutes ago could read "unavailable"; one from five days
   *      ago could read "confirmed". Freshness was decoupled from time.
   *   3. It set expiresAt to observedAt + 72h while seeding observations up to
   *      5.5 days old, so half the pilot was expired on arrival.
   *
   * Now: write the Sample/synthetic observations FIRST, from distinct Sample
   * sources at internally consistent times, then derive every field of the
   * offer from them. The count is the count. The freshness follows the one
   * captured run clock. Nothing is presented as observed evidence.
   */
  console.log("Generating Sample/synthetic observations, deriving offers...");

  const priceBySlug = new Map(seedVariants.map((v) => [v.slug, v.priceKobo]));
  const unitBySlugVariant = new Map(seedVariants.map((v) => [v.slug, v.unitCode]));

  let obsCount = 0;
  let offerCount = 0;

  for (const place of placesList) {
    const random = createStableRandom(`${SEED_VERSION}:${place.slug}`);

    // Select ITEMS before variants. Each item's variants[0] is its asserted
    // consumer-primary unit, so a later bulk alternative can never displace it
    // from a place's limited 6-10 Sample lines.
    const stockableItems = SEED_ITEMS
      .filter((item) => item.channels.includes(place.placeType as never))
      .sort((a, b) => a.slug.localeCompare(b.slug));
    if (stockableItems.length === 0) continue;

    const carriedCount = 6 + Math.floor(random() * 5);
    const carried = shuffledWith(stockableItems, random)
      .slice(0, carriedCount)
      .map((item) => ({
        ...getConsumerPrimaryVariant(item),
        itemSlug: item.slug,
        channels: item.channels
      }));

    for (const variant of carried) {
      const band = priceBySlug.get(variant.slug)!;
      const unitCode = unitBySlugVariant.get(variant.slug)!;
      const unit = unitByCode.get(unitCode)!;
      const variantRow = variantBySlug.get(variant.slug)!;

      const premium = place.placeType === "supermarket" ? 1.08 : place.placeType === "kiosk" ? 1.04 : 0.96;

      // Generate multi-window historical observations (current 7d vs previous 7d-14d)
      // to support deterministic, realistic food price trend calculations.
      const isRising = variant.slug.includes("rice");
      const isFalling = variant.slug.includes("garri");
      const priceMultiplierCurrent = isRising ? 1.05 : isFalling ? 0.94 : 1.0;
      const priceMultiplierPrevious = isRising ? 0.98 : isFalling ? 1.02 : 1.0;

      const available = random() > 0.12;
      const observations: Array<{ at: Date; price: number; sourceId: string }> = [];

      // Current 7-day window observations
      const currentCount = 2 + Math.floor(random() * 2);
      for (let i = 0; i < currentCount; i++) {
        const ageH = (i + 1) * 36 + random() * 12; // 1 to 5 days ago
        const basePrice = (band.min + random() * (band.max - band.min)) * premium;
        const price = Math.round(basePrice * priceMultiplierCurrent / 50) * 50; // round to nearest ₦50
        observations.push({
          at: hoursAgo(runStartedAt, ageH),
          price: Math.max(100, price),
          sourceId: sourcesList[i % sourcesList.length].id,
        });
      }

      // Previous 7d-14d window observations
      const previousCount = 2 + Math.floor(random() * 2);
      for (let i = 0; i < previousCount; i++) {
        const ageH = 168 + (i + 1) * 36 + random() * 12; // 7 to 13 days ago
        const basePrice = (band.min + random() * (band.max - band.min)) * premium;
        const price = Math.round(basePrice * priceMultiplierPrevious / 50) * 50;
        observations.push({
          at: hoursAgo(runStartedAt, ageH),
          price: Math.max(100, price),
          sourceId: sourcesList[(currentCount + i) % sourcesList.length].id,
        });
      }

      observations.sort((a, b) => b.at.getTime() - a.at.getTime());

      await db.insert(schema.observations).values(
        observations.map((o, i): typeof schema.observations.$inferInsert => ({
          itemVariantId: variantRow.id,
          unitId: unit.id,
          placeId: place.id,
          // Only the newest report carries the current availability; the earlier
          // ones are history, and history is that it was there.
          availabilityState: i === 0 && !available ? "unavailable" : "available",
          priceAmount: o.price,
          observedAt: o.at,
          sourceId: o.sourceId,
          collectionMethod: "app_entry",
          provenance: "synthetic",
          // The old seed never set this, so all 178 rows sat at the 'pending'
          // default — meaning any query filtering on 'approved' would honestly
          // report zero evidence for everything.
          moderationStatus: "approved"
        }))
      );
      obsCount += observations.length;

      const newest = observations[0];
      const prices = observations.map((o) => o.price);
      const priceMin = Math.min(...prices);
      const priceMax = Math.max(...prices);
      const ageH = (runStartedAt.getTime() - newest.at.getTime()) / 3600_000;

      // Freshness follows the clock, using the shared trust policy.
      const freshnessState = !available
        ? "unavailable"
        : ageH > EXPIRATION_HOURS
          ? "unavailable"
          : ageH > STALE_HOURS
            ? "caution"
            : "confirmed";

      await db.insert(schema.offersCurrent).values({
        itemVariantId: variantRow.id,
        unitId: unit.id,
        placeId: place.id,
        availabilityState: available ? "available" : "unavailable",
        priceKind: priceMax > priceMin ? "Range" : "Exact",
        priceMin,
        priceMax: priceMax > priceMin ? priceMax : null,
        freshnessState,
        trustLevel: "none",
        lastObservedAt: newest.at,
        expiresAt: new Date(newest.at.getTime() + EXPIRATION_HOURS * 3600 * 1000),
        // The count IS the count.
        supportingObservationCount: observations.length
      });
      offerCount++;
    }
  }

  console.log(`✓ Seeded ${obsCount} Sample/synthetic observations backing ${offerCount} offers.`);
  console.log(`  every offer's supportingObservationCount equals its generated observation count.`);
  await pool.end();
};

run().catch((err) => {
  console.error("Error running database setup script:", err);
  process.exit(1);
});
