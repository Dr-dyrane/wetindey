"use server";

import { db } from "@/db";
import { items, itemAliases, itemVariants, places, offersCurrent, units, observations } from "@/db/schema";
import { eq, or, and, sql, asc } from "drizzle-orm";
import {
  parseSearchQuery,
  parsePopularItemsLimit,
  parsePlaceOffersPlaceId,
  parseOfferId,
  parseItemNarrowingOptions,
  parseOffersNarrowed,
} from "@/lib/validation";
import { FRESHNESS_POLICY, type TrustAssessment } from "@/lib/trust";
import { calculateCohortFoodPriceTrend, type CohortObservationPoint } from "@/core/food-trend";
import {
  getOfferTrustBatchImpl,
  nullableOfferKey,
  offerKeyOf,
  readTrustForKey,
  type OfferKey,
  type ReadTrust,
} from "./food-trust";

export type { OfferKey, ReadTrust } from "./food-trust";

export async function getOfferTrustBatch(
  keys: OfferKey[]
): Promise<Record<string, TrustAssessment>> {
  return getOfferTrustBatchImpl(keys);
}

export async function getOfferTrust(key: OfferKey): Promise<TrustAssessment> {
  const batch = await getOfferTrustBatch([key]);
  return batch[offerKeyOf(key)];
}

function searchOrigin(center: { lat: number; lng: number }) {
  if (
    !center ||
    !Number.isFinite(center.lat) ||
    !Number.isFinite(center.lng) ||
    Math.abs(center.lat) > 90 ||
    Math.abs(center.lng) > 180
  ) {
    throw new Error("Discovery: invalid search origin");
  }
  return sql`ST_SetSRID(ST_MakePoint(${center.lng}, ${center.lat}), 4326)`;
}

function searchRadiusMetres(radiusKm: number) {
  if (!Number.isFinite(radiusKm) || radiusKm <= 0 || radiusKm > 500) {
    throw new Error(`Discovery: invalid search radius ${radiusKm}km`);
  }
  return Math.round(radiusKm * 1000);
}

const DEFAULT_DETAIL_OFFER_LIMIT = 60;

export async function searchFoodItems(query: string) {
  return searchItems(query, "food");
}

