"use server";

import { db } from "@/db";
import { items, itemVariants, places, offersCurrent, units } from "@/db/schema";
import { eq, ilike, or } from "drizzle-orm";

// 1. Search food items in the database
export async function searchFoodItems(query: string) {
  if (!query || query.trim() === "") {
    return [];
  }

  const matched = await db
    .select({
      id: items.id,
      name: items.canonicalName,
      description: items.description,
    })
    .from(items)
    .where(
      or(
        ilike(items.canonicalName, `%${query}%`),
        ilike(items.slug, `%${query}%`)
      )
    )
    .limit(10);

  return matched;
}

// 2. Fetch candidates/offers for a selected food item
export async function getFoodItemCandidates(itemId: string) {
  if (!itemId) return [];

  // Retrieve the list of variants for this item
  const variants = await db
    .select()
    .from(itemVariants)
    .where(eq(itemVariants.itemId, itemId));

  if (variants.length === 0) return [];

  const variantIds = variants.map((v) => v.id);

  // Build the dynamic OR checks for variant matches
  const variantChecks = variantIds.map((id) => eq(offersCurrent.itemVariantId, id));

  // Query offers current, joining places, units, and variants
  const results = await db
    .select({
      offer: offersCurrent,
      place: places,
      unitName: units.displayName,
      variantName: itemVariants.displayName,
    })
    .from(offersCurrent)
    .innerJoin(places, eq(offersCurrent.placeId, places.id))
    .innerJoin(units, eq(offersCurrent.unitId, units.id))
    .innerJoin(itemVariants, eq(offersCurrent.itemVariantId, itemVariants.id))
    .where(or(...variantChecks));

  return results.map((r) => ({
    id: r.offer.id,
    placeId: r.place.id,
    placeName: r.place.name,
    lat: r.place.location.lat,
    lng: r.place.location.lng,
    address: r.place.address || "",
    detail: {
      priceMin: r.offer.priceMin,
      priceMax: r.offer.priceMax || undefined,
      priceType: r.offer.priceKind,
      unit: r.unitName,
      timestamp: r.offer.lastObservedAt.toISOString(),
      sourceType: "Community",
      confidenceLevel: r.offer.freshnessState, // 'confirmed', 'caution', 'unavailable'
      confidenceScore: r.offer.supportingObservationCount * 10
    }
  }));
}
