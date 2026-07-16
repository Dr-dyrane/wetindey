import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";
import * as schema from "./schema";
import { ITEM_IMAGES } from "./itemImages";
import { SW_LAGOS_AREAS, SW_LAGOS_PLACES } from "./lagosSouthWest";

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
  const [u50kg, _u25kg, u1kg, uPaint, _uDerica, uTuber, uBunch, u1L, _u5L] = await db.insert(schema.units).values([
    { code: "50kg_bag", displayName: "50kg bag", dimension: "mass", canonicalQuantity: 50 },
    { code: "25kg_bag", displayName: "25kg bag", dimension: "mass", canonicalQuantity: 25 },
    { code: "1kg_measure", displayName: "1kg measure", dimension: "mass", canonicalQuantity: 1 },
    { code: "paint_bucket", displayName: "Paint bucket", dimension: "volume", canonicalQuantity: 4 },
    { code: "derica_cup", displayName: "Derica cup", dimension: "volume", canonicalQuantity: 0.8 },
    { code: "single_tuber", displayName: "Single tuber", dimension: "count", canonicalQuantity: 1 },
    { code: "bunch", displayName: "Bunch", dimension: "count", canonicalQuantity: 1 },
    { code: "1l_bottle", displayName: "1L bottle", dimension: "volume", canonicalQuantity: 1 },
    { code: "5l_bottle", displayName: "5L bottle", dimension: "volume", canonicalQuantity: 5 }
  ]).returning();

  // 5. Seed items, aliases, and variants
  console.log("Seeding items taxonomy...");
  const [iRice, iBeans, iWGarri, iYGarri, iYam, iPotato, iPlantain, iTomatoes, iOnions, iPalm, iGroundnut] = await db.insert(schema.items).values([
    { slug: "rice", canonicalName: "Rice (50kg bag)", description: "Local and imported parboiled rice", ...withImage("rice") },
    { slug: "oloyin-beans", canonicalName: "Oloyin Beans (1kg)", description: "Honey beans", ...withImage("oloyin-beans") },
    { slug: "white-garri", canonicalName: "White Garri (1 Paint)", description: "White cassava flakes", ...withImage("white-garri") },
    { slug: "yellow-garri", canonicalName: "Yellow Garri (1 Paint)", description: "Yellow/Ijebu garri flakes", ...withImage("yellow-garri") },
    { slug: "yam", canonicalName: "Yam (1 Tuber)", description: "Yam tuber", ...withImage("yam") },
    { slug: "sweet-potato", canonicalName: "Sweet Potato (1kg)", description: "Sweet potatoes", ...withImage("sweet-potato") },
    { slug: "plantain", canonicalName: "Plantain (1 Bunch)", description: "Ripe or unripe plantain bunch", ...withImage("plantain") },
    { slug: "tomatoes", canonicalName: "Tomatoes (1 Paint)", description: "Fresh basket/paint of round tomatoes", ...withImage("tomatoes") },
    { slug: "onions", canonicalName: "Onions (1kg)", description: "Red onions", ...withImage("onions") },
    { slug: "palm-oil", canonicalName: "Palm Oil (1L)", description: "Red palm oil", ...withImage("palm-oil") },
    { slug: "groundnut-oil", canonicalName: "Groundnut Oil (1L)", description: "Vegetable cooking oil", ...withImage("groundnut-oil") }
  ]).returning();

  // Item aliases
  await db.insert(schema.itemAliases).values([
    { itemId: iRice.id, alias: "shinkafa", normalizedAlias: "shinkafa", weight: 2 },
    { itemId: iBeans.id, alias: "ewa", normalizedAlias: "ewa", weight: 2 },
    { itemId: iWGarri.id, alias: "leki", normalizedAlias: "leki", weight: 2 },
    { itemId: iYGarri.id, alias: "ijebu", normalizedAlias: "ijebu", weight: 2 },
    { itemId: iYam.id, alias: "isu", normalizedAlias: "isu", weight: 2 },
    { itemId: iPotato.id, alias: "anamo", normalizedAlias: "anamo", weight: 2 },
    { itemId: iPlantain.id, alias: "dodo", normalizedAlias: "dodo", weight: 2 },
    { itemId: iTomatoes.id, alias: "tumatir", normalizedAlias: "tumatir", weight: 2 },
    { itemId: iOnions.id, alias: "albasa", normalizedAlias: "albasa", weight: 2 },
    { itemId: iPalm.id, alias: "epo", normalizedAlias: "epo", weight: 2 },
    { itemId: iGroundnut.id, alias: "ororo", normalizedAlias: "ororo", weight: 2 }
  ]);

  // Item variants
  const [vRice, vBeans, vWGarri, vYGarri, vYam, vPotato, vPlantain, vTomatoes, vOnions, vPalm, vGroundnut] = await db.insert(schema.itemVariants).values([
    { itemId: iRice.id, slug: "rice-50kg-imported", displayName: "Imported Parboiled Rice" },
    { itemId: iBeans.id, slug: "beans-oloyin-1kg", displayName: "Oloyin Honey Beans" },
    { itemId: iWGarri.id, slug: "garri-white-paint", displayName: "White Open-Market Garri" },
    { itemId: iYGarri.id, slug: "garri-yellow-paint", displayName: "Yellow Ijebu Garri" },
    { itemId: iYam.id, slug: "yam-tuber-medium", displayName: "Medium Yam Tuber" },
    { itemId: iPotato.id, slug: "potato-sweet-1kg", displayName: "Local Sweet Potatoes" },
    { itemId: iPlantain.id, slug: "plantain-bunch-medium", displayName: "Medium Plantain Bunch" },
    { itemId: iTomatoes.id, slug: "tomatoes-paint-bucket", displayName: "Paint Bucket of Tomatoes" },
    { itemId: iOnions.id, slug: "onions-red-1kg", displayName: "Red Onion Basket" },
    { itemId: iPalm.id, slug: "palm-oil-1l-bottle", displayName: "1L Palm Oil Bottle" },
    { itemId: iGroundnut.id, slug: "groundnut-oil-1l-bottle", displayName: "1L Groundnut Oil Bottle" }
  ]).returning();

  // 6. Seed areas.
  // South-west Lagos (Festac / Amuwo Odofin / Satellite Town / Ojo) is the
  // pilot; the original Yaba-side areas stay so the map still has depth
  // north-east of the lagoon.
  console.log("Seeding areas...");
  const swAreaRows = SW_LAGOS_AREAS.map((a) => ({
    slug: a.slug,
    name: a.name,
    type: "neighborhood",
    center: { lng: a.center.lng, lat: a.center.lat },
    coverageStatus: "active"
  }));

  const insertedAreas = await db.insert(schema.areas).values([
    ...swAreaRows,
    { slug: "yaba", name: "Yaba", type: "neighborhood", center: { lng: 3.3798, lat: 6.5178 }, coverageStatus: "active" },
    { slug: "ebute-metta", name: "Ebute Metta", type: "neighborhood", center: { lng: 3.3814, lat: 6.4944 }, coverageStatus: "active" },
    { slug: "bariga", name: "Bariga", type: "neighborhood", center: { lng: 3.3934, lat: 6.5332 }, coverageStatus: "active" },
    { slug: "surulere", name: "Surulere", type: "neighborhood", center: { lng: 3.3592, lat: 6.5028 }, coverageStatus: "active" },
    { slug: "mushin", name: "Mushin", type: "neighborhood", center: { lng: 3.3533, lat: 6.5262 }, coverageStatus: "active" }
  ]).returning();

  const areaBySlug = new Map(insertedAreas.map((a) => [a.slug, a]));
  const aYaba = areaBySlug.get("yaba")!;
  const aEbuteMetta = areaBySlug.get("ebute-metta")!;
  const aBariga = areaBySlug.get("bariga")!;
  const aSurulere = areaBySlug.get("surulere")!;
  const aMushin = areaBySlug.get("mushin")!;

  // 7. Seed places
  console.log("Seeding places...");
  const swPlaceRows = SW_LAGOS_PLACES.map((p) => ({
    slug: p.slug,
    name: p.name,
    placeType: p.placeType,
    areaId: areaBySlug.get(p.area)!.id,
    location: { lng: p.location.lng, lat: p.location.lat },
    address: p.address,
    verificationStatus: p.verified ? "verified" : "unverified"
  }));

  const placesList = await db.insert(schema.places).values([
    ...swPlaceRows,

    // Yaba (3 places)
    { slug: "tejuosho-market", name: "Tejuosho Market", placeType: "open_market", areaId: aYaba.id, location: { lng: 3.3850, lat: 6.5130 }, address: "Tejuosho Road, Yaba, Lagos", verificationStatus: "verified" },
    { slug: "sabo-market", name: "Sabo Market Stall 12", placeType: "open_market", areaId: aYaba.id, location: { lng: 3.3720, lat: 6.5050 }, address: "Sabo Market, Yaba, Lagos", verificationStatus: "verified" },
    { slug: "yaba-kiosk", name: "Yaba Bus Stop Kiosk", placeType: "kiosk", areaId: aYaba.id, location: { lng: 3.3770, lat: 6.5200 }, address: "Near University Road, Yaba", verificationStatus: "unverified" },

    // Ebute Metta (3 places)
    { slug: "oyinbo-market", name: "Oyinbo Market", placeType: "open_market", areaId: aEbuteMetta.id, location: { lng: 3.3820, lat: 6.4950 }, address: "Oyingbo Road, Ebute Metta, Lagos", verificationStatus: "verified" },
    { slug: "otto-market-stall", name: "Otto Market Stall", placeType: "open_market", areaId: aEbuteMetta.id, location: { lng: 3.3750, lat: 6.4880 }, address: "Otto Area, Ebute Metta", verificationStatus: "unverified" },
    { slug: "ebute-metta-corner-shop", name: "Ebute Metta Corner Shop", placeType: "supermarket", areaId: aEbuteMetta.id, location: { lng: 3.3800, lat: 6.4900 }, address: "Herbert Macaulay Way, Ebute Metta", verificationStatus: "verified" },

    // Bariga (3 places)
    { slug: "bariga-market", name: "Bariga Market", placeType: "open_market", areaId: aBariga.id, location: { lng: 3.3950, lat: 6.5350 }, address: "Bariga Road, Lagos", verificationStatus: "verified" },
    { slug: "somolu-retail-shop", name: "Somolu Retail Shop", placeType: "kiosk", areaId: aBariga.id, location: { lng: 3.3880, lat: 6.5300 }, address: "Somolu Area, Lagos", verificationStatus: "unverified" },
    { slug: "akoka-stalls", name: "Akoka Market Stalls", placeType: "open_market", areaId: aBariga.id, location: { lng: 3.3910, lat: 6.5220 }, address: "Near UNILAG Gate, Akoka", verificationStatus: "verified" },

    // Surulere (3 places)
    { slug: "ojuelegba-market", name: "Ojuelegba Market", placeType: "open_market", areaId: aSurulere.id, location: { lng: 3.3600, lat: 6.5120 }, address: "Under Bridge, Ojuelegba, Surulere", verificationStatus: "verified" },
    { slug: "lawanson-market", name: "Lawanson Market", placeType: "open_market", areaId: aSurulere.id, location: { lng: 3.3520, lat: 6.4980 }, address: "Lawanson Road, Surulere", verificationStatus: "verified" },
    { slug: "adeniran-ogunsanya-mall", name: "Adeniran Ogunsanya Mall", placeType: "supermarket", areaId: aSurulere.id, location: { lng: 3.3580, lat: 6.4950 }, address: "Adeniran Ogunsanya St, Surulere", verificationStatus: "verified" },

    // Mushin (3 places)
    { slug: "mushin-olosha-market", name: "Mushin Olosha Market", placeType: "open_market", areaId: aMushin.id, location: { lng: 3.3550, lat: 6.5280 }, address: "Agege Motor Road, Mushin", verificationStatus: "verified" },
    { slug: "ojuwoye-market", name: "Ojuwoye Market", placeType: "open_market", areaId: aMushin.id, location: { lng: 3.3510, lat: 6.5240 }, address: "Ojuwoye Street, Mushin", verificationStatus: "verified" },
    { slug: "mushin-retail-kiosk", name: "Mushin Retail Kiosk", placeType: "kiosk", areaId: aMushin.id, location: { lng: 3.3540, lat: 6.5310 }, address: "Laspotech Area, Mushin", verificationStatus: "unverified" }
  ]).returning();

  // 8. Seed sources
  console.log("Seeding sources...");
  const [sContrib, sPublic, sVendor] = await db.insert(schema.sources).values([
    { sourceType: "Contributor", status: "active", reliabilityScoreInternal: 98 },
    { sourceType: "Public data", status: "active", reliabilityScoreInternal: 85 },
    { sourceType: "Vendor", status: "active", reliabilityScoreInternal: 75 }
  ]).returning();

  // 9. Seed 50+ observations and offers dynamically
  console.log("Generating 50+ observations and offers current...");
  
  // Define base prices in kobo (NGN * 100) for variants
  const basePrices: Record<string, { min: number; max: number; unitId: string }> = {
    [vRice.id]: { min: 8200000, max: 9200000, unitId: u50kg.id },      // Rice 50kg: ₦82k - ₦92k
    [vBeans.id]: { min: 220000, max: 260000, unitId: u1kg.id },        // Beans 1kg: ₦2.2k - ₦2.6k
    [vWGarri.id]: { min: 280000, max: 350000, unitId: uPaint.id },      // White Garri 1 paint: ₦2.8k - ₦3.5k
    [vYGarri.id]: { min: 320000, max: 400000, unitId: uPaint.id },      // Yellow Garri 1 paint: ₦3.2k - ₦4k
    [vYam.id]: { min: 450000, max: 700000, unitId: uTuber.id },        // Yam Tuber: ₦4.5k - ₦7k
    [vPotato.id]: { min: 140000, max: 180000, unitId: u1kg.id },       // Potato 1kg: ₦1.4k - ₦1.8k
    [vPlantain.id]: { min: 350000, max: 550000, unitId: uBunch.id },    // Plantain bunch: ₦3.5k - ₦5.5k
    [vTomatoes.id]: { min: 450000, max: 750000, unitId: uPaint.id },    // Tomatoes 1 paint: ₦4.5k - ₦7.5k
    [vOnions.id]: { min: 180000, max: 240000, unitId: u1kg.id },        // Onions 1kg: ₦1.8k - ₦2.4k
    [vPalm.id]: { min: 140000, max: 180000, unitId: u1L.id },          // Palm Oil 1L: ₦1.4k - ₦1.8k
    [vGroundnut.id]: { min: 160000, max: 220000, unitId: u1L.id }      // Groundnut Oil 1L: ₦1.6k - ₦2.2k
  };

  const variantsList = [vRice, vBeans, vWGarri, vYGarri, vYam, vPotato, vPlantain, vTomatoes, vOnions, vPalm, vGroundnut];
  const sourcesList = [sContrib, sPublic, sVendor];
  const confidenceLevels = ["confirmed", "caution", "unavailable"] as const;

  let obsCount = 0;
  let offerCount = 0;

  for (const place of placesList) {
    // Each place will offer 4-6 random food items to simulate local variation
    const shuffledVariants = [...variantsList].sort(() => 0.5 - Math.random());
    const itemsToSeed = shuffledVariants.slice(0, 5 + Math.floor(Math.random() * 3)); // 5 to 7 items

    for (const variant of itemsToSeed) {
      const priceMeta = basePrices[variant.id];
      // Introduce slight local fluctuation (e.g. up to 10% variation depending on market/supermarket profile)
      const marketPremium = place.placeType === "supermarket" ? 1.08 : (place.placeType === "kiosk" ? 1.04 : 0.96);
      
      const seedPriceMin = Math.round((priceMeta.min + Math.random() * (priceMeta.max - priceMeta.min)) * marketPremium);
      const seedPriceMax = Math.random() > 0.6 ? Math.round(seedPriceMin * (1 + 0.05 + Math.random() * 0.1)) : undefined;

      const observedDaysAgo = Math.floor(Math.random() * 6); // 0 to 5 days ago
      const observedAtDate = new Date(Date.now() - observedDaysAgo * 24 * 3600 * 1000 - Math.random() * 12 * 3600 * 1000);
      
      const randomSource = sourcesList[Math.floor(Math.random() * sourcesList.length)];
      const randomConfidence = confidenceLevels[Math.floor(Math.random() * confidenceLevels.length)];

      // A. Insert Raw Observation
      await db.insert(schema.observations).values({
        itemVariantId: variant.id,
        unitId: priceMeta.unitId,
        placeId: place.id,
        availabilityState: randomConfidence === "unavailable" ? "unavailable" : "available",
        priceAmount: seedPriceMin,
        observedAt: observedAtDate,
        sourceId: randomSource.id,
        collectionMethod: "app_entry"
      });
      obsCount++;

      // B. Insert current derived offer matching the observation
      await db.insert(schema.offersCurrent).values({
        itemVariantId: variant.id,
        unitId: priceMeta.unitId,
        placeId: place.id,
        availabilityState: randomConfidence === "unavailable" ? "unavailable" : "available",
        priceKind: seedPriceMax ? "Range" : "Exact",
        priceMin: seedPriceMin,
        priceMax: seedPriceMax,
        freshnessState: randomConfidence,
        trustLevel: randomConfidence === "confirmed" ? "high" : (randomConfidence === "caution" ? "medium" : "low"),
        lastObservedAt: observedAtDate,
        expiresAt: new Date(observedAtDate.getTime() + 72 * 3600 * 1000), // expires in 7 days
        supportingObservationCount: 1 + Math.floor(Math.random() * 4)
      });
      offerCount++;
    }
  }

  console.log(`✓ Seeding completed. Added ${obsCount} observations and ${offerCount} offers.`);
  pool.end();
};

run().catch((err) => {
  console.error("Error running database setup script:", err);
  process.exit(1);
});