export async function searchItems(
  query: string,
  category: string = "food",
  coords?: { lat: number; lng: number; radiusKm: number }
) {
  if (coords !== undefined) {
    const candidate = coords as unknown;
    if (
      candidate === null ||
      typeof candidate !== "object" ||
      !Object.prototype.hasOwnProperty.call(candidate, "lat") ||
      !Object.prototype.hasOwnProperty.call(candidate, "lng") ||
      !Object.prototype.hasOwnProperty.call(candidate, "radiusKm")
    ) {
      throw new Error("search: coordinates must include own lat, lng, and radiusKm values");
    }

    const { lat, lng, radiusKm } = candidate as {
      lat: unknown;
      lng: unknown;
      radiusKm: unknown;
    };
    if (
      typeof lat !== "number" ||
      typeof lng !== "number" ||
      typeof radiusKm !== "number" ||
      !Number.isFinite(lat) ||
      !Number.isFinite(lng) ||
      !Number.isFinite(radiusKm) ||
      Math.abs(lat) > 90 ||
      Math.abs(lng) > 180
    ) {
      throw new Error("search: coordinates are invalid");
    }

    coords = { lat, lng, radiusKm };
  }

  const parsed = parseSearchQuery(query);
  if (parsed.trim() === "") {
    return [];
  }

  const q = `%${parsed.trim()}%`;
  const useLocation = coords !== undefined;
  const searchPoint = coords === undefined ? sql`` : searchOrigin(coords);
  const radiusM = coords === undefined ? 0 : searchRadiusMetres(coords.radiusKm);

  const rows = await db.execute(sql`
    WITH matched_items AS (
      SELECT DISTINCT i.id
      FROM ${items} i
      LEFT JOIN ${itemAliases} ia ON ia.item_id = i.id
      WHERE i.active = true
        AND i.category = ${category}
        AND (
          i.canonical_name ILIKE ${q} OR
          i.slug ILIKE ${q} OR
          ia.alias ILIKE ${q}
        )
    ),
    live_observations AS (
      SELECT
        observation.id,
        variant.item_id,
        observation.item_variant_id,
        observation.unit_id,
        observation.place_id,
        observation.price_amount,
        observation.availability_state,
        observation.observed_at
      FROM ${observations} observation
      JOIN ${itemVariants} variant ON variant.id = observation.item_variant_id
      JOIN matched_items mi ON mi.id = variant.item_id
      JOIN ${units} observed_unit ON observed_unit.id = observation.unit_id
      JOIN ${places} observed_place ON observed_place.id = observation.place_id
      WHERE observation.moderation_status <> 'rejected'
        AND observation.provenance = 'observed'
        AND observation.observed_at >=
          now() - make_interval(hours => ${FRESHNESS_POLICY.expirationHours})
        AND observation.observed_at <= now()
        ${useLocation ? sql`AND ST_DWithin(observed_place.location, ${searchPoint}::geography, ${radiusM})` : sql``}
    ),
    live_offers AS (
      SELECT
        item_id,
        item_variant_id,
        unit_id,
        place_id,
        (MIN(price_amount) FILTER (
          WHERE availability_state = 'available'
        ))::int AS price_min,
        (MAX(price_amount) FILTER (
          WHERE availability_state = 'available'
        ))::int AS price_max,
        (array_agg(
          availability_state
          ORDER BY observed_at DESC, id ASC
        ))[1] AS availability_state,
        MAX(observed_at) AS last_observed_at,
        (array_agg(id ORDER BY observed_at DESC, id ASC))[1] AS latest_observation_id
      FROM live_observations
      GROUP BY item_id, item_variant_id, unit_id, place_id
    ),
    sample_current_offers AS (
      SELECT
        sample_offer.*,
        variant.item_id
      FROM ${offersCurrent} sample_offer
      JOIN ${itemVariants} variant ON variant.id = sample_offer.item_variant_id
      JOIN matched_items mi ON mi.id = variant.item_id
      JOIN ${places} sample_place ON sample_place.id = sample_offer.place_id
      WHERE sample_offer.expires_at > now()
        ${useLocation ? sql`AND ST_DWithin(sample_place.location, ${searchPoint}::geography, ${radiusM})` : sql``}
    ),
    offer_units AS (
      SELECT
        item_id,
        unit_id,
        COUNT(*) AS offers_in_unit
      FROM live_offers
      GROUP BY item_id, unit_id
    ),
    modal_unit AS (
      SELECT DISTINCT ON (item_id) item_id, unit_id
      FROM offer_units
      ORDER BY item_id, offers_in_unit DESC, unit_id
    ),
    sample_offer_units AS (
      SELECT
        item_id,
        unit_id,
        COUNT(*) AS offers_in_unit
      FROM sample_current_offers
      GROUP BY item_id, unit_id
    ),
    sample_modal_unit AS (
      SELECT DISTINCT ON (item_id) item_id, unit_id
      FROM sample_offer_units
      ORDER BY item_id, offers_in_unit DESC, unit_id
    ),
    effective_modal_unit AS (
      SELECT
        mi.id AS item_id,
        COALESCE(mu.unit_id, smu.unit_id) AS unit_id
      FROM matched_items mi
      LEFT JOIN modal_unit mu ON mu.item_id = mi.id
      LEFT JOIN sample_modal_unit smu ON smu.item_id = mi.id
      WHERE COALESCE(mu.unit_id, smu.unit_id) IS NOT NULL
    ),
    matched_current_offers AS (
      SELECT
        live_offers.item_id,
        live_offers.item_variant_id,
        live_offers.unit_id,
        live_offers.place_id,
        live_offers.price_min,
        live_offers.price_max,
        live_offers.availability_state,
        live_offers.last_observed_at,
        live_offers.latest_observation_id AS id
      FROM live_offers
      UNION ALL
      SELECT
        sample_current_offers.item_id,
        sample_current_offers.item_variant_id,
        sample_current_offers.unit_id,
        sample_current_offers.place_id,
        sample_current_offers.price_min,
        sample_current_offers.price_max,
        sample_current_offers.availability_state,
        sample_current_offers.last_observed_at,
        sample_current_offers.id
      FROM sample_current_offers
      WHERE NOT EXISTS (
        SELECT 1
        FROM live_offers
        WHERE live_offers.item_id = sample_current_offers.item_id
      )
    ),
    detail_places AS (
      SELECT
        o.item_id,
        COUNT(DISTINCT o.place_id)::int AS place_count
      FROM matched_current_offers o
      JOIN effective_modal_unit emu ON emu.item_id = o.item_id AND emu.unit_id = o.unit_id
      GROUP BY o.item_id
    )
    SELECT
      i.id, i.slug, i.canonical_name AS name, i.description,
      i.image_url, i.image_attribution, i.image_license, i.image_source_url,
      u.display_name                                   AS "unitLabel",
      COUNT(o.id)::int                                 AS "offerCount",
      COALESCE(dp.place_count, 0)::int                 AS "placeCount",
      MIN(o.price_min)::int                            AS "priceFrom",
      MAX(COALESCE(o.price_max, o.price_min))::int     AS "priceTo",
      (array_agg(o.item_variant_id ORDER BY o.last_observed_at DESC, o.id ASC))[1] AS "trustVariantId",
      (array_agg(o.unit_id ORDER BY o.last_observed_at DESC, o.id ASC))[1] AS "trustUnitId",
      (array_agg(o.place_id ORDER BY o.last_observed_at DESC, o.id ASC))[1] AS "trustPlaceId",
      (array_agg(o.availability_state ORDER BY o.last_observed_at DESC, o.id ASC))[1] AS "trustAvailabilityState",
      MAX(o.last_observed_at)                          AS "lastObservedAt"
    FROM ${items} i
    JOIN effective_modal_unit emu ON emu.item_id = i.id
    JOIN ${itemVariants}          v ON v.item_id = i.id
    JOIN matched_current_offers   o ON o.item_variant_id = v.id AND o.unit_id = emu.unit_id
    JOIN ${units}                 u ON u.id = emu.unit_id
    LEFT JOIN detail_places      dp ON dp.item_id = i.id
    WHERE i.active = true AND i.category = ${category}
    GROUP BY i.id, u.display_name, dp.place_count
    ORDER BY i.canonical_name ASC
  `);

  type Row = {
    id: string; slug: string; name: string; description: string | null;
    image_url: string | null; image_attribution: string | null;
    image_license: string | null; image_source_url: string | null;
    unitLabel: string; offerCount: number; placeCount: number;
    priceFrom: number | null; priceTo: number | null;
    trustVariantId: string; trustUnitId: string; trustPlaceId: string;
    trustAvailabilityState: string;
    lastObservedAt: Date | null;
  };

  const cardRows = rows.rows as unknown as Row[];
  const trustKeys = cardRows
    .map((row) => nullableOfferKey(row))
    .filter((key): key is OfferKey => key !== null);
  const trustByKey = await getOfferTrustBatch(trustKeys);

  return cardRows.map((r) => {
    const trustKey = nullableOfferKey(r);
    return {
      id: r.id,
      slug: r.slug,
      name: r.name,
      description: r.description,
      imageUrl: r.image_url,
      imageAttribution: r.image_attribution,
      imageLicense: r.image_license,
      imageSourceUrl: r.image_source_url,
      unitLabel: r.unitLabel,
      offerCount: r.offerCount,
      placeCount: r.placeCount,
      priceFrom: r.priceFrom ?? null,
      priceTo: r.priceTo ?? null,
      trust: readTrustForKey(trustByKey, trustKey, r.trustAvailabilityState),
      lastObservedAt: r.lastObservedAt ? new Date(r.lastObservedAt).toISOString() : null,
    };
  });
}

