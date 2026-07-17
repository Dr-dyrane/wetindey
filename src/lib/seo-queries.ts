/**
 * Read-only queries for the two indexable routes (/item/[slug], /place/[slug]).
 *
 * WHY THIS FILE EXISTS AND NOT `actions.ts`. Everything here could live beside
 * `getPlaceOffers` and `getPopularItems` in `src/app/actions.ts`, and it starts
 * from the same tables. It does not, for two reasons the repo already enforces:
 *
 *   1. `actions.ts` is a HOT, contested file owned by the auth-trust lane
 *      (LANES.md). A new export there is a merge conflict waiting to happen.
 *   2. Those are `"use server"` Server Actions: RPC endpoints reached from the
 *      client bundle. These reads run only inside Server Components at
 *      build/revalidate time. They are not actions, so they are not marked as
 *      one, and keeping them apart stops the client from importing a route-only
 *      query by accident.
 *
 * The shapes deliberately mirror `getPlaceOffers` (actions.ts) so the two never
 * disagree about what an offer row is, with one addition each surface needs:
 * `items.slug` / `places.slug`, so a page can link to the other family.
 *
 * PRICES ARE KOBO. `offers_current.price_min` / `price_max` are integer kobo
 * (schema/index.ts, and money.ts: "The argument is ALWAYS kobo"). Nothing here
 * divides by 100; the callers format with `formatNaira` (display) or divide once
 * for JSON-LD (seo.tsx). This module passes the stored unit through untouched.
 */
import { db } from "@/db";
import { areas, items, itemVariants, offersCurrent, places, units } from "@/db/schema";
import { and, asc, eq } from "drizzle-orm";

export type SeoItem = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  imageAttribution: string | null;
  imageLicense: string | null;
  imageSourceUrl: string | null;
};

/**
 * One item by slug, or null. `active = true` matches `searchFoodItems` and the
 * sitemap's `item/[slug]` family (both filter on it): an inactive item is hidden
 * from the product, so its page must 404 rather than advertise something the app
 * suppresses.
 */
export async function getItemBySlug(slug: string): Promise<SeoItem | null> {
  const [row] = await db
    .select({
      id: items.id,
      slug: items.slug,
      name: items.canonicalName,
      description: items.description,
      imageUrl: items.imageUrl,
      imageAttribution: items.imageAttribution,
      imageLicense: items.imageLicense,
      imageSourceUrl: items.imageSourceUrl,
    })
    .from(items)
    .where(and(eq(items.slug, slug), eq(items.active, true)))
    .limit(1);
  return row ?? null;
}

/** A current offer for one item, at one place, in one unit. Prices in kobo. */
export type SeoItemOffer = {
  offerId: string;
  placeId: string;
  placeName: string;
  placeSlug: string;
  variantName: string;
  unit: string;
  priceMin: number;
  priceMax: number | null;
  availabilityState: string;
  freshnessState: string;
  lastObservedAt: string; // ISO 8601
};

/**
 * Every current offer for an item, across all of its variants, at every place.
 *
 * No radius and no expiry filter, on purpose: this is the whole picture for one
 * item, and each row carries its own `freshnessState` and `lastObservedAt` so
 * the page can date it honestly rather than hide the stale ones. That mirrors
 * `getPlaceOffers`, which also returns all current offers unfiltered; the
 * radius/expiry windowing belongs to the location-aware landing list, not here.
 *
 * Ordered by price so the cheapest market is first, which is the question an
 * item page answers.
 */
export async function getItemOffers(itemId: string): Promise<SeoItemOffer[]> {
  const rows = await db
    .select({
      offerId: offersCurrent.id,
      placeId: places.id,
      placeName: places.name,
      placeSlug: places.slug,
      variantName: itemVariants.displayName,
      unit: units.displayName,
      priceMin: offersCurrent.priceMin,
      priceMax: offersCurrent.priceMax,
      availabilityState: offersCurrent.availabilityState,
      freshnessState: offersCurrent.freshnessState,
      lastObservedAt: offersCurrent.lastObservedAt,
    })
    .from(offersCurrent)
    .innerJoin(itemVariants, eq(offersCurrent.itemVariantId, itemVariants.id))
    .innerJoin(places, eq(offersCurrent.placeId, places.id))
    .innerJoin(units, eq(offersCurrent.unitId, units.id))
    .where(eq(itemVariants.itemId, itemId))
    .orderBy(asc(offersCurrent.priceMin));

  return rows.map((r) => ({ ...r, lastObservedAt: r.lastObservedAt.toISOString() }));
}

