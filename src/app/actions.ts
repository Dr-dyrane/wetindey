"use server";

import { db } from "@/db";
import { items, itemVariants, places, offersCurrent, units, observations, sources } from "@/db/schema";
import { eq, ilike, or, and } from "drizzle-orm";

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

// 3. Fetch all places (markets/kiosks) for default startup rendering
export async function getPlaces() {
  const allPlaces = await db
    .select({
      id: places.id,
      name: places.name,
      placeType: places.placeType,
      location: places.location,
      address: places.address,
    })
    .from(places);
  return allPlaces;
}

// 4. Fetch all current food item offers at a specific place
export async function getPlaceOffers(placeId: string) {
  const results = await db
    .select({
      offer: offersCurrent,
      itemName: items.canonicalName,
      unitName: units.displayName,
      variantName: itemVariants.displayName,
    })
    .from(offersCurrent)
    .innerJoin(itemVariants, eq(offersCurrent.itemVariantId, itemVariants.id))
    .innerJoin(items, eq(itemVariants.itemId, items.id))
    .innerJoin(units, eq(offersCurrent.unitId, units.id))
    .where(eq(offersCurrent.placeId, placeId));

  return results.map((r) => ({
    id: r.offer.id,
    itemName: r.itemName,
    variantName: r.variantName,
    priceMin: r.offer.priceMin,
    priceMax: r.offer.priceMax || undefined,
    unit: r.unitName,
    availabilityState: r.offer.availabilityState,
    freshnessState: r.offer.freshnessState,
    lastObservedAt: r.offer.lastObservedAt.toISOString(),
  }));
}

// 5. Submit crowdsourced food price observations and recalculate offers_current
export async function submitObservation(data: {
  itemVariantId: string;
  unitId: string;
  placeId: string;
  priceAmount: number; // in Naira
  availabilityState: "available" | "unavailable";
}) {
  // Fetch default "Contributor" source
  const contributorSource = await db
    .select({ id: sources.id })
    .from(sources)
    .where(eq(sources.sourceType, "Contributor"))
    .limit(1);

  const sourceId = contributorSource[0]?.id;
  if (!sourceId) {
    throw new Error("Default Contributor source not configured in database.");
  }

  const now = new Date();
  const koboPrice = Math.round(data.priceAmount * 100);

  // Insert raw immutable observation entry
  const [newObs] = await db
    .insert(observations)
    .values({
      itemVariantId: data.itemVariantId,
      unitId: data.unitId,
      placeId: data.placeId,
      availabilityState: data.availabilityState,
      priceAmount: koboPrice,
      observedAt: now,
      sourceId,
      collectionMethod: "app_entry",
      moderationStatus: "approved"
    })
    .returning();

  // Find if a current offer exists
  const existingOffer = await db
    .select()
    .from(offersCurrent)
    .where(
      and(
        eq(offersCurrent.itemVariantId, data.itemVariantId),
        eq(offersCurrent.unitId, data.unitId),
        eq(offersCurrent.placeId, data.placeId)
      )
    )
    .limit(1);

  const expiresAt = new Date(now.getTime() + 72 * 3600 * 1000); // 72 hours expiration

  if (existingOffer.length > 0) {
    const offer = existingOffer[0];
    
    // Fetch recent prices for this offer to calibrate min/max bounds
    const recentObs = await db
      .select({ priceAmount: observations.priceAmount })
      .from(observations)
      .where(
        and(
          eq(observations.itemVariantId, data.itemVariantId),
          eq(observations.unitId, data.unitId),
          eq(observations.placeId, data.placeId),
          eq(observations.availabilityState, "available")
        )
      );

    const prices = recentObs.map((o) => o.priceAmount).filter((p): p is number => p !== null);
    
    let priceMin = koboPrice;
    let priceMax: number | undefined = undefined;
    let priceKind = "Exact";

    if (prices.length > 0) {
      priceMin = Math.min(...prices);
      const maxVal = Math.max(...prices);
      if (maxVal > priceMin) {
        priceMax = maxVal;
        priceKind = "Range";
      }
    }

    await db
      .update(offersCurrent)
      .set({
        availabilityState: data.availabilityState,
        priceKind,
        priceMin,
        priceMax: priceMax || null,
        freshnessState: "confirmed",
        trustLevel: "high",
        lastObservedAt: now,
        expiresAt,
        supportingObservationCount: offer.supportingObservationCount + 1,
        updatedAt: now
      })
      .where(eq(offersCurrent.id, offer.id));
  } else {
    // Insert new offer entry
    await db.insert(offersCurrent).values({
      itemVariantId: data.itemVariantId,
      unitId: data.unitId,
      placeId: data.placeId,
      availabilityState: data.availabilityState,
      priceKind: "Exact",
      priceMin: koboPrice,
      priceMax: null,
      freshnessState: "confirmed",
      trustLevel: "high",
      lastObservedAt: now,
      expiresAt,
      supportingObservationCount: 1
    });
  }

  return { success: true, observationId: newObs.id };
}

// 6. Fetch metadata required for price submissions (places, items, variants, units)
export async function getInitialSubmissionData() {
  const [placesList, itemsList, variantsList, unitsList] = await Promise.all([
    db.select({ id: places.id, name: places.name }).from(places),
    db.select({ id: items.id, name: items.canonicalName }).from(items),
    db.select({ id: itemVariants.id, itemId: itemVariants.itemId, displayName: itemVariants.displayName }).from(itemVariants),
    db.select({ id: units.id, displayName: units.displayName }).from(units)
  ]);

  return {
    places: placesList,
    items: itemsList,
    variants: variantsList,
    units: unitsList
  };
}
