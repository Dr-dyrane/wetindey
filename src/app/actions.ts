"use server";

import { db } from "@/db";
import { areas, items, itemAliases, itemVariants, places, offersCurrent, units, observations, sources, problemReports, userProfiles, reviews, reviewAggregates } from "@/db/schema";
import { eq, ilike, or, and, sql, gte, isNull, isNotNull, asc, desc } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import {
  parseSubmitObservation,
  parseVisitConfirmation,
  parseSearchQuery,
  parsePopularItemsLimit,
  parsePlaceOffersPlaceId,
  parseContactPolicyPlaceId,
  parseOfferId,
  parseItemNarrowingOptions,
  parseOffersNarrowed,
  parsePlacesNear,
  parseCoverageForPoint,
  parseSubmitProblemReport,
  parseUpdateMyProfile,
  parseSubmitReview,
} from "@/lib/validation";
import { auth } from "@/lib/auth";
import { put, del } from "@vercel/blob";
import {
  assessTrust,
  legacyFreshnessState,
  FRESHNESS_POLICY,
  type TrustAssessment,
  type TrustObservation,
} from "@/lib/trust";

export interface ReadTrust {
  confidenceScore: number;
  band: TrustAssessment["band"];
  freshness: TrustAssessment["freshness"];
  availability: TrustAssessment["availability"] | null;
  ageHours: number | null;
  distinctSourceCount: number;
  observationCount: number;
  provenanceSummary: TrustAssessment["provenanceSummary"];
  explanation: string;
  status: "confirmed" | "caution" | "unavailable";
  origin: "observed" | "synthetic" | "inadmissible" | "empty";
  provenanceLabel: string;
}

function toReadTrust(
  assessment: TrustAssessment,
  fallbackAvailability: string | null
): ReadTrust {
  const { provenanceSummary } = assessment;
  const origin: ReadTrust["origin"] =
    provenanceSummary.observed > 0
      ? "observed"
      : provenanceSummary.synthetic > 0
        ? "synthetic"
        : provenanceSummary.partner +
              provenanceSummary.reference +
              provenanceSummary.inferred >
            0
          ? "inadmissible"
          : "empty";

  let availability: ReadTrust["availability"] =
    origin === "observed" ? assessment.availability : null;
  if (origin !== "observed" && fallbackAvailability !== null) {
    if (fallbackAvailability !== "available" && fallbackAvailability !== "unavailable") {
      throw new Error(
        `Trust DTO: unknown fallback availability ${JSON.stringify(fallbackAvailability)}`
      );
    }
    availability = fallbackAvailability;
  }

  return {
    confidenceScore: assessment.confidenceScore,
    band: assessment.band,
    freshness: assessment.freshness,
    availability,
    ageHours: Number.isFinite(assessment.ageHours) ? assessment.ageHours : null,
    distinctSourceCount: assessment.distinctSourceCount,
    observationCount: assessment.observationCount,
    provenanceSummary,
    explanation: assessment.explanation,
    origin,
    provenanceLabel:
      origin === "observed"
        ? "Observed reports"
        : origin === "synthetic"
          ? "Sample"
          : "No observed reports",
    status:
      origin !== "observed"
        ? "caution"
        : assessment.availability === "unavailable"
          ? "unavailable"
          : assessment.freshness === "fresh"
            ? "confirmed"
            : "caution",
  };
}

function nullableOfferKey(row: {
  trustVariantId: string | null;
  trustUnitId: string | null;
  trustPlaceId: string | null;
}): OfferKey | null {
  if (!row.trustVariantId || !row.trustUnitId || !row.trustPlaceId) return null;
  return {
    itemVariantId: row.trustVariantId,
    unitId: row.trustUnitId,
    placeId: row.trustPlaceId,
  };
}

function readTrustForKey(
  assessments: Record<string, TrustAssessment>,
  key: OfferKey | null,
  fallbackAvailability: string | null
): ReadTrust | null {
  if (!key) return toReadTrust(assessTrust([]), fallbackAvailability);
  const assessment = assessments[offerKeyOf(key)];
  return assessment ? toReadTrust(assessment, fallbackAvailability) : null;
}

/** Shape shared by every item the UI renders in a list or grid. */
const itemCard = {
  id: items.id,
  slug: items.slug,
  name: items.canonicalName,
  description: items.description,
  imageUrl: items.imageUrl,
  imageAttribution: items.imageAttribution,
  imageLicense: items.imageLicense,
  imageSourceUrl: items.imageSourceUrl,
};

const DEFAULT_DETAIL_OFFER_LIMIT = 60;