export async function getPopularItems(
  limitOrOptions: number | { lat: number; lng: number; radiusKm: number; category?: string; limit?: number } = 8,
  category: string = "food",
  coords?: { lat: number; lng: number; radiusKm: number }
) {
  let limit = 8;
  if (typeof limitOrOptions === "object" && limitOrOptions !== null) {
    coords = { lat: limitOrOptions.lat, lng: limitOrOptions.lng, radiusKm: limitOrOptions.radiusKm };
    category = limitOrOptions.category ?? "food";
    limit = parsePopularItemsLimit(limitOrOptions.limit ?? 8);
  } else {
    limit = parsePopularItemsLimit(limitOrOptions);
  }

  if (coords !== undefined) {
    const candidate = coords as unknown;
    if (
      candidate === null ||
      typeof candidate !== "object" ||
      !Object.prototype.hasOwnProperty.call(candidate, "lat") ||
      !Object.prototype.hasOwnProperty.call(candidate, "lng") ||
      !Object.prototype.hasOwnProperty.call(candidate, "radiusKm")
    ) {
      throw new Error("getPopularItems: coordinates must include own lat, lng, and radiusKm values");
    }

    const { lat, lng, radiusKm } = candidate as {
      lat: unknown;
      lng: unknown;
      radiusKm: unknown;
    };
    if (
      typeof lat !== "number" ||
      typeof lng !== "number" ||
      typeof radiusKm !== "number" ||
      !Number.isFinite(lat) ||
      !Number.isFinite(lng) ||
      !Number.isFinite(radiusKm) ||
      Math.abs(lat) > 90 ||
      Math.abs(lng) > 180
    ) {
      throw new Error("getPopularItems: coordinates are invalid");
    }

    coords = { lat, lng, radiusKm };
  }

  const useLocation = coords !== undefined;
  const origin = coords === undefined ? sql`` : searchOrigin(coords);
  const radiusM = coords === undefined ? 0 : searchRadiusMetres(coords.radiusKm);

  const rows = await db.execute(sql`
    WITH nearby AS (
      SELECT
        o.*,
        v.item_id
      FROM ${offersCurrent} o
      JOIN ${itemVariants} v ON v.id = o.item_variant_id
      JOIN ${places} pl ON pl.id = o.place_id
      WHERE o.expires_at > now()
        ${useLocation ? sql`AND ST_DWithin(pl.location, ${origin}::geography, ${radiusM})` : sql``}
    ),
    offer_units AS (
      SELECT
        item_id,
        unit_id,
        COUNT(*) AS offers_in_unit
      FROM nearby
      GROUP BY item_id, unit_id
    ),
    modal_unit AS (
      SELECT DISTINCT ON (item_id) item_id, unit_id
      FROM offer_units
      ORDER BY item_id, offers_in_unit DESC, unit_id
    ),
    detail_places AS (
      SELECT
        n.item_id,
        COUNT(DISTINCT n.place_id)::int AS place_count
      FROM nearby n
      JOIN modal_unit mu ON mu.item_id = n.item_id AND mu.unit_id = n.unit_id
      GROUP BY n.item_id
    )
    SELECT
      i.id, i.slug, i.canonical_name AS name, i.description,
      i.image_url, i.image_attribution, i.image_license, i.image_source_url,
      u.display_name                                   AS "unitLabel",
      COUNT(o.id)::int                                 AS "offerCount",
      COALESCE(dp.place_count, 0)::int                 AS "placeCount",
      MIN(o.price_min)::int                            AS "priceFrom",
      MAX(COALESCE(o.price_max, o.price_min))::int     AS "priceTo",
      (array_agg(o.item_variant_id ORDER BY o.last_observed_at DESC, o.id ASC))[1] AS "trustVariantId",
      (array_agg(o.unit_id ORDER BY o.last_observed_at DESC, o.id ASC))[1] AS "trustUnitId",
      (array_agg(o.place_id ORDER BY o.last_observed_at DESC, o.id ASC))[1] AS "trustPlaceId",
      (array_agg(o.availability_state ORDER BY o.last_observed_at DESC, o.id ASC))[1] AS "trustAvailabilityState",
      MAX(o.last_observed_at)                          AS "lastObservedAt"
    FROM ${items} i
    JOIN modal_unit  mu ON mu.item_id = i.id
    JOIN ${itemVariants}  v ON v.item_id = i.id
    JOIN nearby           o ON o.item_variant_id = v.id AND o.unit_id = mu.unit_id
    JOIN ${units}         u ON u.id = mu.unit_id
    LEFT JOIN detail_places dp ON dp.item_id = i.id
    WHERE i.active = true AND i.category = ${category}
    GROUP BY i.id, u.display_name, dp.place_count
    ORDER BY COUNT(o.id) DESC, i.canonical_name ASC
    LIMIT ${limit}
  `);

  type Row = {
    id: string; slug: string; name: string; description: string | null;
    image_url: string | null; image_attribution: string | null;
    image_license: string | null; image_source_url: string | null;
    unitLabel: string; offerCount: number; placeCount: number;
    priceFrom: number | null; priceTo: number | null;
    trustVariantId: string; trustUnitId: string; trustPlaceId: string;
    trustAvailabilityState: string;
    lastObservedAt: Date | null;
  };

  interface ObsRow {
    itemId: string;
    variantId: string;
    unitId: string;
    priceAmount: number;
    observedAt: string | Date;
    availabilityState: string;
    provenance: string;
    placeId: string;
    sourceId: string;
  }

  const cardRows = rows.rows as unknown as Row[];
  const trustKeys = cardRows
    .map((row) => nullableOfferKey(row))
    .filter((key): key is OfferKey => key !== null);
  const trustByKey = await getOfferTrustBatch(trustKeys);

  const cohortTuples = cardRows
    .filter((r) => r.trustVariantId && r.trustUnitId)
    .map((r) => ({ itemId: r.id, variantId: r.trustVariantId, unitId: r.trustUnitId }));

  const obsRows = cohortTuples.length > 0 ? await db.execute(sql`
    SELECT
      v.item_id               AS "itemId",
      o.item_variant_id       AS "variantId",
      o.unit_id               AS "unitId",
      o.price_amount          AS "priceAmount",
      o.observed_at           AS "observedAt",
      o.availability_state    AS "availabilityState",
      o.provenance            AS "provenance",
      o.place_id              AS "placeId",
      o.source_id             AS "sourceId"
    FROM ${observations} o
    JOIN ${itemVariants} v ON v.id = o.item_variant_id
    JOIN ${places} pl ON pl.id = o.place_id
    WHERE o.moderation_status = 'approved'
      AND o.availability_state = 'available'
      AND o.observed_at > now() - interval '14 days'
      AND ST_DWithin(pl.location, ${origin}::geography, ${radiusM})
      AND (${sql.join(
        cohortTuples.map((t) => sql`(o.item_variant_id = ${t.variantId} AND o.unit_id = ${t.unitId})`),
        sql` OR `
      )})
  `) : { rows: [] };

  const parsedObsRows = obsRows.rows as unknown as ObsRow[];
  const obsByItem = new Map<string, CohortObservationPoint[]>();

  for (const row of parsedObsRows) {
    const list = obsByItem.get(row.itemId) ?? [];
    list.push({
      priceAmount: Number(row.priceAmount),
      observedAt: new Date(row.observedAt),
      availabilityState: String(row.availabilityState),
      provenance: String(row.provenance),
      placeId: String(row.placeId),
      sourceId: String(row.sourceId),
    });
    obsByItem.set(row.itemId, list);
  }

  return cardRows.map((r) => {
    const trustKey = nullableOfferKey(r);
    const itemObs = obsByItem.get(r.id) ?? [];

    const observedPoints = itemObs.filter(
      (o) => o.provenance === "device" || o.provenance === "partner"
    );
    const syntheticPoints = itemObs.filter((o) => o.provenance === "synthetic");

    const observedTrend = calculateCohortFoodPriceTrend(observedPoints, "observed");
    const foodTrend =
      observedTrend.state !== "insufficient"
        ? observedTrend
        : calculateCohortFoodPriceTrend(syntheticPoints, "sample");

    return {
      id: r.id,
      slug: r.slug,
      name: r.name,
      description: r.description,
      imageUrl: r.image_url,
      imageAttribution: r.image_attribution,
      imageLicense: r.image_license,
      imageSourceUrl: r.image_source_url,
      unitLabel: r.unitLabel,
      offerCount: r.offerCount,
      placeCount: r.placeCount,
      priceFrom: r.priceFrom ?? null,
      priceTo: r.priceTo ?? null,
      trust: readTrustForKey(trustByKey, trustKey, r.trustAvailabilityState),
      lastObservedAt: r.lastObservedAt ? new Date(r.lastObservedAt).toISOString() : null,
      foodTrend,
    };
  });
}

