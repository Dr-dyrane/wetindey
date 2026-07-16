import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";
import * as schema from "./schema";

const run = async () => {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("DATABASE_URL environment variable is missing.");
    process.exit(1);
  }

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

  // 4. Seed units
  console.log("Seeding units...");
  const [uBag, uKg, uPaint] = await db.insert(schema.units).values([
    { code: "50kg_bag", displayName: "50kg bag", dimension: "mass", canonicalQuantity: 50 },
    { code: "1kg_measure", displayName: "1kg measure", dimension: "mass", canonicalQuantity: 1 },
    { code: "paint_bucket", displayName: "Paint bucket", dimension: "volume", canonicalQuantity: 4 }
  ]).returning();

  // 5. Seed items, aliases, and variants
  console.log("Seeding items taxonomy...");
  const [iRice, iBeans, iGarri, iYam, iOil] = await db.insert(schema.items).values([
    { slug: "rice", canonicalName: "Rice (50kg bag)", description: "Local and imported parboiled rice" },
    { slug: "oloyin-beans", canonicalName: "Oloyin Beans (1kg)", description: "Honey beans" },
    { slug: "white-garri", canonicalName: "White Garri (1 Paint)", description: "Cassava flakes" },
    { slug: "yam", canonicalName: "Yam (1 Tuber)", description: "Tuber of yam" },
    { slug: "palm-oil", canonicalName: "Palm Oil (1L)", description: "Red palm oil" }
  ]).returning();

  // Item aliases
  await db.insert(schema.itemAliases).values([
    { itemId: iRice.id, alias: "shinkafa", normalizedAlias: "shinkafa", weight: 2 },
    { itemId: iBeans.id, alias: "ewa", normalizedAlias: "ewa", weight: 2 },
    { itemId: iGarri.id, alias: "leki", normalizedAlias: "leki", weight: 2 },
    { itemId: iYam.id, alias: "isu", normalizedAlias: "isu", weight: 2 },
    { itemId: iOil.id, alias: "epo", normalizedAlias: "epo", weight: 2 }
  ]);

  // Item variants
  const [vRice, vBeans, vGarri, _vYam, _vOil] = await db.insert(schema.itemVariants).values([
    { itemId: iRice.id, slug: "rice-50kg-imported", displayName: "Imported Parboiled Rice" },
    { itemId: iBeans.id, slug: "beans-oloyin-1kg", displayName: "Oloyin Honey Beans" },
    { itemId: iGarri.id, slug: "garri-white-paint", displayName: "White Open-Market Garri" },
    { itemId: iYam.id, slug: "yam-tuber-medium", displayName: "Medium Yam Tuber" },
    { itemId: iOil.id, slug: "palm-oil-1l-bottle", displayName: "1L Palm Oil Bottle" }
  ]).returning();

  // 6. Seed areas (Yaba)
  console.log("Seeding areas...");
  const [areaYaba] = await db.insert(schema.areas).values([
    {
      slug: "yaba",
      name: "Yaba",
      type: "neighborhood",
      center: { lng: 3.3798, lat: 6.5178 },
      coverageStatus: "active"
    }
  ]).returning();

  // 7. Seed places (Markets & shops in Yaba)
  console.log("Seeding places...");
  const [pTejuosho, pOyinbo, pYabaKiosk, pSabo] = await db.insert(schema.places).values([
    {
      slug: "tejuosho-market",
      name: "Tejuosho Market",
      placeType: "open_market",
      areaId: areaYaba.id,
      location: { lng: 3.385, lat: 6.513 },
      address: "Tejuosho Road, Yaba, Lagos",
      verificationStatus: "verified"
    },
    {
      slug: "oyinbo-market",
      name: "Oyinbo Market",
      placeType: "open_market",
      areaId: areaYaba.id,
      location: { lng: 3.382, lat: 6.495 },
      address: "Oyingbo Road, Ebute Metta, Lagos",
      verificationStatus: "verified"
    },
    {
      slug: "yaba-bus-stop-kiosk",
      name: "Yaba Bus Stop Kiosk",
      placeType: "kiosk",
      areaId: areaYaba.id,
      location: { lng: 3.377, lat: 6.520 },
      address: "Near University Road intersection, Yaba",
      verificationStatus: "unverified"
    },
    {
      slug: "sabo-market-stall-12",
      name: "Sabo Market Stall 12",
      placeType: "open_market",
      areaId: areaYaba.id,
      location: { lng: 3.372, lat: 6.505 },
      address: "Sabo Market, Yaba, Lagos",
      verificationStatus: "verified"
    }
  ]).returning();

  // 8. Seed sources
  console.log("Seeding sources...");
  const [sContrib, sPublic, sVendor] = await db.insert(schema.sources).values([
    { sourceType: "Contributor", status: "active", reliabilityScoreInternal: 95 },
    { sourceType: "Public data", status: "active", reliabilityScoreInternal: 80 },
    { sourceType: "Vendor", status: "active", reliabilityScoreInternal: 70 }
  ]).returning();

  // 9. Seed observations
  console.log("Seeding observations...");
  await db.insert(schema.observations).values([
    // Rice observations
    {
      itemVariantId: vRice.id,
      unitId: uBag.id,
      placeId: pTejuosho.id,
      availabilityState: "available",
      priceAmount: 8500000, // ₦85,000 in kobo
      observedAt: new Date(Date.now() - 3 * 3600 * 1000), // 3h ago
      sourceId: sContrib.id,
      collectionMethod: "app_entry",
      moderationStatus: "approved"
    },
    {
      itemVariantId: vRice.id,
      unitId: uBag.id,
      placeId: pOyinbo.id,
      availabilityState: "available",
      priceAmount: 8400000, // ₦84,000 in kobo
      observedAt: new Date(Date.now() - 24 * 3600 * 1000), // Yesterday
      sourceId: sPublic.id,
      collectionMethod: "scraper",
      moderationStatus: "approved"
    },
    {
      itemVariantId: vRice.id,
      unitId: uBag.id,
      placeId: pYabaKiosk.id,
      availabilityState: "available",
      priceAmount: 8800000, // ₦88,000 in kobo
      observedAt: new Date(Date.now() - 72 * 3600 * 1000), // 3 days ago
      sourceId: sVendor.id,
      collectionMethod: "app_entry",
      moderationStatus: "approved"
    },
    // Beans observations
    {
      itemVariantId: vBeans.id,
      unitId: uKg.id,
      placeId: pTejuosho.id,
      availabilityState: "available",
      priceAmount: 240000, // ₦2,400 in kobo
      observedAt: new Date(Date.now() - 1 * 3600 * 1000), // 1h ago
      sourceId: sContrib.id,
      collectionMethod: "app_entry",
      moderationStatus: "approved"
    },
    {
      itemVariantId: vBeans.id,
      unitId: uKg.id,
      placeId: pSabo.id,
      availabilityState: "available",
      priceAmount: 245000, // ₦2,450 in kobo
      observedAt: new Date(Date.now() - 5 * 3600 * 1000), // 5h ago
      sourceId: sVendor.id,
      collectionMethod: "app_entry",
      moderationStatus: "approved"
    },
    // Garri observations
    {
      itemVariantId: vGarri.id,
      unitId: uPaint.id,
      placeId: pYabaKiosk.id,
      availabilityState: "available",
      priceAmount: 320000, // ₦3,200 in kobo
      observedAt: new Date(Date.now() - 4 * 3600 * 1000), // 4h ago
      sourceId: sContrib.id,
      collectionMethod: "app_entry",
      moderationStatus: "approved"
    },
    {
      itemVariantId: vGarri.id,
      unitId: uPaint.id,
      placeId: pOyinbo.id,
      availabilityState: "available",
      priceAmount: 310000, // ₦3,100 in kobo
      observedAt: new Date(Date.now() - 26 * 3600 * 1000), // Yesterday
      sourceId: sVendor.id,
      collectionMethod: "app_entry",
      moderationStatus: "approved"
    }
  ]);

  // 10. Seed current derived offers
  console.log("Seeding offers_current materialized summaries...");
  await db.insert(schema.offersCurrent).values([
    // Rice derived offers
    {
      itemVariantId: vRice.id,
      unitId: uBag.id,
      placeId: pTejuosho.id,
      availabilityState: "available",
      priceKind: "Exact",
      priceMin: 85000,
      freshnessState: "confirmed",
      trustLevel: "high",
      lastObservedAt: new Date(Date.now() - 3 * 3600 * 1000),
      expiresAt: new Date(Date.now() + 48 * 3600 * 1000)
    },
    {
      itemVariantId: vRice.id,
      unitId: uBag.id,
      placeId: pOyinbo.id,
      availabilityState: "available",
      priceKind: "Range",
      priceMin: 82000,
      priceMax: 86000,
      freshnessState: "caution",
      trustLevel: "medium",
      lastObservedAt: new Date(Date.now() - 24 * 3600 * 1000),
      expiresAt: new Date(Date.now() + 24 * 3600 * 1000)
    },
    {
      itemVariantId: vRice.id,
      unitId: uBag.id,
      placeId: pYabaKiosk.id,
      availabilityState: "available",
      priceKind: "Exact",
      priceMin: 88000,
      freshnessState: "unavailable",
      trustLevel: "low",
      lastObservedAt: new Date(Date.now() - 72 * 3600 * 1000),
      expiresAt: new Date(Date.now() - 1 * 3600 * 1000)
    },
    // Beans derived offers
    {
      itemVariantId: vBeans.id,
      unitId: uKg.id,
      placeId: pTejuosho.id,
      availabilityState: "available",
      priceKind: "Exact",
      priceMin: 2400,
      freshnessState: "confirmed",
      trustLevel: "high",
      lastObservedAt: new Date(Date.now() - 1 * 3600 * 1000),
      expiresAt: new Date(Date.now() + 71 * 3600 * 1000)
    },
    {
      itemVariantId: vBeans.id,
      unitId: uKg.id,
      placeId: pSabo.id,
      availabilityState: "available",
      priceKind: "Range",
      priceMin: 2300,
      priceMax: 2600,
      freshnessState: "confirmed",
      trustLevel: "high",
      lastObservedAt: new Date(Date.now() - 5 * 3600 * 1000),
      expiresAt: new Date(Date.now() + 67 * 3600 * 1000)
    },
    // Garri derived offers
    {
      itemVariantId: vGarri.id,
      unitId: uPaint.id,
      placeId: pYabaKiosk.id,
      availabilityState: "available",
      priceKind: "Exact",
      priceMin: 3200,
      freshnessState: "confirmed",
      trustLevel: "high",
      lastObservedAt: new Date(Date.now() - 4 * 3600 * 1000),
      expiresAt: new Date(Date.now() + 68 * 3600 * 1000)
    },
    {
      itemVariantId: vGarri.id,
      unitId: uPaint.id,
      placeId: pOyinbo.id,
      availabilityState: "available",
      priceKind: "Range",
      priceMin: 2900,
      priceMax: 3300,
      freshnessState: "caution",
      trustLevel: "medium",
      lastObservedAt: new Date(Date.now() - 26 * 3600 * 1000),
      expiresAt: new Date(Date.now() + 22 * 3600 * 1000)
    }
  ]);

  console.log("✓ Seeding completed successfully. Database is fully ready.");
  pool.end();
};

run().catch((err) => {
  console.error("Error running database setup script:", err);
  process.exit(1);
});