export type SeoPlace = {
  id: string;
  slug: string;
  name: string;
  placeType: string;
  address: string | null;
  openingInformation: string | null;
  verificationStatus: string;
  lat: number;
  lng: number;
  areaName: string | null;
  areaSlug: string | null;
  areaType: string | null;
};

/**
 * One place by slug, with its area, or null.
 *
 * No `verificationStatus` filter, matching the sitemap's `place/[slug]` family
 * (its comment: "`unverified` is the DEFAULT, so filtering on it would silently
 * drop nearly the whole catalogue"). The page shows the status rather than
 * gating on it. `leftJoin(areas)` because the FK is notNull today, but a left
 * join keeps the page rendering if a place ever outlives its area row.
 */
export async function getPlaceBySlug(slug: string): Promise<SeoPlace | null> {
  const [row] = await db
    .select({
      id: places.id,
      slug: places.slug,
      name: places.name,
      placeType: places.placeType,
      address: places.address,
      openingInformation: places.openingInformation,
      verificationStatus: places.verificationStatus,
      location: places.location,
      areaName: areas.name,
      areaSlug: areas.slug,
      areaType: areas.type,
    })
    .from(places)
    .leftJoin(areas, eq(places.areaId, areas.id))
    .where(eq(places.slug, slug))
    .limit(1);

  if (!row) return null;
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    placeType: row.placeType,
    address: row.address,
    openingInformation: row.openingInformation,
    verificationStatus: row.verificationStatus,
    lat: row.location.lat,
    lng: row.location.lng,
    areaName: row.areaName,
    areaSlug: row.areaSlug,
    areaType: row.areaType,
  };
}

/** A current offer at one place. Prices in kobo. Carries `itemSlug` so the place
 *  page can link each price to its item page. */
export type SeoPlaceOffer = {
  offerId: string;
  itemName: string;
  itemSlug: string;
  variantName: string;
  unit: string;
  priceMin: number;
  priceMax: number | null;
  availabilityState: string;
  freshnessState: string;
  lastObservedAt: string; // ISO 8601
};

/**
 * Every current offer at a place. Mirrors `getPlaceOffers` (actions.ts) exactly,
 * adding `items.slug` for the outbound link. Ordered by item name so the list
 * reads like a price board.
 */
export async function getPlaceOffersForSeo(placeId: string): Promise<SeoPlaceOffer[]> {
  const rows = await db
    .select({
      offerId: offersCurrent.id,
      itemName: items.canonicalName,
      itemSlug: items.slug,
      variantName: itemVariants.displayName,
      unit: units.displayName,
      priceMin: offersCurrent.priceMin,
      priceMax: offersCurrent.priceMax,
      availabilityState: offersCurrent.availabilityState,
      freshnessState: offersCurrent.freshnessState,
      lastObservedAt: offersCurrent.lastObservedAt,
    })
    .from(offersCurrent)
    .innerJoin(itemVariants, eq(offersCurrent.itemVariantId, itemVariants.id))
    .innerJoin(items, eq(itemVariants.itemId, items.id))
    .innerJoin(units, eq(offersCurrent.unitId, units.id))
    .where(eq(offersCurrent.placeId, placeId))
    .orderBy(asc(items.canonicalName));

  return rows.map((r) => ({ ...r, lastObservedAt: r.lastObservedAt.toISOString() }));
}

/**
 * Slugs for `generateStaticParams`. These run at BUILD time, where the database
 * is reachable (the sitemap already queries it there). `active = true` for items
 * keeps the pre-rendered set in step with `getItemBySlug`; places have no active
 * flag, matching the sitemap's place family.
 *
 * A slug added after a build is not in this list; the routes keep `dynamicParams`
 * at its default (true), so a new item or place renders on first request and is
 * then cached like the rest.
 */
export async function allItemSlugs(): Promise<string[]> {
  const rows = await db.select({ slug: items.slug }).from(items).where(eq(items.active, true));
  return rows.map((r) => r.slug);
}

export async function allPlaceSlugs(): Promise<string[]> {
  const rows = await db.select({ slug: places.slug }).from(places);
  return rows.map((r) => r.slug);
}