export interface PlaceOffer {
  id: string;
  itemName: string;
  variantName: string;
  priceMin: number;
  priceMax?: number;
  unit: string;
  availabilityState: string;
  freshnessState: string;
  lastObservedAt: string;
  imageUrl: string | null;
  imageAttribution: string | null;
  imageLicense: string | null;
  imageSourceUrl: string | null;
  trust: ReadTrust | null;
}

export async function getPlaceOffers(placeId: string): Promise<PlaceOffer[]> {
  placeId = parsePlaceOffersPlaceId(placeId);
  const results = await db
    .select({
      offer: offersCurrent,
      itemName: items.canonicalName,
      unitName: units.displayName,
      variantName: itemVariants.displayName,
      imageUrl: items.imageUrl,
      imageAttribution: items.imageAttribution,
      imageLicense: items.imageLicense,
      imageSourceUrl: items.imageSourceUrl,
    })
    .from(offersCurrent)
    .innerJoin(itemVariants, eq(offersCurrent.itemVariantId, itemVariants.id))
    .innerJoin(items, eq(itemVariants.itemId, items.id))
    .innerJoin(units, eq(offersCurrent.unitId, units.id))
    .where(eq(offersCurrent.placeId, placeId))
    .orderBy(
      asc(items.canonicalName),
      asc(itemVariants.displayName),
      asc(units.displayName)
    );

  const trustByKey = await getOfferTrustBatch(
    results.map((result) => ({
      itemVariantId: result.offer.itemVariantId,
      unitId: result.offer.unitId,
      placeId: result.offer.placeId,
    }))
  );

  return results.map((result) => {
    const key = {
      itemVariantId: result.offer.itemVariantId,
      unitId: result.offer.unitId,
      placeId: result.offer.placeId,
    };

    return {
      id: result.offer.id,
      itemName: result.itemName,
      variantName: result.variantName,
      priceMin: result.offer.priceMin,
      priceMax: result.offer.priceMax ?? undefined,
      unit: result.unitName,
      availabilityState: result.offer.availabilityState,
      freshnessState: result.offer.freshnessState,
      lastObservedAt: result.offer.lastObservedAt.toISOString(),
      imageUrl: result.imageUrl,
      imageAttribution: result.imageAttribution,
      imageLicense: result.imageLicense,
      imageSourceUrl: result.imageSourceUrl,
      trust: readTrustForKey(
        trustByKey,
        key,
        result.offer.availabilityState
      ),
    };
  });
}

