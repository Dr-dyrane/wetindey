"use server";

import { db } from "@/db";
import { areas, items, itemAliases, itemVariants, places, offersCurrent, units, observations, sources } from "@/db/schema";
import { eq, ilike, or, and, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import {
  assertValid,
  submitObservationInput,
  visitConfirmationInput,
} from "@/lib/validation";

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

// 1. Search food items in the database
export async function searchFoodItems(query: string) {
  if (!query || query.trim() === "") {
    return [];
  }

  const q = `%${query.trim()}%`;

  // Match the canonical name, the slug, or a local-language alias, so "ewa",
  // "shinkafa" and "dodo" find their items the way a Nigerian shopper would ask.
  const matched = await db
    .selectDistinctOn([items.id], itemCard)
    .from(items)
    .leftJoin(itemAliases, eq(itemAliases.itemId, items.id))
    .where(
      and(
        eq(items.active, true),
        or(
          ilike(items.canonicalName, q),
          ilike(items.slug, q),
          ilike(itemAliases.alias, q)
        )
      )
    )
    .limit(10);

  return matched;
}

/**
 * Items to show on the landing surface before the user has searched anything —
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
  limit?: number;
}) {
  const { lat, lng, radiusKm } = input;
  const limit = input.limit ?? 8;

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    throw new Error(`getPopularItems: invalid centre lat=${lat}, lng=${lng}`);
  }
  if (!Number.isFinite(radiusKm) || radiusKm <= 0) {
    throw new Error(`getPopularItems: invalid radius ${radiusKm} km`);
  }
  const radiusM = radiusKm * 1000;
  /**
   * The price range is computed WITHIN A SINGLE UNIT — the one the item is most
   * commonly sold in — and the unit is returned so the card can name it.
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
   * A true price-per-litre comparison is possible — units.canonicalQuantity
   * exists for it and is read by nothing — but normalising across a keg and a
   * bottle still hides that they are different purchases. Naming the unit is the
   * honest answer; normalisation is a product decision.
   */
  const rows = await db.execute(sql`
    WITH nearby AS (
      -- Every offer whose PLACE is within the radius. Everything below draws
      -- only from here, so "near you" is established once and cannot be
      -- forgotten by a later join.
      SELECT o.*
      FROM ${offersCurrent} o
      JOIN ${places} pl ON pl.id = o.place_id
      WHERE ST_DWithin(
        pl.location,
        ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography,
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
      WHERE ${items.active} = true
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
    )
    SELECT
      i.id, i.slug, i.canonical_name AS name, i.description,
      i.image_url, i.image_attribution, i.image_license, i.image_source_url,
      u.display_name                                   AS "unitLabel",
      COUNT(o.id)::int                                 AS "offerCount",
      COUNT(DISTINCT o.place_id)::int                  AS "placeCount",
      MIN(o.price_min)::int                            AS "priceFrom",
      MAX(COALESCE(o.price_max, o.price_min))::int     AS "priceTo",
      (array_agg(o.freshness_state ORDER BY o.last_observed_at DESC))[1] AS freshest,
      MAX(o.last_observed_at)                          AS "lastObservedAt"
    FROM ${items} i
    JOIN modal_unit  mu ON mu.item_id = i.id
    JOIN ${itemVariants}  v ON v.item_id = i.id
    JOIN nearby           o ON o.item_variant_id = v.id AND o.unit_id = mu.unit_id
    JOIN ${units}         u ON u.id = mu.unit_id
    WHERE i.active = true
    GROUP BY i.id, u.display_name
    ORDER BY COUNT(o.id) DESC, i.canonical_name ASC
    LIMIT ${limit}
  `);

  type Row = {
    id: string; slug: string; name: string; description: string | null;
    image_url: string | null; image_attribution: string | null;
    image_license: string | null; image_source_url: string | null;
    unitLabel: string; offerCount: number; placeCount: number;
    priceFrom: number | null; priceTo: number | null;
    freshest: string | null; lastObservedAt: Date | null;
  };

  return (rows.rows as unknown as Row[]).map((r) => ({
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
    freshest: r.freshest,
    lastObservedAt: r.lastObservedAt ? new Date(r.lastObservedAt).toISOString() : null,
  }));
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
  /**
   * A Next.js server action is a PUBLIC HTTP ENDPOINT. Anyone can POST to it —
   * there is no auth in this app. Until this line existed, `priceAmount` went
   * straight from an anonymous request into `Math.round(n * 100)` below and
   * into the price band every other user reads. A ₦900,000,000 rice report is
   * not a typo; it is an attack, and it poisons the band for everyone.
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
  const input = assertValid(submitObservationInput, data, "submitObservation");

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

/* ─────────────────────────────────────────────────────────────────────────────
   THE TRUST LOOP

   Everything above this line is a price lookup. What follows asks the only
   person who actually knows — the one who went — whether the answer we gave was
   true, and folds it back into offers_current so the next lookup is better.
   ──────────────────────────────────────────────────────────────────────────── */

/**
 * The default Contributor source, resolved the same way submitObservation does.
 *
 * Deliberately the SAME source a sofa report gets. A confirmation from someone
 * who physically went should outweigh one typed from a chair, and
 * `sources.reliability_score_internal` is the field to hang that on — but which
 * source a visit belongs to, and what it scores, is a product decision. Minting
 * a second source row here would quietly answer it. Flagged, not guessed; the
 * visit is distinguished by `collection_method` in the meantime, which is
 * enough for the model to be applied retroactively once it is decided.
 */
async function visitContributorSourceId(): Promise<string> {
  const [row] = await db
    .select({ id: sources.id })
    .from(sources)
    .where(eq(sources.sourceType, "Contributor"))
    .limit(1);

  if (!row) throw new Error("Default Contributor source not configured in database.");
  return row.id;
}

// 7. Snapshot the claim a user is about to go and test.
//
// Called on the way OUT ("Go there"), not on the way back. Someone returning
// from a market is the least likely person in the product to have a connection,
// so the question they are asked on their return must already be in their hand
// before they leave. The caller stashes this and hands it to ConfirmVisitSheet.
export async function getVisitContext(offerId: string) {
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
  // honestly — an empty or half-filled one would submit an observation against
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
  /** Required when wasAvailable. Meaningless otherwise — you cannot buy what is not there. */
  didBuy?: boolean;
}) {
  /**
   * The back door. This action checks `actualPrice` is finite and positive but
   * had NO CEILING, and it delegates to submitObservation — so it could push
   * the exact ₦900,000,000 report that the front door now refuses. A validated
   * front door and an unvalidated back door is an unvalidated endpoint.
   *
   * `.strict()` also matters here: `didBuy` lands in observations.raw_payload,
   * a jsonb column, so an unknown key is stored verbatim. A multi-megabyte
   * object would be written without complaint.
   *
   * What this CANNOT fix, and what no schema can: the "it wasn't there" branch
   * below sets freshnessState 'unavailable' AND trustLevel 'high' on any offer
   * from one unauthenticated POST. A competitor can blank a rival stall's
   * inventory with a perfectly well-formed payload. That needs auth, not zod —
   * see the security notes.
   */
  const input = assertValid(visitConfirmationInput, data, "submitVisitConfirmation");
  data = input as typeof data;

  const now = new Date();

  /* ── "It wasn't there" ─────────────────────────────────────────────────────
     Written directly, because submitObservation requires a price and there is
     no price to give. Passing the last known one would file a number the user
     never saw into an immutable log — a fabricated datum. The offer update here
     is genuinely different logic rather than a duplicate: no price maths runs
     at all, and the price bounds are deliberately left alone, because "not
     there right now" says nothing about what it costs when it comes back. */
  if (!data.wasAvailable) {
    const sourceId = await visitContributorSourceId();

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

    // Nothing to update is a legitimate outcome — the offer may have expired
    // out from under the visit. The observation still stands on its own.
    if (!offer) return { success: true, observationId: newObs.id, offerUpdated: false };

    await db
      .update(offersCurrent)
      .set({
        availabilityState: "unavailable",
        freshnessState: "unavailable",
        trustLevel: "high",
        lastObservedAt: now,
        expiresAt: new Date(now.getTime() + 72 * 3600 * 1000),
        // Reset, not increment. The count exists to say how many observations
        // back the CURRENT state, and the state just flipped — every report
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
   7. Discovery — narrowing an item down to a unit, then to nearby offers.

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
  /** offers_current's own tally — how many reports back this price. */
  supportingObservationCount: number;
  /**
   * How many DISTINCT sources filed those reports. This is the number that
   * actually carries trust: `supportingObservationCount * 10` — what the old
   * detail panel showed as a percentage — reads ten reports from one person as
   * 100% confidence. Two people saying the same thing is evidence; one person
   * saying it ten times is not.
   */
  distinctSourceCount: number;
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
 * zero sources for every offer in the pilot database — a plausible-looking
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
  if (!input.itemId) throw new Error("Discovery: getItemNarrowingOptions needs an itemId");

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
  if (!input.itemId) throw new Error("Discovery: getOffersNarrowed needs an itemId");

  const sort: OfferSort = input.sort ?? "nearest";
  const limit = input.limit ?? 60;
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
    .orderBy(sql`(${offersCurrent.availabilityState} = 'unavailable') asc, ${ranking}`)
    .limit(limit);

  return rows.map((r) => {
    // The (0,0) incident: a place that cannot be located is not a place we can
    // rank by distance, so it fails loudly rather than sorting first forever.
    if (!Number.isFinite(r.distanceM)) {
      throw new Error(`Discovery: no distance for place ${r.placeId} (${r.placeName})`);
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
 * ST_GeogFromText — the numbers are proven finite before they get here, and
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
 * you have. They are context to display, not a choice to make. The LGA is
 * likewise not a destination — you cannot stand in "an LGA" — so it groups the
 * rows instead of gating them behind a drill. Nine neighbourhoods under six
 * headers is one screen; making the user tap an LGA first to reveal one or two
 * children would charge two taps for information a section header gives free.
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
 * Places within `radiusKm` of a point, nearest first — filtered by PostGIS.
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
  const point = toEwkt(input.lat, input.lng);
  if (!Number.isFinite(input.radiusKm) || input.radiusKm <= 0) {
    throw new Error(`Invalid radius: ${input.radiusKm} km`);
  }
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
 * radius** — not as a bounding box we drew, and not as proximity to an area
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
  const point = toEwkt(input.lat, input.lng);
  if (!Number.isFinite(input.radiusKm) || input.radiusKm <= 0) {
    throw new Error(`Invalid radius: ${input.radiusKm} km`);
  }
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
// no channel column — no phone, no handle — so even an explicit 'public' does
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
// 9. Trust
//
// The real model lives in src/lib/trust.ts, ported from FoodModule.ts:138-176,
// which held it correctly and had zero importers. These actions are the wire.
//
// The import sits here rather than at the top of the file because this section
// was appended and the existing import block was off limits to this pass. ESM
// import declarations are hoisted, so this is correct, not merely tolerated —
// but it belongs upstairs with the others the next time that block is touched.
//
// They do not replace `supportingObservationCount * 10` at :194 in place —
// that line is owned by another surface this pass may not edit. They stand
// beside it so callers can move over. See the handover's integration note.
// ─────────────────────────────────────────────────────────────────────────────

import { assessTrust, type TrustAssessment, type TrustObservation } from "@/lib/trust";

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
 * (The current seed does write 'approved' — src/db/seed.ts:305 — but older rows
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