// 1. Search food items in the database (deprecated - use searchItems)
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

    // Normalize accepted runtime input before it reaches query construction.
    coords = { lat, lng, radiusKm };
  }

  // Before the empty check, not after: a non-string caller reaches `.trim()`
  // first and dies on "trim is not a function", a 500 for what is really a
  // rejected input. Empty stays legal; the search box clears on every keystroke.
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
      /*
       * Search facts cross the same V1 admission boundary as trust: only
       * non-rejected, directly observed reports inside the shared expiry
       * window. Joining every dimension here makes the persisted
       * (variant, unit, place) relationship the fact source; offers_current is
       * not evidence and cannot admit another provenance by projection.
       */
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
      /*
       * Preserve offer semantics while reading the immutable evidence table:
       * repeated reports for one triple form one live offer. Price range uses
       * only admitted rows, and newest-observation-wins availability has an
       * observation-id tie-break so every selected context is deterministic.
       */
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
    fallback_candidates AS (
      /*
       * A variant has no intrinsic unit. The persisted relationship is the
       * (variant, unit, place) triple on a real observation. Grouping all
       * non-rejected, nonfuture history for that triple lets fallback ordering
       * distinguish observed trust history, non-synthetic inadmissible evidence,
       * and a genuinely synthetic-only sample without offers_current.
       */
      SELECT
        variant.item_id,
        fallback_observation.item_variant_id,
        fallback_observation.unit_id,
        fallback_observation.place_id,
        BOOL_OR(fallback_observation.provenance = 'observed') AS has_observed,
        BOOL_OR(fallback_observation.provenance = 'synthetic') AS has_synthetic,
        BOOL_OR(
          fallback_observation.provenance IN ('partner', 'reference', 'inferred')
        ) AS has_other_inadmissible,
        COUNT(*) FILTER (
          WHERE fallback_observation.provenance = 'observed'
        )::int AS observed_count,
        COUNT(*) FILTER (
          WHERE fallback_observation.provenance = 'synthetic'
        )::int AS synthetic_count,
        COUNT(*) FILTER (
          WHERE fallback_observation.provenance = 'partner'
        )::int AS partner_count,
        COUNT(*) FILTER (
          WHERE fallback_observation.provenance = 'reference'
        )::int AS reference_count,
        COUNT(*) FILTER (
          WHERE fallback_observation.provenance = 'inferred'
        )::int AS inferred_count,
        MAX(fallback_observation.observed_at) AS newest_admissible_context_at
      FROM ${observations} fallback_observation
      JOIN ${itemVariants} variant
        ON variant.id = fallback_observation.item_variant_id
      JOIN matched_items mi ON mi.id = variant.item_id
      JOIN ${units} fallback_unit
        ON fallback_unit.id = fallback_observation.unit_id
      JOIN ${places} fallback_place
        ON fallback_place.id = fallback_observation.place_id
      WHERE fallback_observation.moderation_status <> 'rejected'
        AND fallback_observation.observed_at <= now()
        AND (
          fallback_observation.provenance <> 'observed'
          OR fallback_observation.observed_at >= now() - interval '144 hours'
        )
        ${useLocation ? sql`AND ST_DWithin(fallback_place.location, ${searchPoint}::geography, ${radiusM})` : sql``}
      GROUP BY
        variant.item_id,
        fallback_observation.item_variant_id,
        fallback_observation.unit_id,
        fallback_observation.place_id
    ),
    fallback_relationship AS (
      /*
       * Historical observed context wins so ADR-006 can continue decaying it
       * through 144h. With no observed context, non-synthetic inadmissible
       * evidence wins over synthetic, preventing Sample from masking a mixed
       * inadmissible item. UUID ordering makes the selected triple stable.
       */
      SELECT DISTINCT ON (item_id)
        item_id,
        item_variant_id,
        unit_id,
        place_id,
        has_observed,
        has_synthetic,
        has_other_inadmissible,
        observed_count,
        synthetic_count,
        partner_count,
        reference_count,
        inferred_count,
        newest_admissible_context_at
      FROM fallback_candidates
      ORDER BY
        item_id,
        CASE
          WHEN has_observed THEN 0
          WHEN has_other_inadmissible THEN 1
          WHEN has_synthetic THEN 2
          ELSE 3
        END,
        newest_admissible_context_at DESC,
        item_variant_id ASC,
        unit_id ASC,
        place_id ASC
    ),
    fallback_trust_context AS (
      /*
       * Only admitted observed triples reopen the authoritative trust reader.
       * The mapping receives exact provenance counts for synthetic and pure
       * inadmissible context, while mixed synthetic/inadmissible rows remain
       * withheld so they cannot become Sample.
       */
      SELECT
        fallback.item_id,
        fallback.item_variant_id,
        fallback.unit_id,
        fallback.place_id,
        fallback.has_observed,
        fallback.has_synthetic,
        fallback.has_other_inadmissible,
        fallback.observed_count,
        fallback.synthetic_count,
        fallback.partner_count,
        fallback.reference_count,
        fallback.inferred_count
      FROM fallback_relationship fallback
      WHERE fallback.has_observed
        OR NOT (
          fallback.has_synthetic
          AND fallback.has_other_inadmissible
        )
    ),
    resolved_unit AS (
      SELECT 
        mi.id AS item_id,
        COALESCE(mu.unit_id, fallback.unit_id) AS unit_id
      FROM matched_items mi
      LEFT JOIN modal_unit mu ON mu.item_id = mi.id
      LEFT JOIN fallback_relationship fallback ON fallback.item_id = mi.id
    )
    SELECT
      i.id, i.slug, i.canonical_name AS name, i.description,
      i.image_url, i.image_attribution, i.image_license, i.image_source_url,
      u.display_name                                   AS "unitLabel",
      COALESCE(COUNT(o.item_variant_id), 0)::int       AS "offerCount",
      COALESCE(COUNT(DISTINCT o.place_id), 0)::int     AS "placeCount",
      MIN(o.price_min)::int                            AS "priceFrom",
      MAX(COALESCE(o.price_max, o.price_min))::int     AS "priceTo",
      COALESCE(
        (array_agg(
          o.item_variant_id
          ORDER BY o.last_observed_at DESC NULLS LAST, o.latest_observation_id ASC
        ) FILTER (WHERE o.item_variant_id IS NOT NULL))[1],
        fallback_trust.item_variant_id
      ) AS "trustVariantId",
      COALESCE(
        (array_agg(
          o.unit_id
          ORDER BY o.last_observed_at DESC NULLS LAST, o.latest_observation_id ASC
        ) FILTER (WHERE o.item_variant_id IS NOT NULL))[1],
        fallback_trust.unit_id
      ) AS "trustUnitId",
      COALESCE(
        (array_agg(
          o.place_id
          ORDER BY o.last_observed_at DESC NULLS LAST, o.latest_observation_id ASC
        ) FILTER (WHERE o.item_variant_id IS NOT NULL))[1],
        fallback_trust.place_id
      ) AS "trustPlaceId",
      (array_agg(
        o.availability_state
        ORDER BY o.last_observed_at DESC NULLS LAST, o.latest_observation_id ASC
      ) FILTER (WHERE o.item_variant_id IS NOT NULL))[1] AS "trustAvailabilityState",
      COALESCE(BOOL_OR(o.item_variant_id IS NOT NULL), false) AS "hasLiveTrust",
      COALESCE(fallback_trust.has_observed, false) AS "fallbackHasObserved",
      COALESCE(fallback_trust.has_synthetic, false) AS "fallbackHasSynthetic",
      COALESCE(
        fallback_trust.has_other_inadmissible,
        false
      ) AS "fallbackHasOtherInadmissible",
      COALESCE(fallback_trust.observed_count, 0)::int AS "fallbackObservedCount",
      COALESCE(fallback_trust.synthetic_count, 0)::int AS "fallbackSyntheticCount",
      COALESCE(fallback_trust.partner_count, 0)::int AS "fallbackPartnerCount",
      COALESCE(fallback_trust.reference_count, 0)::int AS "fallbackReferenceCount",
      COALESCE(fallback_trust.inferred_count, 0)::int AS "fallbackInferredCount",
      MAX(o.last_observed_at)                          AS "lastObservedAt"
    FROM matched_items mi
    JOIN ${items} i ON i.id = mi.id
    JOIN resolved_unit ru ON ru.item_id = i.id
    JOIN ${units} u ON u.id = ru.unit_id
    LEFT JOIN live_offers o ON o.item_id = i.id AND o.unit_id = ru.unit_id
    LEFT JOIN fallback_trust_context fallback_trust ON fallback_trust.item_id = i.id
    GROUP BY
      i.id,
      u.display_name,
      fallback_trust.item_variant_id,
      fallback_trust.unit_id,
      fallback_trust.place_id,
      fallback_trust.has_observed,
      fallback_trust.has_synthetic,
      fallback_trust.has_other_inadmissible,
      fallback_trust.observed_count,
      fallback_trust.synthetic_count,
      fallback_trust.partner_count,
      fallback_trust.reference_count,
      fallback_trust.inferred_count
    ORDER BY
      COUNT(o.item_variant_id) DESC,
      i.canonical_name ASC,
      i.slug ASC,
      i.id ASC
    LIMIT 10
  `);

  type Row = {
    id: string; slug: string; name: string; description: string | null;
    image_url: string | null; image_attribution: string | null;
    image_license: string | null; image_source_url: string | null;
    unitLabel: string; offerCount: number; placeCount: number;
    priceFrom: number | null; priceTo: number | null;
    trustVariantId: string | null; trustUnitId: string | null; trustPlaceId: string | null;
    trustAvailabilityState: string | null;
    hasLiveTrust: boolean;
    fallbackHasObserved: boolean;
    fallbackHasSynthetic: boolean;
    fallbackHasOtherInadmissible: boolean;
    fallbackObservedCount: number;
    fallbackSyntheticCount: number;
    fallbackPartnerCount: number;
    fallbackReferenceCount: number;
    fallbackInferredCount: number;
    lastObservedAt: Date | null;
  };

  const cardRows = rows.rows as unknown as Row[];
  const trustKeys = cardRows.flatMap((row) => {
    const key = nullableOfferKey(row);
    return key && (row.hasLiveTrust || row.fallbackHasObserved) ? [key] : [];
  });
  const trustByKey = await getOfferTrustBatch(trustKeys);

  const classifiedFallbackTrust = (row: Row): ReadTrust | null => {
    if (
      row.hasLiveTrust ||
      row.fallbackHasObserved ||
      (!row.fallbackHasSynthetic && !row.fallbackHasOtherInadmissible) ||
      (row.fallbackHasSynthetic && row.fallbackHasOtherInadmissible)
    ) {
      return null;
    }

    return toReadTrust(
      {
        ...assessTrust([]),
        provenanceSummary: {
          observed: row.fallbackObservedCount,
          synthetic: row.fallbackSyntheticCount,
          partner: row.fallbackPartnerCount,
          reference: row.fallbackReferenceCount,
          inferred: row.fallbackInferredCount,
        },
      },
      null
    );
  };

  return cardRows.map((r) => {
    const trustKey = nullableOfferKey(r);
    const fallbackTrust = classifiedFallbackTrust(r);
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
      trust: fallbackTrust ?? readTrustForKey(trustByKey, trustKey, r.trustAvailabilityState),
      lastObservedAt: r.lastObservedAt ? new Date(r.lastObservedAt).toISOString() : null,
    };
  });
}

/**
 * Items to show on the landing surface before the user has searched anything ,
 * RANKED BY WHAT IS ACTUALLY NEAR THE USER.
 *
 * The location arguments are the whole point. This function used to take only a
 * `limit`: it ranked every offer in the database and returned the same eight
 * items no matter where you stood, while the header above it read "Popular items
 * around Yaba". The app is a map of what food costs NEAR YOU, and its primary
 * list was the one surface that ignored where you were. Standing in Festac (168
 * offers within 5 km) and standing in Yaba (260) produced byte-identical rows
 * drawn from all 492, each labelled with the area you had just picked.
 *
 * That is not a ranking bug, it is the app telling the user something untrue on
 * the first screen they see. A price for a stall 13 km away is not an answer to
 * "what does rice cost around here".
 *
 * ST_DWithin on the geography column is metres on the spheroid and uses the
 * GIST index on places.location, so the filter is both correct and cheap.
 */
export async function getPopularItems(input: {
  lat: number;
  lng: number;
  radiusKm: number;
  category?: string;
  limit?: number;
}) {
  const { lat, lng, radiusKm, category = "food" } = input;
  // Only the limit is gated here. There is no `popularItemsInput` schema, the
  // validators were written when this action took a bare limit, and it grew a
  // coordinate since. lat/lng/radiusKm are checked below by searchOrigin and
  // searchRadiusMetres; the cap is the part nothing else enforces.
  const limit = parsePopularItemsLimit(input.limit ?? 8);
  const origin = searchOrigin({ lat, lng });
  const radiusM = searchRadiusMetres(radiusKm);
  /**
   * The price range is computed WITHIN A SINGLE UNIT, the one the item is most
   * commonly sold in, and the unit is returned so the card can name it.
   *
   * The obvious version, min(priceMin)/max(priceMax) grouped by item, is wrong
   * the moment an item has variants in different units. It quoted "Palm Oil
   * (1L)" at ₦1,454–₦49,476 because the cheap end was a 1L bottle and the dear
   * end a 25L keg: arithmetically fine, factually meaningless, and it made the
   * whole product look fake to anyone who buys palm oil. Pepper did the same
   * across a paint bucket and a basket.
   *
   * That bug was invisible while the seed had exactly one variant per item. It
   * only appeared once the taxonomy became real, which is the argument for the
   * richer seed.
   *
   * A true price-per-litre comparison is possible, units.canonicalQuantity
   * exists for it and is read by nothing, but normalising across a keg and a
   * bottle still hides that they are different purchases. Naming the unit is the
   * honest answer; normalisation is a product decision.
   */
  const rows = await db.execute(sql`
    WITH nearby AS (
      /*
       * Every offer whose PLACE is within the radius AND whose price anyone has
       * actually seen recently. Everything below draws only from here, so both
       * facts are established once and cannot be forgotten by a later join.
       *
       * expires_at > now() is the half that was missing, and it is the read-path
       * twin of the band bug. Windowing submitObservation fixed what gets WRITTEN;
       * priceMin is STORED, so a row whose evidence aged out kept its number and
       * this query kept quoting it. Measured before the filter: 54 item variants
       * could quote a floor from a price nobody had reported in over 72 hours,
       * uncaveated, as "from ₦X" on a landing card. The number was real once. The
       * card presents it as current.
       *
       * A recompute cannot fix this. It repairs rows that HAVE fresh evidence; a
       * row with none keeps its last band by design, price_min is NOT NULL, so
       * there is no "no band" to write, and the freshness badge is what makes that
       * band honest at the point it is read. An aggregate has nowhere to put a
       * badge, so an aggregate must not include it.
       */
      SELECT o.*
      FROM ${offersCurrent} o
      JOIN ${places} pl ON pl.id = o.place_id
      WHERE o.expires_at > now()
        AND ST_DWithin(
          pl.location,
          ${origin}::geography,
          ${radiusM}
        )
    ),
    offer_units AS (
      SELECT
        ${items.id}         AS item_id,
        n.unit_id           AS unit_id,
        COUNT(n.id)         AS offers_in_unit
      FROM ${items}
      JOIN ${itemVariants} ON ${itemVariants.itemId} = ${items.id}
      JOIN nearby n        ON n.item_variant_id = ${itemVariants.id}
      WHERE ${items.active} = true AND ${items.category} = ${category}
      GROUP BY ${items.id}, n.unit_id
    ),
    modal_unit AS (
      -- The unit this item is most often sold in NEARBY. The radius has to be
      -- inside this CTE, not only in the outer query: picking the modal unit
      -- from the whole country and then filtering to the radius can leave an
      -- item whose local stalls all sell a different unit showing zero prices.
      -- Ties break on unit_id so the choice is stable between calls.
      SELECT DISTINCT ON (item_id) item_id, unit_id
      FROM offer_units
      ORDER BY item_id, offers_in_unit DESC, unit_id
    ),
    detail_candidates AS (
      /*
       * The card's price stays tied to its fresh modal unit, but its place
       * count is the detail sheet's initial visible window. getOffersNarrowed
       * starts unfiltered by variant or unit, includes unavailable and expired
       * offers, orders unavailable last then nearest/cheapest, and returns only
       * DEFAULT_DETAIL_OFFER_LIMIT rows. ROW_NUMBER applies that same window
       * independently to every popular item before venues are deduplicated.
       *
       * ST_DistanceSphere does not use the geography GiST expression used by
       * nearby's ST_DWithin. That cost is accepted only at the current pilot
       * scale because this predicate must exactly match the visible detail
       * window; revisit the shared distance contract before scaling this read.
       */
      SELECT
        iv.item_id,
        o.place_id,
        ROW_NUMBER() OVER (
          PARTITION BY iv.item_id
          ORDER BY
            (o.availability_state = 'unavailable') ASC,
            ST_DistanceSphere(pl.location::geometry, ${origin}) ASC,
            o.price_min ASC,
            o.id ASC
        ) AS candidate_rank
      FROM ${offersCurrent} o
      JOIN ${itemVariants} iv ON iv.id = o.item_variant_id
      JOIN ${places} pl ON pl.id = o.place_id
      WHERE iv.active = true
        AND ST_DistanceSphere(pl.location::geometry, ${origin}) <= ${radiusM}
    ),
    detail_places AS (
      SELECT
        item_id,
        COUNT(DISTINCT place_id)::int AS place_count
      FROM detail_candidates
      WHERE candidate_rank <= ${DEFAULT_DETAIL_OFFER_LIMIT}
      GROUP BY item_id
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

// 2. Fetch candidates/offers for a selected food item

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
  placeId = parsePlaceOffersPlaceId(placeId);
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

/* ─────────────────────────────────────────────────────────────────────────────
   WHO SAID IT, resolving a contribution to a source row.

   ADR-003's condition, in one function. Every contribution used to funnel into
   the single shared "Contributor" row, so `distinct_source_count` was
   structurally 1 per writer and `assessTrust` weighted a reliability score that
   could not vary. The account existed and the domain never asked about it.

   The rule, and it is inviolable: NO SESSION IS NOT AN ERROR. Anonymous
   contribution is the product's default and ADR-003 keeps it working, an
   unattributed report weighs less, it is never refused. Identity is
   recognition, never a gate.
   ──────────────────────────────────────────────────────────────────────────── */

/**
 * What a recognised contributor's own source row scores at birth.
 *
 * Signing in proves one thing: an email address received a code. That is a weak
 * claim about a person but a real claim about CONTINUITY, the row accumulates a
 * history, and it can be moderated, corrected, or banned. An anonymous POST
 * offers none of that.
 *
 * It is deliberately NOT the top of the scale. Signing in must not mint
 * "verified": that is a fact a moderator establishes about a contributor, and if
 * an OTP could manufacture it, the word would mean nothing. There is no
 * moderator surface yet, so nothing in this codebase may write above this number
 * today.
 *
 * THIS NUMBER IS ONLY HALF OF A DECISION, and the other half is data this change
 * cannot touch. See `anonymousContributorSourceId()`, the shared anonymous row
 * is seeded at 98, the highest score in the table, which makes an anonymous
 * stranger the most reliable source WetinDey has. Until that row comes down,
 * this constant is below it and signing in weighs LESS than not signing in.
 * That inversion is a data fault, not a code one, and it is called out in the
 * handover as a prerequisite of the release rather than papered over here with a
 * number chosen to win an inequality.
 */
const RECOGNISED_CONTRIBUTOR_RELIABILITY = 75;

/**
 * The shared anonymous row for app contributions, the fallback when there is no
 * session, and the row every contribution resolved to before ADR-003.
 *
 * `user_id IS NULL` is load-bearing, not decoration. Per-user rows carry the
 * SAME `source_type` of 'Contributor' (the category is unchanged by ADR-003 ,
 * only the attribution is new), so the old lookup, which matched on
 * `source_type` alone with `.limit(1)`, would now be free to return some
 * signed-in stranger's personal source row and file an anonymous report against
 * their name. The NULL predicate is what keeps "anonymous" and "a specific
 * person" from being the same query.
 */
async function anonymousContributorSourceId(): Promise<string> {
  const [row] = await db
    .select({ id: sources.id })
    .from(sources)
    .where(and(eq(sources.sourceType, "Contributor"), isNull(sources.userId)))
    .limit(1);

  if (!row) throw new Error("Default anonymous Contributor source not configured in database.");
  return row.id;
}

/**
 * The source row this contribution belongs to: the caller's own if they are
 * signed in, the shared anonymous row if they are not.
 *
 * The session is read SERVER-SIDE, here, inside the Server Action. page.tsx
 * reads it client-side through `authClient.useSession()` for a different and
 * non-transferable reason, Neon's `getSession` refreshes the session cookie,
 * and a Server Component may not write cookies. A Server Action may. Copying
 * page.tsx's pattern into the write path would hand the client authority over
 * who it claims to be, which is the one thing attribution cannot allow.
 *
 * A visit confirmation and a form fill from the same person resolve to the SAME
 * row on purpose. Which of the two is worth more is answered by
 * `collection_method` (COLLECTION_METHOD_WEIGHTS in src/lib/trust.ts:85, a
 * visit outranks a sofa), not by minting a second identity for one human. That
 * was already this file's reasoning when both paths shared the 'Contributor'
 * row; ADR-003 changes who the row belongs to, not that reasoning.
 */
async function contributorSourceId(): Promise<string> {
  const { data: session } = await auth.getSession();
  const userId = session?.user?.id;

  /**
   * The anonymous path. Unchanged behaviour, and the default the product is
   * built for, most reports will always arrive this way.
   *
   * This branch also absorbs an auth OUTAGE, deliberately: `getSession` returns
   * `{ data: null, error }` when the Neon Auth service cannot be reached, and a
   * signed-in contributor's report is then filed anonymously rather than
   * refused. That is the correct trade in both directions, we do not claim to
   * know who someone is when we could not check, and we do not drop a price
   * somebody walked to a market to tell us because a third party is down.
   * Losing the attribution costs that one report some weight; losing the report
   * costs everyone the price.
   */
  if (!userId) return anonymousContributorSourceId();

  /**
   * Find-or-create, serialised per user.
   *
   * "One source row per user" is an invariant this path OWNS: `sources.user_id`
   * carries no unique constraint (see src/db/schema/index.ts:270-282, the
   * column is nullable and every anonymous row holds NULL, so a plain UNIQUE
   * index would not express it). A bare select-then-insert is therefore a race,
   * and losing it is not cosmetic: two rows for one person is that person
   * counting twice in `distinct_source_count`, which is precisely the sofa the
   * trust model exists to refuse. Two tabs, two reports, one human, "2 different
   * sources".
   *
   * The transaction-scoped advisory lock closes it. `hashtext` collisions
   * between two different user ids are possible and harmless, the cost is that
   * one resolve briefly waits for another, never that either gets a wrong
   * answer. The lock releases with the transaction, including on error.
   *
   * A partial unique index (`WHERE user_id IS NOT NULL`) would enforce this in
   * the database and defend it against a second writer that never calls this
   * function. It is requested from the schema lane in the handover; this lock is
   * correct on its own, and the index would be defence in depth rather than a
   * replacement for it.
   */
  return await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${userId}))`);

    const [existing] = await tx
      .select({ id: sources.id })
      .from(sources)
      .where(eq(sources.userId, userId))
      .limit(1);

    if (existing) return existing.id;

    const [created] = await tx
      .insert(sources)
      .values({
        sourceType: "Contributor",
        userId,
        reliabilityScoreInternal: RECOGNISED_CONTRIBUTOR_RELIABILITY,
      })
      .returning({ id: sources.id });

    return created.id;
  });
}

/**
 * Every observation backing one offer that the trust model may look at.
 *
 * `moderation_status = 'approved'`, the same filter the price band uses below,
 * so that one write derives its band and its trust level from ONE evidence set.
 * Two filters would let this function call an offer 'high' on the strength of a
 * report the band refused to price.
 *
 * NOT windowed by time, deliberately, and this is not an oversight: age is
 * `assessTrust`'s own job. It decays every observation by `ageDecay` and reaches
 * zero at `expirationHours * 2` (src/lib/trust.ts:225-230). Pre-filtering to
 * `expirationHours` here would discard evidence the model still scores as
 * partially alive, a second freshness policy competing with the real one. The
 * band is windowed because a band is a NUMBER WE PUBLISH; trust is a judgement
 * about all of it.
 */
async function offerEvidence(key: OfferKey): Promise<TrustObservation[]> {
  return await db
    .select({
      observedAt: observations.observedAt,
      sourceId: observations.sourceId,
      sourceReliability: sources.reliabilityScoreInternal,
      collectionMethod: observations.collectionMethod,
      availabilityState: observations.availabilityState,
      provenance: observations.provenance,
    })
    .from(observations)
    .innerJoin(sources, eq(observations.sourceId, sources.id))
    .where(
      and(
        eq(observations.itemVariantId, key.itemVariantId),
        eq(observations.unitId, key.unitId),
        eq(observations.placeId, key.placeId),
        eq(observations.moderationStatus, "approved")
      )
    );
}

// 5. Submit crowdsourced food price observations and recalculate offers_current
export async function submitObservation(data: {
  itemVariantId: string;
  unitId: string;
  placeId: string;
  priceAmount: number; // in Naira
  availabilityState: "available" | "unavailable";
}) {
  /**
   * A Next.js server action is a PUBLIC HTTP ENDPOINT. Anyone can POST to it.
   *
   * That sentence used to end ", there is no auth in this app", and the second
   * half is now out of date without weakening the first by one inch. This
   * function resolves a session (see `contributorSourceId`), but auth here is
   * RECOGNITION, NOT A GATE: ADR-003 keeps anonymous contribution working, so an
   * unauthenticated POST is still a supported, expected, first-class way to
   * reach this line. Signing in changes how much a report WEIGHS. It changes
   * nothing about who may send one, and it must never be mistaken for the thing
   * standing between this endpoint and the open internet. That is still zod, and
   * only zod.
   *
   * Until this line existed, `priceAmount` went straight from an anonymous
   * request into `Math.round(n * 100)` below and into the price band every other
   * user reads. A ₦900,000,000 rice report is not a typo; it is an attack, and
   * it poisons the band for everyone.
   *
   * The schema also refuses (0,0) coordinates BY NAME wherever it sees them.
   * That is the Gulf-of-Guinea scar: (0,0) is what a zeroed or half-parsed
   * coordinate looks like, never what a device reports.
   *
   * Validation cannot be bolted on by appending a wrapper, which is why the
   * security department could not wire this itself: a server action's ID binds
   * to the original exported function reference, so a same-named export
   * appended later is simply never called. It has to happen here, inside the
   * function the client actually reaches.
   */
  const input = parseSubmitObservation(data);
  data = input;

  // Who is filing this: their own source row, or the shared anonymous one.
  const sourceId = await contributorSourceId();

  const now = new Date();
  const koboPrice = Math.round(input.priceAmount * 100);

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
      provenance: "observed",
      /**
       * Still hardcoded, and left that way ON PURPOSE.
       *
       * `trust_level` below is now DERIVED, that was an engineering answer
       * wearing a hardcoded costume, and it had a model to come from. This is
       * not the same kind of thing. Moderation is a decision A MODERATOR makes,
       * and this product has no moderator, no queue, and no surface on which to
       * review anything. Deriving it from `assessTrust` would only rename the
       * hardcode: a score is not a review.
       *
       * The honest alternatives are both worse today. Writing 'pending' with
       * nobody to approve it files every contribution into a queue that is never
       * read, and since the band and the trust model below both admit only
       * 'approved' rows, it would silently stop the app from learning anything
       * from its users at all. Writing 'approved' says what is actually true:
       * this app accepts what it is told.
       *
       * That is a real exposure, not a resolved one (949/949 rows sit here), and
       * it is escalated in the handover rather than dressed up. What defends the
       * write path today is validation (src/lib/validation.ts) and, from Phase 2,
       * the device-cookie rate limit, HOW OFTEN, where the source row above
       * answers WHO. ADR-003 is explicit that the two are separate defences and
       * that neither substitutes for the other.
       */
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

  const expiresAt = new Date(now.getTime() + FRESHNESS_POLICY.expirationHours * 3600 * 1000);

  /**
   * The price band, from the observations that are still admissible.
   *
   * This query is the fix for the worst bug in the repo. Its predecessor was
   * named `recentObs` and selected EVERY observation for this triple ever
   * recorded, the name was the only true thing about it. Three filters were
   * missing and each one was a different bug:
   *
   *   TIME. A price from any point in history pinned the floor forever. The
   *     comment above this function already promised "recent"; now the code
   *     agrees. The window is FRESHNESS_POLICY.expirationHours from
   *     src/lib/trust.ts, imported, never re-typed. The 72 was already written
   *     out by hand in three places, and a fourth copy is how the app and the
   *     backfill quietly come to disagree about what "fresh" means. Measured
   *     against the live database when this was written: 223 observations older
   *     than the window were still pinning bands, the oldest from 2026-07-10,
   *     and 62 of 398 fresh offer groups (15.6%) showed an all-time band that
   *     the last 72h of evidence did not support.
   *
   *   MODERATION. A rejected report priced the offer. This filter is a NO-OP
   *     TODAY, every one of the 949 rows in the live table is 'approved',
   *     because the insert above hardcodes it and nothing rejects anything. It
   *     is added anyway, and that is the whole point: the day a moderator can
   *     reject a row is the day its absence would become silent, permanent, and
   *     invisible to every test written before then. The code cannot show you
   *     this constraint is live; this comment is where it is recorded that it
   *     is deliberately ahead of its enforcement.
   *
   *   AGGREGATION. `Math.min(...prices)` spread the whole array across the
   *     argument stack. Fine at a few hundred rows, a RangeError at a large
   *     enough one, and `observations` is immutable and only ever grows, so
   *     "large enough" is a matter of time, not of chance. MIN/MAX are what a
   *     database is for; this now ships two integers back instead of every price
   *     ever reported.
   *
   * Filters and shape match scripts/recompute-bands.mjs exactly, that script
   * repairs the bands this bug already wrote, and the two are a pair. If they
   * disagreed about what a band IS, the backfill would fight the write path
   * every time somebody reported a price.
   */
  const bandCutoff = new Date(now.getTime() - FRESHNESS_POLICY.expirationHours * 3600 * 1000);

  const [band] = await db
    .select({
      min: sql<number | null>`min(${observations.priceAmount})::int`,
      max: sql<number | null>`max(${observations.priceAmount})::int`,
    })
    .from(observations)
    .where(
      and(
        eq(observations.itemVariantId, data.itemVariantId),
        eq(observations.unitId, data.unitId),
        eq(observations.placeId, data.placeId),
        // A sold-out report carries no price and must not price the offer.
        eq(observations.availabilityState, "available"),
        isNotNull(observations.priceAmount),
        eq(observations.moderationStatus, "approved"),
        gte(observations.observedAt, bandCutoff)
      )
    );

  /**
   * The fallback is `koboPrice`, the price just reported, and it is reachable
   * only when this submission is itself 'unavailable', because an 'available'
   * one is always inside its own window and its own band. It is the behaviour
   * that was here before and it is preserved rather than quietly improved:
   * `price_min` is NOT NULL (src/db/schema/index.ts:343), so "no band" is not a
   * state this table can hold, and inventing a better answer for it is a schema
   * decision, not a filter decision. Flagged in the handover.
   */
  let priceMin = koboPrice;
  let priceMax: number | undefined = undefined;
  let priceKind = "Exact";

  if (band?.min != null) {
    priceMin = band.min;
    if (band.max != null && band.max > band.min) {
      priceMax = band.max;
      priceKind = "Range";
    }
  }

  /**
   * `trust_level` and `freshness_state`, DERIVED, the reason this lane exists.
   *
   * They were the literals 'high' and 'confirmed'. Every offer in the product
   * therefore claimed maximum trust the instant anyone typed into it, which made
   * the column a decoration: a field that always says "high" carries no
   * information. The model that should have been answering has existed in
   * src/lib/trust.ts the whole time with no caller (`getOfferTrustBatch` was
   * written to rescue it and was itself orphaned). This is its first live write
   * site.
   *
   * `assessTrust` runs AFTER the insert above, so the report being filed right
   * now is part of the evidence it weighs, the freshness it returns is this
   * observation's own, and `legacyFreshnessState` collapses it back onto the
   * single column the schema still has (:381 explains what that collapse loses,
   * and why the loss is an argument for a migration rather than for routing
   * around it here).
   */
  const assessment = assessTrust(
    await offerEvidence({
      itemVariantId: data.itemVariantId,
      unitId: data.unitId,
      placeId: data.placeId,
    }),
    now.getTime()
  );

  const trustLevel = assessment.band;
  const freshnessState = legacyFreshnessState(assessment.freshness, assessment.availability);

  if (existingOffer.length > 0) {
    const offer = existingOffer[0];

    await db
      .update(offersCurrent)
      .set({
        availabilityState: data.availabilityState,
        priceKind,
        priceMin,
        priceMax: priceMax || null,
        freshnessState,
        trustLevel,
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
      priceKind,
      priceMin,
      priceMax: priceMax || null,
      freshnessState,
      trustLevel,
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

/* ─────────────────────────────────────────────────────────────────────────────
   THE TRUST LOOP

   Everything above this line is a price lookup. What follows asks the only
   person who actually knows, the one who went, whether the answer we gave was
   true, and folds it back into offers_current so the next lookup is better.
   ──────────────────────────────────────────────────────────────────────────── */

// 7. Snapshot the claim a user is about to go and test.
//
// Called on the way OUT ("Go there"), not on the way back. Someone returning
// from a market is the least likely person in the product to have a connection,
// so the question they are asked on their return must already be in their hand
// before they leave. The caller stashes this and hands it to ConfirmVisitSheet.
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

  // No fallback. A visit context we cannot build is a question we cannot ask
  // honestly, an empty or half-filled one would submit an observation against
  // the wrong variant, which is a plausible wrong answer of exactly the kind
  // that hides for months.
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

/**
 * Record that someone physically went, and what they found.
 *
 * Three answers, mapped onto the existing data model:
 *
 *   was it there      → observations.availability_state
 *   was the price right → the observation's price (theirs, or the quote they confirmed)
 *   did you buy it    → observations.raw_payload (no column exists for it)
 *
 * The priced paths delegate to `submitObservation` rather than reimplementing
 * the offer recalculation: the price-bound maths, the freshness window and the
 * supporting-count increment are the trust model, and two copies of a trust
 * model is two trust models. The one thing delegation cannot express is that
 * this datum came from a pair of feet rather than a sofa, so the observation is
 * annotated with that immediately afterwards. See the blockers note: the clean
 * fix is for submitObservation to accept collectionMethod / sourceId /
 * observedAt, at which point the annotation step disappears.
 */
export async function submitVisitConfirmation(data: {
  placeId: string;
  itemVariantId: string;
  unitId: string;
  /** Was the item actually there? */
  wasAvailable: boolean;
  /** Required when wasAvailable. Meaningless otherwise. */
  priceWasRight?: boolean;
  /** Naira. Required when priceWasRight === false. */
  actualPrice?: number;
  /** Required when wasAvailable. Meaningless otherwise, you cannot buy what is not there. */
  didBuy?: boolean;
}) {
  /**
   * The back door. This action checks `actualPrice` is finite and positive but
   * had NO CEILING, and it delegates to submitObservation, so it could push
   * the exact ₦900,000,000 report that the front door now refuses. A validated
   * front door and an unvalidated back door is an unvalidated endpoint.
   *
   * `.strict()` also matters here: `didBuy` lands in observations.raw_payload,
   * a jsonb column, so an unknown key is stored verbatim. A multi-megabyte
   * object would be written without complaint.
   *
   * What this CANNOT fix, and what no schema can: the "it wasn't there" branch
   * below flips an offer to 'unavailable' on one POST. A competitor can blank a
   * rival stall's inventory with a perfectly well-formed payload.
   *
   * Half of that sentence used to read "AND trustLevel 'high'". That half is
   * fixed: the branch now derives its trust level from `assessTrust`, so a lone
   * anonymous report no longer announces itself as certain. THE BLANKING ITSELF
   * IS UNCHANGED, and identity does not close it either, ADR-003 says so
   * outright. Accounts answer WHO; the flip needs an answer to HOW OFTEN, which
   * is Phase 2's device-cookie rate limit, explicitly NOT superseded by this
   * work. Two separate holes, two separate defences; do not let the presence of
   * one read as cover for the other.
   */
  const input = parseVisitConfirmation(data);
  data = input as typeof data;

  const now = new Date();

  /* ── "It wasn't there" ─────────────────────────────────────────────────────
     Written directly, because submitObservation requires a price and there is
     no price to give. Passing the last known one would file a number the user
     never saw into an immutable log, a fabricated datum. The offer update here
     is genuinely different logic rather than a duplicate: no price maths runs
     at all, and the price bounds are deliberately left alone, because "not
     there right now" says nothing about what it costs when it comes back. */
  if (!data.wasAvailable) {
    const sourceId = await contributorSourceId();

    const [newObs] = await db
      .insert(observations)
      .values({
        itemVariantId: data.itemVariantId,
        unitId: data.unitId,
        placeId: data.placeId,
        availabilityState: "unavailable",
        priceAmount: null,
        observedAt: now,
        sourceId,
        collectionMethod: "visit_confirmation",
        provenance: "observed",
        moderationStatus: "approved",
        rawPayload: { kind: "visit_confirmation", wasAvailable: false }
      })
      .returning();

    const [offer] = await db
      .select({ id: offersCurrent.id })
      .from(offersCurrent)
      .where(
        and(
          eq(offersCurrent.itemVariantId, data.itemVariantId),
          eq(offersCurrent.unitId, data.unitId),
          eq(offersCurrent.placeId, data.placeId)
        )
      )
      .limit(1);

    // Nothing to update is a legitimate outcome, the offer may have expired
    // out from under the visit. The observation still stands on its own.
    if (!offer) return { success: true, observationId: newObs.id, offerUpdated: false };

    /**
     * Derived, for the same reason submitObservation's is, and with the same
     * limit, which must not be overstated.
     *
     * `trust_level` was the literal 'high' here: one unauthenticated POST could
     * blank a rival stall's inventory AND label the blanking maximally
     * trustworthy. Deriving it means a lone anonymous report now scores like a
     * lone anonymous report instead of announcing itself as certain.
     *
     * IT DOES NOT CLOSE THE HOLE, and nothing in this change does. The
     * availability flip still happens on one POST; only the confidence attached
     * to it becomes honest. ADR-003 is explicit that identity is NECESSARY AND
     * NOT SUFFICIENT here, accounts answer WHO, and Phase 2's device-cookie
     * rate limit answers HOW OFTEN. The rate limit is not superseded by this
     * work and must not be dropped on the strength of it.
     *
     * `freshness_state` comes out of the same collapse rather than being written
     * by hand: the newest observation is the sold-out report just inserted, so
     * `legacyFreshnessState` returns 'unavailable', the same value that used to
     * be hardcoded, now for a reason the model can state.
     */
    const assessment = assessTrust(
      await offerEvidence({
        itemVariantId: data.itemVariantId,
        unitId: data.unitId,
        placeId: data.placeId,
      }),
      now.getTime()
    );

    await db
      .update(offersCurrent)
      .set({
        availabilityState: "unavailable",
        freshnessState: legacyFreshnessState(assessment.freshness, assessment.availability),
        trustLevel: assessment.band,
        lastObservedAt: now,
        expiresAt: new Date(now.getTime() + FRESHNESS_POLICY.expirationHours * 3600 * 1000),
        // Reset, not increment. The count exists to say how many observations
        // back the CURRENT state, and the state just flipped, every report
        // that supported "available" supports nothing now. Note this differs
        // from submitObservation, which increments unconditionally; that is
        // flagged in the blockers as a model question, not settled here.
        supportingObservationCount: 1,
        updatedAt: now
      })
      .where(eq(offersCurrent.id, offer.id));

    return { success: true, observationId: newObs.id, offerUpdated: true };
  }

  /* ── "It was there" ─────────────────────────────────────────────────────── */
  let priceNaira: number;

  if (data.priceWasRight === false) {
    if (typeof data.actualPrice !== "number" || !Number.isFinite(data.actualPrice) || data.actualPrice <= 0) {
      throw new Error("submitVisitConfirmation: 'the price was different' requires the price they actually saw.");
    }
    priceNaira = data.actualPrice;
  } else if (data.priceWasRight === true) {
    // Read the confirmed figure from the server rather than trusting a number
    // round-tripped through the client: the user tapped "yes, that's it", and
    // what "it" is must be whatever the database currently claims.
    const [offer] = await db
      .select({ priceMin: offersCurrent.priceMin })
      .from(offersCurrent)
      .where(
        and(
          eq(offersCurrent.itemVariantId, data.itemVariantId),
          eq(offersCurrent.unitId, data.unitId),
          eq(offersCurrent.placeId, data.placeId)
        )
      )
      .limit(1);

    if (!offer) {
      throw new Error("submitVisitConfirmation: there is no current offer here to confirm the price of.");
    }
    priceNaira = offer.priceMin / 100;
  } else {
    throw new Error("submitVisitConfirmation: priceWasRight is required when the item was available.");
  }

  const res = await submitObservation({
    itemVariantId: data.itemVariantId,
    unitId: data.unitId,
    placeId: data.placeId,
    priceAmount: priceNaira,
    availabilityState: "available"
  });

  // Annotate what delegation could not carry: that this came from a visit, and
  // whether the trip ended in a purchase. `did_buy` has no column, and the
  // conversion signal is worth more than the schema change it is waiting on.
  await db
    .update(observations)
    .set({
      collectionMethod: "visit_confirmation",
      rawPayload: {
        kind: "visit_confirmation",
        wasAvailable: true,
        priceWasRight: data.priceWasRight,
        didBuy: data.didBuy ?? null
      }
    })
    .where(eq(observations.id, res.observationId));

  return { success: true, observationId: res.observationId, offerUpdated: true };
}

/* ───────────────────────────────────────────────────────────────────────────
   7. Discovery, narrowing an item down to a unit, then to nearby offers.

   USER-FLOW calls for rice → Long-grain rice → 50 kg bag → offers. The taxonomy
   was already in the database and already walked by the report form; the search
   path jumped straight from an item to every offer in the country and sorted by
   a distance computed client-side. The two actions below do that narrowing, and
   do the distance and the radius in PostGIS instead.
   ────────────────────────────────────────────────────────────────────────── */

export type OfferSort = "nearest" | "cheapest" | "freshest";

export interface NarrowingInput {
  itemId: string;
  /** null = every type of this item. */
  variantId?: string | null;
  /** null = every packaging size. */
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
  /** Great-circle metres from the search origin, straight out of PostGIS. */
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
  /** offers_current's own tally, how many reports back this price. */
  supportingObservationCount: number;
  /**
   * How many DISTINCT sources filed those reports. This is the number that
   * actually carries trust: `supportingObservationCount * 10`, what the old
   * detail panel showed as a percentage, reads ten reports from one person as
   * 100% confidence. Two people saying the same thing is evidence; one person
   * saying it ten times is not.
  */
  distinctSourceCount: number;
  /** Authoritative, age-decayed assessment derived from admissible observations. */
  trust: ReadTrust;
}

/** Reject an origin we cannot trust rather than quietly searching from it. */
function searchOrigin(center: { lat: number; lng: number }) {
  if (
    !center ||
    !Number.isFinite(center.lat) ||
    !Number.isFinite(center.lng) ||
    Math.abs(center.lat) > 90 ||
    Math.abs(center.lng) > 180
  ) {
    throw new Error(`Discovery: invalid search origin ${JSON.stringify(center)}`);
  }
  return sql`ST_SetSRID(ST_MakePoint(${center.lng}, ${center.lat}), 4326)`;
}

function searchRadiusMetres(radiusKm: number) {
  if (!Number.isFinite(radiusKm) || radiusKm <= 0 || radiusKm > 500) {
    throw new Error(`Discovery: invalid search radius ${radiusKm}km`);
  }
  return Math.round(radiusKm * 1000);
}

/**
 * Distinct sources behind one offer's price.
 *
 * `moderation_status <> 'rejected'` rather than `= 'approved'` on purpose: the
 * seeder inserts observations without a moderation status, so they all sit at
 * the column default of 'pending'. Counting only approved rows would report
 * zero sources for every offer in the pilot database, a plausible-looking
 * "no evidence" that is really a schema default, not a fact about the data.
 */
const distinctSourceCount = sql<number>`(
  select count(distinct o.source_id)::int
  from ${observations} o
  where o.item_variant_id = ${offersCurrent.itemVariantId}
    and o.unit_id = ${offersCurrent.unitId}
    and o.place_id = ${offersCurrent.placeId}
    and o.moderation_status <> 'rejected'
)`;

/**
 * The variants and units this item is actually sold in WITHIN the radius, with
 * the counts behind each choice.
 *
 * Counts are scoped to the same origin and radius as the offer list, so the
 * narrowing controls can never promise "12 prices" and then hand back a list of
 * three. Variants with nothing nearby still come back, with a count of zero, so
 * the UI can show them as unavailable rather than pretend they do not exist.
 */
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
    // The radius lives in the JOIN, not the WHERE: a variant with no nearby
    // offer must still surface (count 0) instead of vanishing from the picker.
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

    // Units only exist as a choice where an offer exists, so these are inner
    // joins. variantId rides along so the client can re-filter without a trip.
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

/**
 * Offers for an item, narrowed by variant and unit, ranked, and cut to a radius.
 *
 * Distance and the radius cut both happen in PostGIS via the SAME expression:
 * mixing ST_DWithin (spheroid) for the filter with ST_DistanceSphere (sphere)
 * for the displayed number differs by up to ~0.3%, which is enough to list a
 * row as "5.0 km away" inside a 5 km radius it was measured out of.
 *
 * Unavailable offers always sink to the bottom whatever the sort: availability
 * is a fact about the row, not a preference about the ordering.
 */
export async function getOffersNarrowed(input: NarrowingInput): Promise<NarrowedOffer[]> {
  input = parseOffersNarrowed(input) as NarrowingInput;

  // `sort` now comes from an enum, which is what keeps the lookup below on the
  // object's OWN keys. Unvalidated, `sort: "toString"` hits Object.prototype and
  // resolves to a function, and the failure is quieter than it looks: Drizzle
  // binds it as a parameter, so Postgres runs `ORDER BY $1` with null, returns
  // rows, and drops the ordering. Not injection, a wrong answer wearing a
  // plausible face, which is the failure this codebase exists to refuse.
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
    // The (0,0) incident: a place that cannot be located is not a place we can
    // rank by distance, so it fails loudly rather than sorting first forever.
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

// ─────────────────────────────────────────────────────────────────────────────
// 7. Location
//
// Everything below treats the radius as a real constraint rather than a number
// the settings slider owns and nothing reads. `getPlacesNear` filters in
// PostGIS with ST_DWithin on the geography column, so the database returns the
// places inside the radius instead of the client fetching the whole table and
// discovering the distance afterwards.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build an EWKT literal for a user-supplied coordinate.
 *
 * Validates rather than clamps. A latitude of 200 is not a location that needs
 * rounding down, it is a bug upstream, and the whole reason every place in this
 * app once sat in the Gulf of Guinea is that a bad coordinate was quietly given
 * a plausible value instead of raising. Throw.
 *
 * The result is interpolated into SQL as a single bound text parameter via
 * ST_GeogFromText, the numbers are proven finite before they get here, and
 * they never reach the query as anything but a parameter.
 */
function toEwkt(lat: number, lng: number): string {
  const ok =
    Number.isFinite(lat) && Number.isFinite(lng) &&
    lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
  if (!ok) {
    throw new Error(`Invalid coordinate: lat=${lat}, lng=${lng}`);
  }
  return `SRID=4326;POINT(${lng} ${lat})`;
}

export interface AreaSummary {
  id: string;
  slug: string;
  name: string;
  lat: number;
  lng: number;
  placeCount: number;
  coverageStatus: string;
}


/** One LGA and the neighbourhoods inside it. */
export interface AreaGroup {
  lgaSlug: string;
  lgaName: string;
  areas: AreaSummary[];
}

/** What the location picker needs: the settled context, and the real choices. */
export interface AreaTree {
  countryName: string;
  stateName: string;
  groups: AreaGroup[];
}

/**
 * The administrative tree, as the picker needs it.
 *
 * Nigeria → Lagos → LGA → neighbourhood is how a person says where they are.
 * Nobody thinks "6.4641, 3.2753"; they think Lagos → Amuwo Odofin → Festac.
 *
 * Country and state come back as NAMES, not as lists, because the pilot has
 * exactly one of each and a select with one option is a lie about the freedom
 * you have. They are context to display, not a choice to make.
 *
 * Neighbourhoods come back GROUPED under their LGA, every group carries its
 * full set of children, in one round trip. The LGA is not a destination (you
 * cannot stand in "an LGA"), so no group is selectable; it exists to say which
 * neighbourhoods belong together. How that grouping reaches the screen is the
 * SHEET's call, not this function's: LocationSheet drills into a group and
 * collapses a single-child one. Returning the whole tree is what lets it decide
 * without a second query.
 *
 * Ordering is alphabetical by LGA, then by neighbourhood, because a stable place
 * on the list is worth more than ranking by a count that changes under you.
 */
export async function getAreaTree(): Promise<AreaTree> {
  const lga = alias(areas, "lga");
  const state = alias(areas, "state");
  const country = alias(areas, "country");

  const rows = await db
    .select({
      id: areas.id,
      slug: areas.slug,
      name: areas.name,
      center: areas.center,
      coverageStatus: areas.coverageStatus,
      placeCount: sql<number>`count(${places.id})::int`,
      lgaSlug: lga.slug,
      lgaName: lga.name,
      stateName: state.name,
      countryName: country.name,
    })
    .from(areas)
    .leftJoin(places, eq(places.areaId, areas.id))
    // Inner joins on purpose: a neighbourhood whose ancestry does not reach a
    // country is a seeding fault, and it should vanish from the picker rather
    // than appear under a header reading "undefined". assertAdminTree() in the
    // seed is what stops that reaching here in the first place.
    .innerJoin(lga, eq(areas.parentAreaId, lga.id))
    .innerJoin(state, eq(lga.parentAreaId, state.id))
    .innerJoin(country, eq(state.parentAreaId, country.id))
    .where(eq(areas.type, "neighborhood"))
    .groupBy(areas.id, lga.slug, lga.name, state.name, country.name)
    .orderBy(sql`${lga.name} asc, ${areas.name} asc`);

  const groups: AreaGroup[] = [];
  for (const r of rows) {
    const area: AreaSummary = {
      id: r.id,
      slug: r.slug,
      name: r.name,
      lat: r.center.lat,
      lng: r.center.lng,
      placeCount: r.placeCount,
      coverageStatus: r.coverageStatus,
    };
    const last = groups[groups.length - 1];
    if (last && last.lgaSlug === r.lgaSlug) last.areas.push(area);
    else groups.push({ lgaSlug: r.lgaSlug, lgaName: r.lgaName, areas: [area] });
  }

  return {
    countryName: rows[0]?.countryName ?? "Nigeria",
    stateName: rows[0]?.stateName ?? "Lagos",
    groups,
  };
}

/**
 * Places within `radiusKm` of a point, nearest first, filtered by PostGIS.
 *
 * ST_DWithin on a geography column is metres on the spheroid and uses the
 * spatial index, so this is both correct and cheap. `getPlaces()` returns the
 * whole table unconditionally; this is the query to use whenever a radius is
 * in play.
 */
export async function getPlacesNear(input: {
  lat: number;
  lng: number;
  radiusKm: number;
  limit?: number;
}) {
  // Replaces a hand-rolled `> 0 && isFinite` check that had no upper bound: a
  // radius of 40,000 km asked PostGIS to ST_DWithin every place in the country
  // with the index unable to help. The schema also caps `limit`, which had none.
  input = parsePlacesNear(input);
  const point = toEwkt(input.lat, input.lng);
  const radiusM = input.radiusKm * 1000;

  const rows = await db
    .select({
      id: places.id,
      name: places.name,
      placeType: places.placeType,
      areaId: places.areaId,
      location: places.location,
      address: places.address,
      distanceKm: sql<number>`(ST_Distance(${places.location}, ST_GeogFromText(${point})) / 1000.0)`,
    })
    .from(places)
    .where(sql`ST_DWithin(${places.location}, ST_GeogFromText(${point}), ${radiusM}::double precision)`)
    .orderBy(sql`ST_Distance(${places.location}, ST_GeogFromText(${point})) asc`)
    .limit(input.limit ?? 200);

  return rows;
}

export interface PointCoverage {
  /** Nearest area by centre, whether or not the point is covered. Null only if
   *  the areas table is empty, which is a seeding failure, not a user state. */
  nearestArea: (AreaSummary & { distanceKm: number }) | null;
  /** Places inside `radiusKm` of the point. This is what "covered" means here. */
  placesInRadius: number;
  radiusKm: number;
}

/**
 * Answer "where is this person, and do we have anything for them?".
 *
 * Coverage is defined as **at least one place within the user's own search
 * radius**, not as a bounding box we drew, and not as proximity to an area
 * centre. That definition is deliberate and it is the one the UI states out
 * loud: a user standing in Ikeja with a 5 km radius is not covered, and telling
 * them so is more useful than dropping them onto an empty map or silently
 * teleporting them to Festac.
 */
export async function getCoverageForPoint(input: {
  lat: number;
  lng: number;
  radiusKm: number;
}): Promise<PointCoverage> {
  // worldCoordinate, NOT nigeriaCoordinate, deliberately. This action's whole
  // job is answering "am I outside coverage?", so rejecting a point outside
  // Nigeria would refuse the question it exists to answer. (0,0) is still
  // refused: that is not a user somewhere else, that is an unparsed coordinate.
  input = parseCoverageForPoint(input);
  const point = toEwkt(input.lat, input.lng);
  const radiusM = input.radiusKm * 1000;

  const [nearestRows, countRows] = await Promise.all([
    db
      .select({
        id: areas.id,
        slug: areas.slug,
        name: areas.name,
        center: areas.center,
        coverageStatus: areas.coverageStatus,
        placeCount: sql<number>`count(${places.id})::int`,
        distanceKm: sql<number>`(ST_Distance(${areas.center}, ST_GeogFromText(${point})) / 1000.0)`,
      })
      .from(areas)
      .leftJoin(places, eq(places.areaId, areas.id))
      .where(eq(areas.coverageStatus, "active"))
      .groupBy(areas.id)
      .orderBy(sql`ST_Distance(${areas.center}, ST_GeogFromText(${point})) asc`)
      .limit(1),
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(places)
      .where(sql`ST_DWithin(${places.location}, ST_GeogFromText(${point}), ${radiusM}::double precision)`),
  ]);

  const nearest = nearestRows[0];

  return {
    nearestArea: nearest
      ? {
          id: nearest.id,
          slug: nearest.slug,
          name: nearest.name,
          lat: nearest.center.lat,
          lng: nearest.center.lng,
          placeCount: nearest.placeCount,
          coverageStatus: nearest.coverageStatus,
          distanceKm: nearest.distanceKm,
        }
      : null,
    placesInRadius: countRows[0]?.n ?? 0,
    radiusKm: input.radiusKm,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 8. Contact policy
//
// `places.contactVisibility` has existed since the first migration and nothing
// has ever read it. "Get it" is the first surface that needs to, because it is
// the first surface that offers to put a user in touch with a real trader.
//
// The column is the seller's answer, not a hint. It defaults to 'private' and
// no seed or write path sets it to anything else, which means the honest answer
// today is always "this seller has not agreed to be contacted". There is also
// no channel column, no phone, no handle, so even an explicit 'public' does
// not yield something to dial. The UI states both facts rather than inventing a
// number to fill the row.
// ─────────────────────────────────────────────────────────────────────────────

/** The seller's own contact setting, plus whatever public detail exists. */
export interface PlaceContactPolicy {
  placeId: string;
  /** Raw column value, e.g. 'private'. Passed through, never defaulted here. */
  contactVisibility: string;
  /** Free text a trader chose to publish, e.g. opening days. May be null. */
  openingInformation: string | null;
  address: string | null;
}

export async function getPlaceContactPolicy(placeId: string): Promise<PlaceContactPolicy> {
  placeId = parseContactPolicyPlaceId(placeId);
  const rows = await db
    .select({
      id: places.id,
      contactVisibility: places.contactVisibility,
      openingInformation: places.openingInformation,
      address: places.address,
    })
    .from(places)
    .where(eq(places.id, placeId))
    .limit(1);

  const row = rows[0];
  // No row means the caller holds an id the database does not. Throwing beats
  // returning a permissive default: a silent 'public' here would expose a
  // seller who never agreed to it, and a silent 'private' would hide a real
  // failure behind a plausible answer.
  if (!row) {
    throw new Error(`getPlaceContactPolicy: no place with id ${placeId}`);
  }

  return {
    placeId: row.id,
    contactVisibility: row.contactVisibility,
    openingInformation: row.openingInformation,
    address: row.address,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 9. Trust, the READ side
//
// The real model lives in src/lib/trust.ts. It centralizes policy that previously
// existed only in unwired food-specific code; these actions are the live wire.
//
// The WRITE side is now wired too: `submitObservation` derives `trust_level` and
// `freshness_state` from the same `assessTrust` these functions call, so the
// stored answer and the computed one come from one model rather than two.
//
// `getFoodItemCandidates` (:194) still reports `supportingObservationCount * 10`
// as a confidence percentage, ten reports from one person read as 100%. It is
// the last caller of the old arithmetic and it is not fixed here: its consumer
// (ItemDetailSheet) belongs to another lane, and moving the number without the
// surface that renders it would change what the panel says without anyone who
// owns the panel agreeing to it. Flagged in the handover, not smuggled.
// ─────────────────────────────────────────────────────────────────────────────

/** Identifies one offer: the (variant, unit, place) triple offers_current is keyed by. */
export interface OfferKey {
  itemVariantId: string;
  unitId: string;
  placeId: string;
}

function offerKeyOf(k: OfferKey) {
  return `${k.itemVariantId}|${k.unitId}|${k.placeId}`;
}

/**
 * Real trust for a batch of offers, in one query.
 *
 * Batched on purpose: discovery returns up to `limit` rows, and a per-row action
 * would be one round trip per pin on the map.
 *
 * The moderation filter is `<> 'rejected'` rather than `= 'approved'`, matching
 * `distinctSourceCount` at :702 exactly. The two numbers are read side by side
 * in the same panel; if they filtered differently they would disagree in front
 * of the user, and a trust panel that contradicts itself is worse than no panel.
 * (The current seed does write 'approved', src/db/seed.ts:305, but older rows
 * and any future non-seed writer sit at the column's 'pending' default, and
 * counting only 'approved' would report "no evidence" for all of them: a schema
 * default wearing the costume of a fact.)
 */
export async function getOfferTrustBatch(
  keys: OfferKey[]
): Promise<Record<string, TrustAssessment>> {
  if (keys.length === 0) return {};

  const rows = await db
    .select({
      itemVariantId: observations.itemVariantId,
      unitId: observations.unitId,
      placeId: observations.placeId,
      observedAt: observations.observedAt,
      sourceId: observations.sourceId,
      sourceReliability: sources.reliabilityScoreInternal,
      collectionMethod: observations.collectionMethod,
      availabilityState: observations.availabilityState,
      provenance: observations.provenance,
    })
    .from(observations)
    .innerJoin(sources, eq(observations.sourceId, sources.id))
    .where(
      and(
        sql`${observations.moderationStatus} <> 'rejected'`,
        or(
          ...keys.map((k) =>
            and(
              eq(observations.itemVariantId, k.itemVariantId),
              eq(observations.unitId, k.unitId),
              eq(observations.placeId, k.placeId)
            )
          )
        )
      )
    )
    .orderBy(
      asc(observations.itemVariantId),
      asc(observations.unitId),
      asc(observations.placeId),
      desc(observations.observedAt),
      asc(observations.id)
    );

  const grouped = new Map<string, TrustObservation[]>();
  for (const r of rows) {
    const key = offerKeyOf(r);
    const bucket = grouped.get(key);
    const observation: TrustObservation = {
      observedAt: r.observedAt,
      sourceId: r.sourceId,
      sourceReliability: r.sourceReliability,
      collectionMethod: r.collectionMethod,
      availabilityState: r.availabilityState,
      provenance: r.provenance,
    };
    if (bucket) bucket.push(observation);
    else grouped.set(key, [observation]);
  }

  const out: Record<string, TrustAssessment> = {};
  for (const k of keys) {
    const key = offerKeyOf(k);
    // An offer with no admissible observations is a real, sayable state:
    // assessTrust returns score 0 / band 'none' / "Nobody has reported this yet."
    // rather than an absent entry the caller has to guess about.
    out[key] = assessTrust(grouped.get(key) ?? []);
  }
  return out;
}

/** Single-offer convenience. Prefer `getOfferTrustBatch` for lists. */
export async function getOfferTrust(key: OfferKey): Promise<TrustAssessment> {
  const batch = await getOfferTrustBatch([key]);
  return batch[offerKeyOf(key)];
}

/**
 * One report, as the person who filed it would recognise it: what, where, how
 * much, when.
 *
 * `priceAmount` is kobo and NULLABLE, a report can say "ee no dey" without
 * naming a price. It is also non-null on reports that DO say "ee no dey" (47 of
 * them today, every one carrying a number), which is the trap this shape hands
 * to the view rather than hiding: see `MyReportsSheet`.
 *
 * There is deliberately NOTHING here about whether the report was accepted, or
 * whether it moved the price. Neither is knowable. `moderation_status` is
 * 'approved' on 949/949 rows, NOT because that is the column default (the
 * schema default is 'pending', schema/index.ts:298) but because the seed and
 * both write paths explicitly write 'approved' (actions.ts:543, :869) and no
 * path ever writes 'rejected'. A status chip fed by it would still be a constant
 * wearing the costume of a fact, there is no moderator surface to make it vary.
 * And `offers_current.price_min/max` is a
 * BAND over every source in a 72h window, not "your price", so no column
 * anywhere records whether your report changed anything.
 */
export interface MyReport {
  id: string;
  itemName: string;
  variantName: string;
  unitName: string;
  placeName: string;
  areaName: string;
  /** Kobo, or null when the report named no price. */
  priceAmount: number | null;
  currency: string;
  availabilityState: string;
  /** ISO 8601. Serialised here because a Date cannot cross to the client. */
  observedAt: string;
}

/**
 * A stated cap, NOT a page. There is no pagination behind this: someone with 101
 * reports sees 100 and is told nothing about the rest. That is a real (if
 * distant) limit and the sheet says so rather than implying completeness, the
 * alternative was an unbounded query on the one table the schema's own comment
 * calls immutable and "only ever grows".
 */
const MY_REPORTS_LIMIT = 100;

/**
 * The prices you reported, newest first.
 *
 * THE SESSION IS RESOLVED SERVER-SIDE AND THIS ACTION TAKES NO ARGUMENTS. Both
 * halves matter. A Server Action is a public HTTP endpoint, an agent extracted
 * this file's action ids from the JS bundle and POSTed them with no cookies
 * (LANES H14), so one that returned "the reports belonging to whatever id you
 * hand it" would be a data breach reachable with curl. Taking no input at all is
 * the strongest form of that guarantee: there is no parameter to tamper with, so
 * there is nothing for `src/lib/validation.ts` to gate. `contributorSourceId()`
 * above reads the session exactly this way and for exactly this reason; this is
 * that precedent, not a second mechanism.
 *
 * SIGNED OUT RETURNS EMPTY AND NEVER THROWS. ADR-003: auth is recognition, never
 * a gate. An empty list is the true answer for someone with no session, not an
 * error, not a login wall, and not a bug.
 *
 * IT IS ALSO EMPTY FOR EVERYONE TODAY, INCLUDING THE OWNER, and that is correct
 * rather than broken. All 949 observations resolve to the three shared anonymous
 * source rows (`user_id IS NULL`, verified live), so nothing links any of them to
 * a person and nothing ever can, the key does not exist. The first non-empty row
 * this returns will be the first report filed by a signed-in human, which is also
 * the first time `contributorSourceId()`'s find-or-create insert has ever run
 * against this database.
 *
 * NO JOIN TO `offers_current`, deliberately. "Does my report still stand?" is
 * computable, it is `offersCurrent.lastObservedAt === observations.observedAt`,
 * an exact equality since both are written from one `now`, but it CANNOT BE
 * EXERCISED on this data: the seed writes exactly one Contributor observation per
 * variant/unit/place, always the newest, so that equality holds for all 474
 * offers (there is no `is_latest` column, this is a derived predicate) and the
 * superseded branch is unreachable until a signed-in human reports twice on one
 * triple. Shipping it would mean shipping a branch that has never run, on the
 * strength of a seed that makes it 100% green. The row is a receipt and is useful
 * without it. Add it when there is data that can prove it wrong.
 */
export async function getMyReports(): Promise<MyReport[]> {
  const { data: session } = await auth.getSession();
  const userId = session?.user?.id;
  if (!userId) return [];

  /**
   * This filters `sources.user_id` and orders by `observations.observed_at`, and
   * there is no index on `observations.source_id`, so both sides seq-scan
   * (EXPLAIN confirms: Hash Join over two Seq Scans). Correct, and cheap at 949
   * rows; it is a tomorrow problem on a table that only grows. The index that
   * serves both the filter and the sort, `(source_id, observed_at DESC)`, is
   * requested from the schema lane in the handover, because
   * `src/db/schema/index.ts` belongs to auth→trust and not to this change.
   */
  const rows = await db
    .select({
      id: observations.id,
      priceAmount: observations.priceAmount,
      currency: observations.currency,
      availabilityState: observations.availabilityState,
      observedAt: observations.observedAt,
      itemName: items.canonicalName,
      variantName: itemVariants.displayName,
      unitName: units.displayName,
      placeName: places.name,
      areaName: areas.name,
    })
    .from(observations)
    .innerJoin(sources, eq(observations.sourceId, sources.id))
    .innerJoin(itemVariants, eq(observations.itemVariantId, itemVariants.id))
    .innerJoin(items, eq(itemVariants.itemId, items.id))
    .innerJoin(units, eq(observations.unitId, units.id))
    .innerJoin(places, eq(observations.placeId, places.id))
    .innerJoin(areas, eq(places.areaId, areas.id))
    .where(eq(sources.userId, userId))
    .orderBy(desc(observations.observedAt))
    .limit(MY_REPORTS_LIMIT);

  return rows.map((r) => ({ ...r, observedAt: r.observedAt.toISOString() }));
}

/**
 * File a "something is wrong" report. Writes one row to `problem_reports`, which
 * the owner reads directly at psql, there is no admin UI and no reply channel,
 * by the owner's spec, so this action's whole job is to land the row honestly.
 *
 * PUBLIC AND ANONYMOUS-FIRST, like `submitObservation`. A Server Action is a
 * public HTTP endpoint (an agent lifted these ids from the JS bundle and POSTed
 * with no cookies, LANES H14), so `parseSubmitProblemReport` is the guard, not
 * the session: ADR-003 keeps this open to signed-out callers by design, and the
 * length cap on `body` is the only thing between an unthrottled endpoint and a
 * `text` column (there is no rate limiter in this app yet, see validation.ts).
 *
 * ATTRIBUTION IS RESOLVED SERVER-SIDE AND NEVER TAKEN FROM THE PAYLOAD. `userId`
 * is read from the session here, exactly as `contributorSourceId` and
 * `getMyReports` read it, and it is nullable: signed in, the report carries your
 * id; signed out, the default, it is NULL, which is the honest "filed
 * anonymously", not an error. An auth outage resolves to NULL too, and that is
 * the right trade: we do not claim to know who someone is when we could not
 * check, and we do not drop the report because a third party is down.
 *
 * The context columns (`place_id` / `item_variant_id` / `unit_id` /
 * `context_label`) are left NULL: this action has no offer in hand. The only
 * opener today is the Profile row, which is cold. When a detail-sheet entry point
 * is built it will pass that context in; the columns are already there for it.
 */
export async function submitProblemReport(data: {
  kind: "price_wrong" | "place_wrong" | "app_bug" | "other";
  body: string;
  appLocale?: "en" | "pidgin" | "yoruba";
}): Promise<void> {
  const input = parseSubmitProblemReport(data);

  const { data: session } = await auth.getSession();
  const userId = session?.user?.id ?? null;

  await db.insert(problemReports).values({
    kind: input.kind,
    body: input.body,
    userId,
    appLocale: input.appLocale ?? null,
  });
}

/**
 * A signed-in user's own profile, assembled from the two places their details
 * live: `name` and `email` from the SESSION (`neon_auth.user`, Neon-managed) and
 * the contact channel from OUR `user_profiles` row, keyed on the same user id.
 * The caller sees one object and does not need to know the seam.
 *
 * NOTHING HERE IS WRITABLE THROUGH THIS APP EXCEPT THE CONTACT. `name` is edited
 * client-side via `authClient.updateUser`; `email` is display-only (there is no
 * mounted change-email route on this SDK); only the contact pair round-trips
 * through our own table, via `updateMyProfile`.
 */
export interface MyProfile {
  /** From `neon_auth.user`. "" for anyone created by email OTP, who set no name. */
  name: string;
  /** From `neon_auth.user`. The address they sign in with; display-only in the UI. */
  email: string;
  /** From `user_profiles`, or null when they have stored no contact channel. */
  contactChannelKind: string | null;
  contactChannelValue: string | null;
  /**
   * From `user_profiles`. Whether this user shows their location on the public
   * map. Defaults to false, including for a session that has no row yet, so the
   * map lane reads a definite "not sharing" rather than an absence.
   */
  locationSharing: boolean;
  /** From `user_profiles`, or null when they have uploaded no avatar. A Vercel Blob URL. */
  avatarUrl: string | null;
}

/**
 * The current user's profile, or null when nobody is signed in.
 *
 * SESSION RESOLVED SERVER-SIDE, NO ARGUMENTS, exactly like `getMyReports` and
 * `contributorSourceId`. A Server Action is a public HTTP endpoint; one that
 * returned "the profile for whatever id you hand it" would be a data breach
 * reachable with curl (LANES H14). There is no parameter to tamper with, so
 * there is nothing for `src/lib/validation.ts` to gate.
 *
 * SIGNED OUT RETURNS NULL AND NEVER THROWS. ADR-003: auth is recognition, never a
 * gate. No session means "not recognised", which is null here, not an error and
 * not a login wall. The UI only opens Manage Profile for a signed-in user, so
 * null is the defensive floor rather than the common path.
 *
 * The `user_profiles` row may not exist yet: a user who has never saved a
 * contact has a session but no row. That is not an error either, the contact
 * fields come back null, which is the honest "no channel on file", the same
 * answer a row with both columns NULL would give.
 */
export async function getMyProfile(): Promise<MyProfile | null> {
  const { data: session } = await auth.getSession();
  const user = session?.user;
  if (!user) return null;

  const [row] = await db
    .select({
      contactChannelKind: userProfiles.contactChannelKind,
      contactChannelValue: userProfiles.contactChannelValue,
      locationSharing: userProfiles.locationSharing,
      avatarUrl: userProfiles.avatarUrl,
    })
    .from(userProfiles)
    .where(eq(userProfiles.userId, user.id))
    .limit(1);

  return {
    name: user.name ?? "",
    email: user.email,
    contactChannelKind: row?.contactChannelKind ?? null,
    contactChannelValue: row?.contactChannelValue ?? null,
    // No row means the user has never saved a profile, which is "not sharing" and
    // "no avatar", the same answer a row carrying the column defaults would give.
    locationSharing: row?.locationSharing ?? false,
    avatarUrl: row?.avatarUrl ?? null,
  };
}

/**
 * Save the current user's contact channel. Upserts the single `user_profiles`
 * row for that user.
 *
 * OWNER-SCOPED, AND THIS ONE THROWS SIGNED OUT, the deliberate difference from
 * `submitObservation` / `submitProblemReport`, which are anonymous-first by
 * ADR-003. A profile write belongs to exactly one account, the UI never offers
 * the control without a session, and there is no anonymous row for it to degrade
 * to. So no session is a caller error here, not a valid quieter path.
 *
 * ATTRIBUTION IS THE SESSION, NEVER THE PAYLOAD. `userId` is read from
 * `auth.getSession()` exactly as `getMyReports` and `contributorSourceId` read
 * it; the payload carries only the contact fields, so there is no id to tamper
 * with. `parseUpdateMyProfile` enforces the both-or-neither contact rule and the
 * length cap before anything is written.
 *
 * NAME AND EMAIL ARE NOT WRITTEN HERE. They live in `neon_auth.user`, which this
 * app cannot write through Drizzle; the UI edits the name via
 * `authClient.updateUser` client-side, and email is display-only. This action
 * owns only the contact pair in our own table.
 *
 * The upsert conflict target is `user_profiles.user_id`, which is UNIQUE for
 * exactly this purpose (schema/index.ts). Sending null for both fields clears the
 * channel.
 *
 * `locationSharing` is the map's public-location opt-in and is INDEPENDENT of the
 * contact pair. It is optional, and absence is deliberately NOT the same as false:
 * an absent flag leaves the stored value alone, so a contact-only save can never
 * silently un-share a user, and a flag-only save can be added later without a
 * both-or-neither rule. It is folded into the write only when it was sent; a brand
 * new row falls back to the column default of false.
 */
/**
 * Coarsens latitude/longitude to the centroid of a fixed 500m grid cell
 * to preserve user privacy and comply with ADR-016.
 */
function coarsenCoordinates(lat: number, lng: number): { latitude: number; longitude: number } {
  // 500 meters is approximately 0.0045 degrees of latitude
  const LAT_STEP = 0.0045;
  const gridLat = Math.round(lat / LAT_STEP) * LAT_STEP;

  // Degrees of longitude per 500 meters varies by latitude
  const latRad = (gridLat * Math.PI) / 180;
  const cosLat = Math.cos(latRad);
  // Prevent division by zero at poles
  const safeCosLat = Math.max(cosLat, 0.0001);
  const lonStep = 0.0045 / safeCosLat;
  const gridLng = Math.round(lng / lonStep) * lonStep;

  return {
    latitude: parseFloat(gridLat.toFixed(6)),
    longitude: parseFloat(gridLng.toFixed(6)),
  };
}

export async function updateMyProfile(data: {
  contactChannelKind?: "phone" | "whatsapp" | "sms" | null;
  contactChannelValue?: string | null;
  locationSharing?: boolean;
  latitude?: number | null;
  longitude?: number | null;
}): Promise<void> {
  const input = parseUpdateMyProfile(data);

  const { data: session } = await auth.getSession();
  const userId = session?.user?.id;
  if (!userId) {
    throw new Error("updateMyProfile: no session, a profile write is owner-scoped");
  }

  const contactChannelKind = input.contactChannelKind ?? null;
  const contactChannelValue = input.contactChannelValue ?? null;

  let latitude = input.latitude;
  let longitude = input.longitude;

  if (latitude != null && longitude != null) {
    const coarse = coarsenCoordinates(latitude, longitude);
    latitude = coarse.latitude;
    longitude = coarse.longitude;
  }

  // Only touch the flag/coordinates when the caller actually sent them.
  const sharing: {
    locationSharing?: boolean;
    latitude?: number | null;
    longitude?: number | null;
  } = {
    ...(input.locationSharing === undefined ? {} : { locationSharing: input.locationSharing }),
    ...(input.latitude === undefined ? {} : { latitude }),
    ...(input.longitude === undefined ? {} : { longitude }),
  };

  await db
    .insert(userProfiles)
    .values({ userId, contactChannelKind, contactChannelValue, ...sharing })
    .onConflictDoUpdate({
      target: userProfiles.userId,
      set: { contactChannelKind, contactChannelValue, ...sharing, updatedAt: new Date() },
    });
}

/**
 * What the avatar upload accepts, mime and size validated on the File itself.
 *
 * The check lives in the action rather than in `src/lib/validation.ts` because a
 * multipart upload does not arrive as the serialisable JSON those zod parsers
 * gate, it arrives as a `File`. The set is narrow on purpose: three raster
 * formats next/image can optimise, nothing that executes in a browser (no SVG),
 * and a 2 MB ceiling. This mime-and-size pair is the ONLY guard between a public
 * server action and blob storage, the same "the cap is the whole defence"
 * reasoning the problem-report body length follows, so it is not optional and it
 * is not cosmetic. The value maps mime to the file extension used in the blob key.
 */
const AVATAR_MIME_EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};
const AVATAR_MAX_BYTES = 2 * 1024 * 1024;

/**
 * Store the current user's avatar: read the File from multipart form data,
 * validate it, put() it to Vercel Blob under a user-scoped key, and record the
 * returned URL on the single `user_profiles` row for that user.
 *
 * OWNER-SCOPED AND THROWS SIGNED OUT, exactly like `updateMyProfile`: an avatar
 * belongs to one account, the session is the identity (never the payload), and
 * there is no anonymous row for it to degrade to. The File is validated here, not
 * in validation.ts, because it is a File and not JSON: mime must be PNG, JPEG or
 * WebP and size at most 2 MB (see AVATAR_MIME_EXT above).
 *
 * A FRESH RANDOM-SUFFIXED URL PER UPLOAD, plus a best-effort del() of the previous
 * blob, is deliberate over overwriting a fixed key. Blob is CDN-cached by URL, so
 * reusing one key would keep serving the old image after a change. The old blob is
 * deleted only AFTER the new URL is committed, so a failed cleanup orphans a blob
 * (invisible, harmless) rather than dropping the avatar that is now live.
 */
export async function uploadMyAvatar(formData: FormData): Promise<{ avatarUrl: string }> {
  const { data: session } = await auth.getSession();
  const userId = session?.user?.id;
  if (!userId) {
    throw new Error("uploadMyAvatar: no session, an avatar write is owner-scoped");
  }

  const file = formData.get("avatar");
  if (!(file instanceof File) || file.size === 0) {
    throw new Error("uploadMyAvatar: no avatar file was provided");
  }

  const ext = AVATAR_MIME_EXT[file.type];
  if (!ext) {
    throw new Error("uploadMyAvatar: avatar must be a PNG, JPEG, or WebP image");
  }
  if (file.size > AVATAR_MAX_BYTES) {
    throw new Error("uploadMyAvatar: avatar must be at most 2MB");
  }

  // The previous blob to clean up once the new one lands, if there is one.
  const [existing] = await db
    .select({ avatarUrl: userProfiles.avatarUrl })
    .from(userProfiles)
    .where(eq(userProfiles.userId, userId))
    .limit(1);

  // Token is read from BLOB_READ_WRITE_TOKEN in the environment by the SDK. Only
  // public access is supported by Blob; the random suffix keeps the URL from being
  // guessable and sidesteps CDN caching of a reused key.
  const blob = await put(`avatars/${userId}.${ext}`, file, {
    access: "public",
    addRandomSuffix: true,
    contentType: file.type,
  });

  await db
    .insert(userProfiles)
    .values({ userId, avatarUrl: blob.url })
    .onConflictDoUpdate({
      target: userProfiles.userId,
      set: { avatarUrl: blob.url, updatedAt: new Date() },
    });

  // Best effort: the new avatar is already committed above, so a failed delete
  // leaves an orphaned blob, never a broken profile. It must not throw.
  if (existing?.avatarUrl && existing.avatarUrl !== blob.url) {
    try {
      await del(existing.avatarUrl);
    } catch {
      // Stale blob left behind; not worth failing a successful upload over.
    }
  }

  return { avatarUrl: blob.url };
}

/**
 * Clear the current user's avatar: null the column, then del() the blob.
 *
 * OWNER-SCOPED, and it nulls the DB BEFORE deleting the blob on purpose. Reverse
 * the order and a failed DB write would leave `avatar_url` pointing at a blob that
 * no longer exists, a broken image on every surface that renders it. Nulling first
 * makes the worst case an orphaned blob (invisible) rather than a dangling URL
 * (not). The del() is best-effort for the same reason.
 *
 * No row, or a row with no avatar, is a no-op rather than an error: there is
 * nothing to remove, and ADR-003 keeps recognition from becoming a gate.
 */
export async function removeMyAvatar(): Promise<void> {
  const { data: session } = await auth.getSession();
  const userId = session?.user?.id;
  if (!userId) {
    throw new Error("removeMyAvatar: no session, an avatar write is owner-scoped");
  }

  const [existing] = await db
    .select({ avatarUrl: userProfiles.avatarUrl })
    .from(userProfiles)
    .where(eq(userProfiles.userId, userId))
    .limit(1);

  if (!existing?.avatarUrl) return;

  await db
    .update(userProfiles)
    .set({ avatarUrl: null, updatedAt: new Date() })
    .where(eq(userProfiles.userId, userId));

  try {
    await del(existing.avatarUrl);
  } catch {
    // The blob is already gone or unreachable; the profile is what matters and it
    // is already cleared.
  }
}

export interface SharedUserLocation {
  userId: string;
  name: string;
  avatarUrl: string | null;
  latitude: number;
  longitude: number;
  contactChannelKind: string | null;
  contactChannelValue: string | null;
}

export async function getSharedUserLocations(): Promise<SharedUserLocation[]> {
  const result = await db.execute<{
    user_id: string;
    name: string | null;
    email: string | null;
    avatar_url: string | null;
    latitude: string | number;
    longitude: string | number;
    contact_channel_kind: string | null;
    contact_channel_value: string | null;
  }>(sql`
    SELECT 
      up.user_id,
      u.name,
      u.email,
      up.avatar_url,
      up.latitude,
      up.longitude,
      up.contact_channel_kind,
      up.contact_channel_value
    FROM user_profiles up
    LEFT JOIN neon_auth.user u ON u.id = up.user_id
    WHERE up.location_sharing = true 
      AND up.latitude IS NOT NULL 
      AND up.longitude IS NOT NULL
  `);

  return result.rows.map(row => ({
    userId: row.user_id,
    name: row.name || row.email || "Anonymous",
    avatarUrl: row.avatar_url,
    latitude: Number(row.latitude),
    longitude: Number(row.longitude),
    contactChannelKind: row.contact_channel_kind,
    contactChannelValue: row.contact_channel_value,
  }));
}

export interface ReviewData {
  id: string;
  userId: string | null;
  reviewerName: string;
  reviewerAvatarUrl: string | null;
  rating: number;
  title: string | null;
  body: string | null;
  createdAt: string;
}

export interface ReviewAggregateData {
  ratingAverage: number;
  ratingCount: number;
}

export async function getReviewsForEntity(
  reviewableType: string,
  reviewableId: string
): Promise<ReviewData[]> {
  const result = await db.execute<{
    id: string;
    user_id: string | null;
    reviewer_name: string | null;
    reviewer_email: string | null;
    reviewer_avatar_url: string | null;
    rating: number;
    title: string | null;
    body: string | null;
    created_at: string;
  }>(sql`
    SELECT 
      r.id,
      r.user_id,
      u.name as reviewer_name,
      u.email as reviewer_email,
      up.avatar_url as reviewer_avatar_url,
      r.rating,
      r.title,
      r.body,
      r.created_at
    FROM reviews r
    LEFT JOIN user_profiles up ON up.user_id = r.user_id
    LEFT JOIN neon_auth.user u ON u.id = r.user_id
    WHERE r.reviewable_type = ${reviewableType}
      AND r.reviewable_id = ${reviewableId}::uuid
      AND r.moderation_status = 'approved'
    ORDER BY r.created_at DESC
  `);

  return result.rows.map((row) => ({
    id: row.id,
    userId: row.user_id,
    reviewerName: row.reviewer_name || row.reviewer_email || "Anonymous",
    reviewerAvatarUrl: row.reviewer_avatar_url,
    rating: Number(row.rating),
    title: row.title,
    body: row.body,
    createdAt: new Date(row.created_at).toISOString(),
  }));
}

export async function getReviewAggregate(
  reviewableType: string,
  reviewableId: string
): Promise<ReviewAggregateData | null> {
  const result = await db
    .select({
      ratingAverage: reviewAggregates.ratingAverage,
      ratingCount: reviewAggregates.ratingCount,
    })
    .from(reviewAggregates)
    .where(
      and(
        eq(reviewAggregates.reviewableType, reviewableType),
        eq(reviewAggregates.reviewableId, reviewableId)
      )
    )
    .limit(1);

  if (result.length === 0) return null;
  return result[0];
}

export async function submitReview(data: {
  reviewableType: string;
  reviewableId: string;
  rating: number;
  title?: string | null;
  body?: string | null;
}): Promise<void> {
  const input = parseSubmitReview(data);

  const { data: session } = await auth.getSession();
  const userId = session?.user?.id;
  if (!userId) {
    throw new Error("submitReview: no session, a review write is owner-scoped");
  }

  // 1. Insert the review
  await db.insert(reviews).values({
    userId: userId,
    reviewableType: input.reviewableType,
    reviewableId: input.reviewableId,
    rating: input.rating,
    title: input.title ?? null,
    body: input.body ?? null,
    moderationStatus: "approved",
  });

  // 2. Fetch all ratings for this entity to compute the new aggregate
  const allRatings = await db
    .select({ rating: reviews.rating })
    .from(reviews)
    .where(
      and(
        eq(reviews.reviewableType, input.reviewableType),
        eq(reviews.reviewableId, input.reviewableId),
        eq(reviews.moderationStatus, "approved")
      )
    );

  const count = allRatings.length;
  const sum = allRatings.reduce((acc, curr) => acc + curr.rating, 0);
  const average = count > 0 ? sum / count : 0.0;

  // 3. Upsert into reviewAggregates
  await db
    .insert(reviewAggregates)
    .values({
      reviewableType: input.reviewableType,
      reviewableId: input.reviewableId,
      ratingAverage: average,
      ratingCount: count,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [reviewAggregates.reviewableType, reviewAggregates.reviewableId],
      set: {
        ratingAverage: average,
        ratingCount: count,
        updatedAt: new Date(),
      },
    });
}
