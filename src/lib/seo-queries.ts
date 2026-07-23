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
 * Public offer facts come from immutable observations, never from the
 * provenance-flattened `offers_current` projection. The exported result is
 * discriminated so a sample number cannot accidentally enter metadata,
 * structured data, or a social card as an observed price.
 *
 * PRICES ARE KOBO. Nothing here divides by 100; callers format display values
 * with `formatNaira`, while `productJsonLd` performs the one JSON-LD conversion.
 */
import { db } from "@/db";
import {
  areas,
  items,
  itemVariants,
  observations,
  places,
  sources,
  units,
} from "@/db/schema";
import { and, eq, lte } from "drizzle-orm";
import {
  assessTrust,
  FRESHNESS_POLICY,
  type Availability,
  type ObservationProvenance,
  type TrustObservation,
} from "@/lib/trust";

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

type SeoObservedAvailability =
  | {
      kind: "available";
      price: {
        minKobo: number;
        maxKobo: number;
      };
    }
  | { kind: "unavailable" };

export type SeoObservedFacts = {
  observedAt: string;
  freshness: "fresh" | "stale";
  availability: SeoObservedAvailability;
};

type SeoItemOfferIdentity = {
  offerKey: string;
  placeId: string;
  placeName: string;
  placeSlug: string;
  variantName: string;
  unit: string;
};

export type SeoItemOffersResult =
  | {
      kind: "observed";
      offers: Array<SeoItemOfferIdentity & { facts: SeoObservedFacts }>;
    }
  | {
      kind: "sample";
      samples: Array<
        SeoItemOfferIdentity & {
          samplePrice: { minKobo: number; maxKobo: number };
        }
      >;
    }
  | { kind: "catalog" };

type EvidenceRow = {
  itemVariantId: string;
  unitId: string;
  placeId: string;
  availabilityState: string;
  priceAmount: number | null;
  currency: string;
  observedAt: Date;
  sourceId: string;
  sourceReliability: number;
  collectionMethod: string;
  provenance: unknown;
};

type EvidenceProjection<T extends EvidenceRow> =
  | {
      kind: "observed";
      offers: Array<{ row: T; facts: SeoObservedFacts }>;
    }
  | {
      kind: "sample";
      samples: Array<{
        row: T;
        samplePrice: { minKobo: number; maxKobo: number };
      }>;
    }
  | { kind: "catalog" };

const EXPIRATION_MS = FRESHNESS_POLICY.expirationHours * 3_600_000;

function provenanceOf(value: unknown): ObservationProvenance {
  switch (value) {
    case "synthetic":
    case "observed":
    case "partner":
    case "reference":
    case "inferred":
      return value;
    default:
      throw new Error(`seo: unknown observation provenance ${JSON.stringify(value)}`);
  }
}

function availabilityOf(value: string): Availability {
  if (value === "available" || value === "unavailable") return value;
  throw new Error(`seo: unknown observation availability ${JSON.stringify(value)}`);
}

function observedAtMillis(row: EvidenceRow): number {
  const value = row.observedAt.getTime();
  if (!Number.isFinite(value)) {
    throw new Error(`seo: undecodable observed_at ${String(row.observedAt)}`);
  }
  return value;
}

function requirePrice(row: EvidenceRow): number {
  if (
    row.currency !== "NGN" ||
    row.priceAmount === null ||
    !Number.isSafeInteger(row.priceAmount) ||
    row.priceAmount <= 0
  ) {
    throw new Error("seo: an available observation has no valid NGN price");
  }
  return row.priceAmount;
}

function evidenceKey(row: EvidenceRow): string {
  return `${row.itemVariantId}:${row.unitId}:${row.placeId}`;
}

function groupEvidence<T extends EvidenceRow>(rows: T[]): T[][] {
  const groups = new Map<string, T[]>();
  for (const row of rows) {
    const key = evidenceKey(row);
    const group = groups.get(key);
    if (group) group.push(row);
    else groups.set(key, [row]);
  }
  return [...groups.values()];
}

function trustObservation(row: EvidenceRow): TrustObservation {
  return {
    observedAt: row.observedAt,
    sourceId: row.sourceId,
    sourceReliability: row.sourceReliability,
    collectionMethod: row.collectionMethod,
    availabilityState: row.availabilityState,
    provenance: provenanceOf(row.provenance),
  };
}