export async function getVisitContext(offerId: string) {
  offerId = parseOfferId(offerId);
  const [row] = await db
    .select({
      offerId: offersCurrent.id,
      placeId: places.id,
      placeName: places.name,
      itemVariantId: itemVariants.id,
      unitId: units.id,
      itemName: items.canonicalName,
      variantName: itemVariants.displayName,
      unitName: units.displayName,
      quotedPriceMin: offersCurrent.priceMin,
      quotedPriceMax: offersCurrent.priceMax,
      lastObservedAt: offersCurrent.lastObservedAt
    })
    .from(offersCurrent)
    .innerJoin(places, eq(offersCurrent.placeId, places.id))
    .innerJoin(itemVariants, eq(offersCurrent.itemVariantId, itemVariants.id))
    .innerJoin(items, eq(itemVariants.itemId, items.id))
    .innerJoin(units, eq(offersCurrent.unitId, units.id))
    .where(eq(offersCurrent.id, offerId))
    .limit(1);

  if (!row) throw new Error(`getVisitContext: no current offer with id ${offerId}`);

  return {
    offerId: row.offerId,
    placeId: row.placeId,
    placeName: row.placeName,
    itemVariantId: row.itemVariantId,
    unitId: row.unitId,
    itemName: row.itemName,
    variantName: row.variantName,
    unitName: row.unitName,
    quotedPriceMin: row.quotedPriceMin,
    quotedPriceMax: row.quotedPriceMax,
    quotedAt: row.lastObservedAt.toISOString()
  };
}

