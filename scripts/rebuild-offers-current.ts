import { db } from "../src/db";
import { observations, offersCurrent } from "../src/db/schema";
import { eq, sql } from "drizzle-orm";

async function main() {
  console.log("Rebuilding offers_current from existing observations...");

  // Clear current projection table only (not observations!)
  await db.execute(sql`TRUNCATE TABLE offers_current CASCADE;`);

  // Fetch approved observations grouped by (item_variant_id, unit_id, place_id)
  const obsResult = await db.execute(sql`
    SELECT
      item_variant_id AS "variantId",
      unit_id AS "unitId",
      place_id AS "placeId",
      price_amount AS "priceAmount",
      observed_at AS "observedAt",
      availability_state AS "availabilityState"
    FROM ${observations}
    WHERE moderation_status = 'approved'
    ORDER BY observed_at DESC
  `);

  type ObsRow = {
    variantId: string;
    unitId: string;
    placeId: string;
    priceAmount: number;
    observedAt: Date | string;
    availabilityState: string;
  };

  const rows = obsResult.rows as unknown as ObsRow[];
  console.log(`Found ${rows.length} approved observation points.`);

  // Group by (variantId, unitId, placeId)
  const groups = new Map<string, ObsRow[]>();
  for (const row of rows) {
    const key = `${row.variantId}::${row.unitId}::${row.placeId}`;
    const list = groups.get(key) ?? [];
    list.push({
      ...row,
      priceAmount: Number(row.priceAmount),
      observedAt: new Date(row.observedAt),
    });
    groups.set(key, list);
  }

  const runStartedAt = new Date();
  const EXPIRATION_HOURS = 168; // 7 days window for freshness
  const STALE_HOURS = 24;

  let insertedCount = 0;
  for (const [key, groupObs] of groups.entries()) {
    const [variantId, unitId, placeId] = key.split("::");
    groupObs.sort((a, b) => (b.observedAt as Date).getTime() - (a.observedAt as Date).getTime());

    const newest = groupObs[0];
    const validPrices = groupObs
      .filter((o) => o.availabilityState === "available" && Number.isFinite(o.priceAmount) && o.priceAmount > 0)
      .map((o) => o.priceAmount);

    const priceMin = validPrices.length > 0 ? Math.min(...validPrices) : 100;
    const priceMax = validPrices.length > 0 ? Math.max(...validPrices) : 100;
    const isAvailable = newest.availabilityState === "available";

    const ageH = (runStartedAt.getTime() - (newest.observedAt as Date).getTime()) / 3600_000;
    const freshnessState = !isAvailable
      ? "unavailable"
      : ageH > EXPIRATION_HOURS
        ? "unavailable"
        : ageH > STALE_HOURS
          ? "caution"
          : "confirmed";

    // Extend expiresAt for active presentation
    const expiresAt = new Date(Math.max((newest.observedAt as Date).getTime() + EXPIRATION_HOURS * 3600 * 1000, runStartedAt.getTime() + 7 * 24 * 3600 * 1000));

    await db.insert(offersCurrent).values({
      itemVariantId: variantId,
      unitId: unitId,
      placeId: placeId,
      availabilityState: isAvailable ? "available" : "unavailable",
      priceKind: priceMax > priceMin ? "Range" : "Exact",
      priceMin,
      priceMax: priceMax > priceMin ? priceMax : null,
      freshnessState,
      trustLevel: "none",
      lastObservedAt: newest.observedAt as Date,
      expiresAt,
      supportingObservationCount: groupObs.length,
    });
    insertedCount++;
  }

  console.log(`Successfully rebuilt ${insertedCount} offers_current rows from ${rows.length} observations.`);
  process.exit(0);
}

main().catch((err) => {
  console.error("Error rebuilding offers_current:", err);
  process.exit(1);
});