function observedFacts(rows: EvidenceRow[], now: number): SeoObservedFacts | null {
  const observedRows = rows.filter((row) => provenanceOf(row.provenance) === "observed");
  if (observedRows.length === 0) return null;

  for (const row of observedRows) {
    const availability = availabilityOf(row.availabilityState);
    observedAtMillis(row);
    if (availability === "available") requirePrice(row);
  }

  const assessment = assessTrust(observedRows.map(trustObservation), now);
  if (assessment.freshness === "expired" || assessment.observationCount === 0) return null;

  const cutoff = now - EXPIRATION_MS;
  const currentRows = observedRows.filter((row) => observedAtMillis(row) >= cutoff);
  if (currentRows.length === 0) return null;

  const newestMillis = Math.max(...currentRows.map(observedAtMillis));
  const newestStates = new Set(
    currentRows
      .filter((row) => observedAtMillis(row) === newestMillis)
      .map((row) => availabilityOf(row.availabilityState)),
  );
  if (newestStates.size !== 1) {
    throw new Error("seo: equally recent observed rows disagree on availability");
  }

  const availability = [...newestStates][0];
  if (assessment.availability !== availability) {
    throw new Error("seo: observation assessment disagrees with newest availability");
  }

  const base = {
    observedAt: new Date(newestMillis).toISOString(),
    freshness: assessment.freshness,
  } as const;

  if (availability === "unavailable") {
    return { ...base, availability: { kind: "unavailable" } };
  }

  const prices = currentRows
    .filter((row) => availabilityOf(row.availabilityState) === "available")
    .map(requirePrice);

  return {
    ...base,
    availability: {
      kind: "available",
      price: {
        minKobo: Math.min(...prices),
        maxKobo: Math.max(...prices),
      },
    },
  };
}

function samplePrice(
  rows: EvidenceRow[],
): { minKobo: number; maxKobo: number } | null {
  for (const row of rows) {
    observedAtMillis(row);
    availabilityOf(row.availabilityState);
  }

  const newestMillis = Math.max(...rows.map(observedAtMillis));
  const newestStates = new Set(
    rows
      .filter((row) => observedAtMillis(row) === newestMillis)
      .map((row) => availabilityOf(row.availabilityState)),
  );
  if (newestStates.size !== 1) {
    throw new Error("seo: equally recent sample rows disagree on availability");
  }
  if ([...newestStates][0] === "unavailable") return null;

  const prices = rows
    .filter((row) => availabilityOf(row.availabilityState) === "available")
    .map(requirePrice);
  if (prices.length === 0) return null;
  return { minKobo: Math.min(...prices), maxKobo: Math.max(...prices) };
}

/**
 * Route-level publication policy:
 * - any live observed evidence publishes only observed offer keys;
 * - a wholly synthetic result may expose HTML-only sample values;
 * - every other origin mixture is catalog-only.
 *
 * Data faults also return catalog-only. A malformed or unknown row may remove
 * an offer claim, but it may never manufacture one.
 */
function projectEvidence<T extends EvidenceRow>(
  rows: T[],
  now: number = Date.now(),
): EvidenceProjection<T> {
  try {
    const provenances = rows.map((row) => provenanceOf(row.provenance));
    if (provenances.includes("observed")) {
      const offers = groupEvidence(rows)
        .filter((group) =>
          group.some((row) => provenanceOf(row.provenance) === "observed"),
        )
        .map((group) => {
          const facts = observedFacts(group, now);
          return facts ? { row: group[0], facts } : null;
        })
        .filter(
          (offer): offer is { row: T; facts: SeoObservedFacts } => offer !== null,
        );
      return offers.length > 0 ? { kind: "observed", offers } : { kind: "catalog" };
    }

    if (provenances.length > 0 && provenances.every((value) => value === "synthetic")) {
      const samples = groupEvidence(rows)
        .map((group) => {
          const price = samplePrice(group);
          return price ? { row: group[0], samplePrice: price } : null;
        })
        .filter(
          (
            sample,
          ): sample is {
            row: T;
            samplePrice: { minKobo: number; maxKobo: number };
          } => sample !== null,
        );
      return samples.length > 0 ? { kind: "sample", samples } : { kind: "catalog" };
    }

    return { kind: "catalog" };
  } catch {
    return { kind: "catalog" };
  }
}

/**
 * Public evidence for an item. Moderation admits only approved immutable
 * rows; provenance and freshness admission happen in `projectEvidence`.
 */