export async function submitVisitConfirmation(_data: {
  placeId: string;
  itemVariantId: string;
  unitId: string;
  wasAvailable: boolean;
  priceWasRight?: boolean;
  actualPrice?: number;
  didBuy?: boolean;
}) {
  throw new Error("Visit reports are temporarily unavailable while safety checks are added.");
}

export type OfferSort = "nearest" | "cheapest" | "freshest";

export interface NarrowingInput {
  itemId: string;
  variantId?: string | null;
  unitId?: string | null;
  center: { lat: number; lng: number };
  radiusKm: number;
  sort?: OfferSort;
  limit?: number;
}

export interface NarrowedOffer {
  id: string;
  placeId: string;
  placeName: string;
  placeType: string;
  address: string | null;
  lat: number;
  lng: number;
  distanceM: number;
  variantId: string;
  variantName: string;
  unitId: string;
  unitName: string;
  availabilityState: string;
  priceKind: string;
  priceMin: number;
  priceMax: number | null;
  currency: string;
  freshnessState: string;
  lastObservedAt: string;
  expiresAt: string;
  supportingObservationCount: number;
  distinctSourceCount: number;
  trust: ReadTrust;
}

const distinctSourceCount = sql<number>`(
  select count(distinct o.source_id)::int
  from ${observations} o
  where o.item_variant_id = ${offersCurrent.itemVariantId}
    and o.unit_id = ${offersCurrent.unitId}
    and o.place_id = ${offersCurrent.placeId}
    and o.moderation_status <> 'rejected'
)`;

export async function getItemNarrowingOptions(input: {
  itemId: string;
  center: { lat: number; lng: number };
  radiusKm: number;
}) {
  input = parseItemNarrowingOptions(input);

  const origin = searchOrigin(input.center);
  const radiusM = searchRadiusMetres(input.radiusKm);
  const withinRadius = sql`ST_DistanceSphere(${places.location}::geometry, ${origin}) <= ${radiusM}`;

  const [variantRows, unitRows] = await Promise.all([
    db
      .select({
        id: itemVariants.id,
        displayName: itemVariants.displayName,
        offerCount: sql<number>`count(${places.id})::int`,
        placeCount: sql<number>`count(distinct ${places.id})::int`,
        priceFrom: sql<number | null>`min(${offersCurrent.priceMin}) filter (where ${places.id} is not null)`,
      })
      .from(itemVariants)
      .leftJoin(offersCurrent, eq(offersCurrent.itemVariantId, itemVariants.id))
      .leftJoin(places, and(eq(places.id, offersCurrent.placeId), withinRadius))
      .where(and(eq(itemVariants.itemId, input.itemId), eq(itemVariants.active, true)))
      .groupBy(itemVariants.id)
      .orderBy(sql`count(distinct ${places.id}) desc, ${itemVariants.displayName} asc`),

    db
      .select({
        variantId: itemVariants.id,
        id: units.id,
        displayName: units.displayName,
        offerCount: sql<number>`count(${offersCurrent.id})::int`,
        placeCount: sql<number>`count(distinct ${places.id})::int`,
        priceFrom: sql<number | null>`min(${offersCurrent.priceMin})`,
      })
      .from(offersCurrent)
      .innerJoin(itemVariants, eq(offersCurrent.itemVariantId, itemVariants.id))
      .innerJoin(units, eq(offersCurrent.unitId, units.id))
      .innerJoin(places, eq(offersCurrent.placeId, places.id))
      .where(and(eq(itemVariants.itemId, input.itemId), eq(itemVariants.active, true), withinRadius))
      .groupBy(itemVariants.id, units.id)
      .orderBy(sql`count(distinct ${places.id}) desc, ${units.displayName} asc`),
  ]);

  return { variants: variantRows, units: unitRows };
}