export async function getItemOffers(itemId: string): Promise<SeoItemOffersResult> {
  const now = new Date();
  const rows = await db
    .select({
      itemVariantId: observations.itemVariantId,
      unitId: observations.unitId,
      placeId: observations.placeId,
      placeName: places.name,
      placeSlug: places.slug,
      variantName: itemVariants.displayName,
      unit: units.displayName,
      availabilityState: observations.availabilityState,
      priceAmount: observations.priceAmount,
      currency: observations.currency,
      observedAt: observations.observedAt,
      sourceId: observations.sourceId,
      sourceReliability: sources.reliabilityScoreInternal,
      collectionMethod: observations.collectionMethod,
      provenance: observations.provenance,
    })
    .from(observations)
    .innerJoin(itemVariants, eq(observations.itemVariantId, itemVariants.id))
    .innerJoin(places, eq(observations.placeId, places.id))
    .innerJoin(units, eq(observations.unitId, units.id))
    .innerJoin(sources, eq(observations.sourceId, sources.id))
    .where(
      and(
        eq(itemVariants.itemId, itemId),
        eq(observations.moderationStatus, "approved"),
        lte(observations.observedAt, now),
      ),
    );

  const result = projectEvidence(rows, now.getTime());
  if (result.kind === "observed") {
    const offers = result.offers.map(({ row, facts }) => ({
      offerKey: evidenceKey(row),
      placeId: row.placeId,
      placeName: row.placeName,
      placeSlug: row.placeSlug,
      variantName: row.variantName,
      unit: row.unit,
      facts,
    }));
    offers.sort((left, right) => {
      const leftPrice =
        left.facts.availability.kind === "available"
          ? left.facts.availability.price.minKobo
          : Number.POSITIVE_INFINITY;
      const rightPrice =
        right.facts.availability.kind === "available"
          ? right.facts.availability.price.minKobo
          : Number.POSITIVE_INFINITY;
      return leftPrice - rightPrice || left.placeName.localeCompare(right.placeName);
    });
    return { kind: "observed", offers };
  }
  if (result.kind === "sample") {
    const samples = result.samples.map(({ row, samplePrice: price }) => ({
      offerKey: evidenceKey(row),
      placeId: row.placeId,
      placeName: row.placeName,
      placeSlug: row.placeSlug,
      variantName: row.variantName,
      unit: row.unit,
      samplePrice: price,
    }));
    samples.sort(
      (left, right) =>
        left.samplePrice.minKobo - right.samplePrice.minKobo ||
        left.placeName.localeCompare(right.placeName),
    );
    return { kind: "sample", samples };
  }
  return result;
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

type SeoPlaceOfferIdentity = {
  offerKey: string;
  itemName: string;
  itemSlug: string;
  variantName: string;
  unit: string;
};

export type SeoPlaceOffersResult =
  | {
      kind: "observed";
      offers: Array<SeoPlaceOfferIdentity & { facts: SeoObservedFacts }>;
    }
  | {
      kind: "sample";
      samples: Array<
        SeoPlaceOfferIdentity & {
          samplePrice: { minKobo: number; maxKobo: number };
        }
      >;
    }
  | { kind: "catalog" };

/**
 * Public evidence at a place, with the same admission and fail-closed result
 * contract as the item query.
 */
export async function getPlaceOffersForSeo(
  placeId: string,
): Promise<SeoPlaceOffersResult> {
  const now = new Date();
  const rows = await db
    .select({
      itemVariantId: observations.itemVariantId,
      unitId: observations.unitId,
      placeId: observations.placeId,
      itemName: items.canonicalName,
      itemSlug: items.slug,
      variantName: itemVariants.displayName,
      unit: units.displayName,
      availabilityState: observations.availabilityState,
      priceAmount: observations.priceAmount,
      currency: observations.currency,
      observedAt: observations.observedAt,
      sourceId: observations.sourceId,
      sourceReliability: sources.reliabilityScoreInternal,
      collectionMethod: observations.collectionMethod,
      provenance: observations.provenance,
    })
    .from(observations)
    .innerJoin(itemVariants, eq(observations.itemVariantId, itemVariants.id))
    .innerJoin(items, eq(itemVariants.itemId, items.id))
    .innerJoin(units, eq(observations.unitId, units.id))
    .innerJoin(sources, eq(observations.sourceId, sources.id))
    .where(
      and(
        eq(observations.placeId, placeId),
        eq(items.active, true),
        eq(observations.moderationStatus, "approved"),
        lte(observations.observedAt, now),
      ),
    );

  const result = projectEvidence(rows, now.getTime());
  if (result.kind === "observed") {
    const offers = result.offers.map(({ row, facts }) => ({
      offerKey: evidenceKey(row),
      itemName: row.itemName,
      itemSlug: row.itemSlug,
      variantName: row.variantName,
      unit: row.unit,
      facts,
    }));
    offers.sort(
      (left, right) =>
        left.itemName.localeCompare(right.itemName) ||
        left.variantName.localeCompare(right.variantName),
    );
    return { kind: "observed", offers };
  }
  if (result.kind === "sample") {
    const samples = result.samples.map(({ row, samplePrice: price }) => ({
      offerKey: evidenceKey(row),
      itemName: row.itemName,
      itemSlug: row.itemSlug,
      variantName: row.variantName,
      unit: row.unit,
      samplePrice: price,
    }));
    samples.sort(
      (left, right) =>
        left.itemName.localeCompare(right.itemName) ||
        left.variantName.localeCompare(right.variantName),
    );
    return { kind: "sample", samples };
  }
  return result;
}

/**
 * Index policy, in one predicate, read by every surface that decides it.
 *
 * A route is indexable exactly when its public offers resolve to OBSERVED
 * evidence. `sample` (wholly synthetic), `catalog`, and every fail-closed case
 * are non-indexable: the page still renders and still carries its Sample labels
 * and JSON-LD gating untouched, it is only kept out of the index while its
 * sole data is not observed. The sitemap's family gate and each page's `robots`
 * directive both call this, so the two surfaces cannot disagree about which
 * slugs are indexable, and both flip automatically the moment observed data
 * lands (ADR-015: Sample is never live coverage).
 */
export function isObservedOffers(
  result: SeoItemOffersResult | SeoPlaceOffersResult,
): boolean {
  return result.kind === "observed";
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