export async function getOffersNarrowed(input: NarrowingInput): Promise<NarrowedOffer[]> {
  input = parseOffersNarrowed(input) as NarrowingInput;

  const sort: OfferSort = input.sort ?? "nearest";
  const limit = input.limit ?? DEFAULT_DETAIL_OFFER_LIMIT;
  const origin = searchOrigin(input.center);
  const radiusM = searchRadiusMetres(input.radiusKm);
  const distanceM = sql<number>`ST_DistanceSphere(${places.location}::geometry, ${origin})`;

  const filters = [
    eq(itemVariants.itemId, input.itemId),
    eq(itemVariants.active, true),
    sql`${distanceM} <= ${radiusM}`,
  ];
  if (input.variantId) filters.push(eq(offersCurrent.itemVariantId, input.variantId));
  if (input.unitId) filters.push(eq(offersCurrent.unitId, input.unitId));

  const ranking = {
    nearest: sql`${distanceM} asc, ${offersCurrent.priceMin} asc`,
    cheapest: sql`${offersCurrent.priceMin} asc, ${distanceM} asc`,
    freshest: sql`${offersCurrent.lastObservedAt} desc, ${distanceM} asc`,
  }[sort];

  const rows = await db
    .select({
      id: offersCurrent.id,
      placeId: places.id,
      placeName: places.name,
      placeType: places.placeType,
      address: places.address,
      location: places.location,
      distanceM,
      variantId: itemVariants.id,
      variantName: itemVariants.displayName,
      unitId: units.id,
      unitName: units.displayName,
      availabilityState: offersCurrent.availabilityState,
      priceKind: offersCurrent.priceKind,
      priceMin: offersCurrent.priceMin,
      priceMax: offersCurrent.priceMax,
      currency: offersCurrent.currency,
      freshnessState: offersCurrent.freshnessState,
      lastObservedAt: offersCurrent.lastObservedAt,
      expiresAt: offersCurrent.expiresAt,
      supportingObservationCount: offersCurrent.supportingObservationCount,
      distinctSourceCount,
    })
    .from(offersCurrent)
    .innerJoin(itemVariants, eq(offersCurrent.itemVariantId, itemVariants.id))
    .innerJoin(units, eq(offersCurrent.unitId, units.id))
    .innerJoin(places, eq(offersCurrent.placeId, places.id))
    .where(and(...filters))
    .orderBy(sql`(${offersCurrent.availabilityState} = 'unavailable') asc, ${ranking}, ${offersCurrent.id} asc`)
    .limit(limit);

  const trustKeys: OfferKey[] = rows.map((r) => ({
    itemVariantId: r.variantId,
    unitId: r.unitId,
    placeId: r.placeId,
  }));
  const trustByKey = await getOfferTrustBatch(trustKeys);

  return rows.map((r) => {
    if (!Number.isFinite(r.distanceM)) {
      throw new Error(`Discovery: no distance for place ${r.placeId} (${r.placeName})`);
    }
    const trustKey: OfferKey = {
      itemVariantId: r.variantId,
      unitId: r.unitId,
      placeId: r.placeId,
    };
    const trust = readTrustForKey(trustByKey, trustKey, r.availabilityState);
    if (!trust) {
      throw new Error(`Discovery: no trust assessment for offer ${r.id}`);
    }
    return {
      id: r.id,
      placeId: r.placeId,
      placeName: r.placeName,
      placeType: r.placeType,
      address: r.address,
      lat: r.location.lat,
      lng: r.location.lng,
      distanceM: r.distanceM,
      variantId: r.variantId,
      variantName: r.variantName,
      unitId: r.unitId,
      unitName: r.unitName,
      availabilityState: r.availabilityState,
      priceKind: r.priceKind,
      priceMin: r.priceMin,
      priceMax: r.priceMax,
      currency: r.currency,
      freshnessState: r.freshnessState,
      lastObservedAt: r.lastObservedAt.toISOString(),
      expiresAt: r.expiresAt.toISOString(),
      supportingObservationCount: r.supportingObservationCount,
      distinctSourceCount: r.distinctSourceCount,
      trust,
    };
  });
}
