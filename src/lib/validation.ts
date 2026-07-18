/**
 * Input validation for every server action.
 *
 * WHY THIS FILE EXISTS
 *
 * A Next.js server action is a public HTTP endpoint. `submitObservation` is
 * reachable by anyone who can POST to this origin, auth exists now, but ADR-003
 * makes it recognition, never a gate, so the write paths stay open by design.
 * Unguarded, the action takes `priceAmount` straight from the caller and writes
 * it to `observations`, from which every offer field is derived. A single
 * ₦900,000,000 rice report is not a typo. It is a write to the price band that
 * every other user then reads.
 *
 * WIRING STATUS, every schema below has a live call site in `actions.ts`.
 * Both write paths and all nine read paths are gated. Nothing here is
 * aspirational; if you add a schema, wire it in the same change or do not add it.
 *
 * WHY IT LIVES HERE AND NOT IN actions.ts
 *
 * `actions.ts` carries "use server", and a "use server" module may only export
 * async functions. Exporting a schema object from it is a build error. Schemas
 * therefore live in a plain module and the actions import them.
 *
 * THE HOUSE RULE THIS FILE OBEYS
 *
 * Validate, never coerce, never clamp. `geographyPoint.fromDriver` throws on an
 * undecodable point precisely because the silent fallback that preceded it put
 * every place in the Gulf of Guinea for the life of the project. The same logic
 * applies to a price: clamping ₦900,000,000 down to the band ceiling would file
 * a number nobody observed into an immutable log, which is a fabricated datum
 * wearing a plausible face. Reject the write instead.
 */

import { z } from "zod";

/* ─────────────────────────────────────────────────────────────────────────────
   Primitives
   ──────────────────────────────────────────────────────────────────────────── */

/**
 * Every id in this schema is `uuid("...").defaultRandom()`. Postgres rejects a
 * malformed uuid itself, but it does so with a driver error after a round trip,
 * which turns a garbage id into a 500 and a log line rather than a clean reject.
 */
const uuidField = (label: string) =>
  z.string({ required_error: `${label} is required`, invalid_type_error: `${label} must be a string` })
    .uuid(`${label} must be a UUID`);

/**
 * The price band, in Naira.
 *
 * FLOOR, ₦5. The cheapest thing seeded in the pilot is ₦200 (sachet water).
 * Nothing on this map is sold for less than a few Naira, and the floor also
 * disposes of 0, negatives, and sub-kobo values that `Math.round(n * 100)` in
 * `submitObservation` would silently round to 0 kobo, a free item nobody sold.
 *
 * CEILING, ₦5,000,000. The dearest thing seeded is a 50 kg bag of rice at
 * ₦120,000. The ceiling is ~40x that, so it cannot reject a real report even
 * through severe inflation, and it is far below the number that matters:
 *
 *   `observations.price_amount` and `offers_current.price_min` are `integer`
 *   columns holding KOBO. int4 tops out at 2,147,483,647 kobo = ₦21,474,836.
 *   A report above that does not just poison the band, it makes Postgres raise
 *   mid-insert. The ceiling is set below the overflow point so that anything
 *   this schema admits is guaranteed to be storable.
 */
const PRICE_FLOOR_NAIRA = 5;
const PRICE_CEILING_NAIRA = 5_000_000;

/** The int4 kobo ceiling the band above is defined to stay clear of. */
const INT4_MAX_KOBO = 2_147_483_647;

/**
 * Guarded at module load rather than trusted. If someone raises the ceiling in a
 * hurry, the band must not be allowed to admit a value that overflows the column
 * it is defended for.
 */
if (PRICE_CEILING_NAIRA * 100 > INT4_MAX_KOBO) {
  throw new Error(
    `validation: PRICE_CEILING_NAIRA (₦${PRICE_CEILING_NAIRA}) exceeds what price_amount can store ` +
      `(int4 max ${INT4_MAX_KOBO} kobo = ₦${Math.floor(INT4_MAX_KOBO / 100)}).`
  );
}

/**
 * A price a human could have seen on a market stall.
 *
 * `.finite()` is load-bearing and not decoration: JSON cannot carry NaN, but a
 * server action's payload arrives over React's serialisation, and `Infinity`
 * reaching `Math.round(n * 100)` yields `Infinity`, which Postgres rejects for
 * an integer column, after the observation row has already been reasoned about.
 */
const priceNaira = z
  .number({ required_error: "priceAmount is required", invalid_type_error: "priceAmount must be a number" })
  .finite("priceAmount must be a finite number")
  .gte(PRICE_FLOOR_NAIRA, `priceAmount must be at least ₦${PRICE_FLOOR_NAIRA}`)
  .lte(
    PRICE_CEILING_NAIRA,
    `priceAmount must be at most ₦${PRICE_CEILING_NAIRA.toLocaleString("en-NG")}, a price above this is not a typo`
  );

/**
 * `availability_state` is a varchar(50) with a comment, not a pg enum, so the
 * database will accept any string that fits. These are the only two values the
 * read paths interpret; a third would sit in the column reading as neither.
 */
const availabilityState = z.enum(["available", "unavailable"], {
  errorMap: () => ({ message: "availabilityState must be 'available' or 'unavailable'" }),
});

/**
 * Nigeria's bounding box, padded to whole tenths of a degree.
 *
 * Source extent: lng 2.6769–14.6780, lat 4.2406–13.8856.
 */
const NIGERIA_BBOX = {
  minLng: 2.6,
  maxLng: 14.7,
  minLat: 4.2,
  maxLat: 13.9,
} as const;

const latitude = z.number().finite().gte(-90).lte(90);
const longitude = z.number().finite().gte(-180).lte(180);

/**
 * A coordinate anywhere on Earth, except (0, 0).
 *
 * Null island is excluded by name because this project has already paid for it:
 * a decode fallback of `{lng: 0, lat: 0}` put every place in the Gulf of Guinea
 * and read as "the map is broken" for months. (0, 0) is not a location a device
 * reports; it is what a zeroed or half-parsed coordinate looks like, and it must
 * never again pass silently for a place on the sea.
 */
const worldCoordinate = z
  .object({ lat: latitude, lng: longitude })
  .refine((c) => !(c.lat === 0 && c.lng === 0), {
    message: "coordinate (0, 0) is not a location, it is what an unparsed coordinate looks like",
  });

/**
 * A coordinate inside Nigeria.
 *
 * Use this for any origin we are searching Nigerian data FROM, and for any
 * coordinate we would WRITE. Besides rejecting junk, the box catches the two
 * failure modes that produce a plausible wrong answer rather than an error:
 *
 *   · a swapped pair, Festac is (6.4654, 3.2846); swap it and you get
 *     (3.2846, 6.4654), which is open water south of Lagos and inside no box
 *     this app cares about;
 *   · a truncated or zeroed pair, per `worldCoordinate` above.
 *
 * Do NOT use it for `getCoverageForPoint`. That action's entire job is to answer
 * "do you have anything for me, where I am standing?", and a Nigerian opening
 * the app from London deserves "nearest area is Festac, 0 places within your
 * radius" rather than a thrown error. See `coverageForPointInput`.
 */
const nigeriaCoordinate = worldCoordinate.refine(
  (c) =>
    c.lng >= NIGERIA_BBOX.minLng &&
    c.lng <= NIGERIA_BBOX.maxLng &&
    c.lat >= NIGERIA_BBOX.minLat &&
    c.lat <= NIGERIA_BBOX.maxLat,
  { message: "coordinate is outside Nigeria" }
);

/**
 * A search radius, in km.
 *
 * The 500 km ceiling is not invented here, `searchRadiusMetres` (actions.ts:686)
 * already enforces it for discovery. This states the same number for the
 * location actions, where `getPlacesNear` (actions.ts:961) and
 * `getCoverageForPoint` (actions.ts:1009) check only `> 0` today, so a radius of
 * 40,000 km asks PostGIS to ST_DWithin the entire places table with the index
 * unable to help.
 */
const radiusKm = z.number().finite().gt(0, "radiusKm must be positive").lte(500, "radiusKm must be at most 500");

/**
 * A row cap.
 *
 * Every `limit` in actions.ts is a client-supplied number with a default and no
 * ceiling. Drizzle binds it as a parameter, so this is not an injection, it is
 * an amplification: one small POST with `limit: 1e9` asks the database for the
 * world and asks the server to serialise it back.
 */
const limitField = (max: number) => z.number().int("limit must be a whole number").gte(1).lte(max);

/* ─────────────────────────────────────────────────────────────────────────────
   Per-action input schemas

   Named for the action they gate. `.strict()` on write payloads: an unexpected
   key is not a field we ignore, it is a caller we do not understand, and the
   write paths are where that matters.
   ──────────────────────────────────────────────────────────────────────────── */

/**
 * `submitObservation`, the unauthenticated write.
 *
 * Note what this schema CANNOT do: it proves the payload is well formed, not
 * that the person sending it went anywhere. See the audit note on rate limiting
 * and `sources.reliability_score_internal`.
 */
const submitObservationInput = z
  .object({
    itemVariantId: uuidField("itemVariantId"),
    unitId: uuidField("unitId"),
    placeId: uuidField("placeId"),
    priceAmount: priceNaira,
    availabilityState,
  })
  .strict();

type SubmitObservationInput = z.infer<typeof submitObservationInput>;

/**
 * `submitVisitConfirmation`.
 *
 * A discriminated union rather than a bag of optionals, because the action's own
 * comments say the shape is conditional and then enforce it with three hand-rolled
 * throws (actions.ts:559, 579, 584). Two of those checks are the ones this union
 * states declaratively; the third, `actualPrice` having no CEILING at
 * actions.ts:559, is a hole this closes. `submitVisitConfirmation` delegates to
 * `submitObservation` (actions.ts:587), so an attacker who cannot write ₦900M
 * through the front door can write it through the visit path unless both are gated.
 *
 * `didBuy` is typed `boolean` and lands in `observations.raw_payload`
 * (actions.ts:606), a jsonb column. At runtime an unvalidated `didBuy` is
 * whatever was sent, including a multi-megabyte object. jsonb will store it.
 */
const visitIdentity = {
  placeId: uuidField("placeId"),
  itemVariantId: uuidField("itemVariantId"),
  unitId: uuidField("unitId"),
};

/**
 * The `actualPrice` rule hangs off the union rather than the `wasAvailable: true`
 * branch because zod v3's `discriminatedUnion` only accepts plain ZodObjects as
 * members, a `.refine()`d branch is a ZodEffects and is rejected at the type
 * level. Refining the assembled union is the same rule in the only place v3 will
 * take it.
 */
const visitConfirmationInput = z
  .discriminatedUnion("wasAvailable", [
    z
      .object({
        ...visitIdentity,
        wasAvailable: z.literal(false),
      })
      // No priceWasRight, no actualPrice, no didBuy. You cannot buy what is not
      // there, and "not there right now" says nothing about what it costs, the
      // action deliberately leaves the price bounds alone on this path
      // (actions.ts:534-550). Anything sent alongside is a caller bug.
      .strict(),
    z
      .object({
        ...visitIdentity,
        wasAvailable: z.literal(true),
        priceWasRight: z.boolean({
          required_error: "priceWasRight is required when the item was available",
        }),
        actualPrice: priceNaira.optional(),
        didBuy: z.boolean().optional(),
      })
      .strict(),
  ])
  .refine((v) => v.wasAvailable !== true || v.priceWasRight !== false || typeof v.actualPrice === "number", {
    message: "'the price was different' requires the price they actually saw",
    path: ["actualPrice"],
  });

/**
 * Shaped to be assignable to `submitVisitConfirmation`'s declared parameter, so
 * wiring is a single assignment and no line below it has to change.
 */
type VisitConfirmationInput =
  | { placeId: string; itemVariantId: string; unitId: string; wasAvailable: false }
  | {
      placeId: string;
      itemVariantId: string;
      unitId: string;
      wasAvailable: true;
      priceWasRight: boolean;
      actualPrice?: number;
      didBuy?: boolean;
    };

/**
 * `searchFoodItems`.
 *
 * The cap is the point. The query is interpolated into a LIKE pattern
 * (actions.ts:25) against `items.canonical_name`, `items.slug` AND
 * `item_aliases.alias` across a `selectDistinctOn` with a left join, three
 * ILIKE scans per call, on every keystroke, with no index able to serve a
 * leading `%`. An 8 KB query string is a cheap way to make that expensive.
 *
 * Empty is permitted, not rejected: the action already guards it and returns []
 * (actions.ts:21), and the search box calls this on every keystroke including
 * the one that clears it. Throwing there would break a working path to defend
 * nothing.
 */
const searchQueryInput = z.string().max(80, "search query is too long");

const placeIdInput = uuidField("placeId");
const offerIdInput = uuidField("offerId");

/** `getPopularItems`. The landing grid asks for 8; nothing needs more than a screen. */
const popularItemsLimitInput = limitField(48);

/** `getItemNarrowingOptions`. */
const itemNarrowingOptionsInput = z
  .object({
    itemId: uuidField("itemId"),
    center: nigeriaCoordinate,
    radiusKm,
  })
  .strict();

/** `getOffersNarrowed`. */
const offersNarrowedInput = z
  .object({
    itemId: uuidField("itemId"),
    variantId: uuidField("variantId").nullish(),
    unitId: uuidField("unitId").nullish(),
    center: nigeriaCoordinate,
    radiusKm,
    // Unvalidated, this string indexes an object literal (the `ranking` table in
    // getOffersNarrowed). Object literals inherit from Object.prototype, so
    // `sort: "toString"` does not miss, it resolves to a function.
    //
    // It is NOT interpolated as raw SQL, and an earlier version of this comment
    // was wrong to imply it. Measured against the live database: Drizzle binds
    // the function as a PARAMETER, Postgres receives `ORDER BY $1` with null,
    // accepts it, and returns rows with the ordering silently dropped. So the
    // real failure is not injection, it is "cheapest" quietly not being
    // cheapest, which is the class of bug this project has already paid for
    // once in the Gulf of Guinea. The enum is what stops that.
    sort: z.enum(["nearest", "cheapest", "freshest"]).optional(),
    limit: limitField(200).optional(),
  })
  .strict();

/** `getPlacesNear`. */
const placesNearInput = z
  .object({
    lat: latitude,
    lng: longitude,
    radiusKm,
    limit: limitField(500).optional(),
  })
  .strict()
  .refine((v) => !(v.lat === 0 && v.lng === 0), {
    message: "coordinate (0, 0) is not a location, it is what an unparsed coordinate looks like",
  })
  .refine(
    (v) =>
      v.lng >= NIGERIA_BBOX.minLng &&
      v.lng <= NIGERIA_BBOX.maxLng &&
      v.lat >= NIGERIA_BBOX.minLat &&
      v.lat <= NIGERIA_BBOX.maxLat,
    { message: "coordinate is outside Nigeria" }
  );

/**
 * `getCoverageForPoint`, deliberately `worldCoordinate`, NOT `nigeriaCoordinate`.
 *
 * This is the one action whose purpose is to answer "am I outside coverage?".
 * Rejecting a point outside Nigeria would refuse to answer the question it was
 * built to answer, and the action's own docstring (actions.ts:998) commits to
 * telling an uncovered user so rather than teleporting them to Festac. (0, 0) is
 * still refused, because that is not a user somewhere else, that is a bug.
 */
const coverageForPointInput = z
  .object({
    lat: latitude,
    lng: longitude,
    radiusKm,
  })
  .strict()
  .refine((v) => !(v.lat === 0 && v.lng === 0), {
    message: "coordinate (0, 0) is not a location, it is what an unparsed coordinate looks like",
  });

/**
 * `submitProblemReport`, the second unauthenticated public write, after
 * `submitObservation`. Same exposure exactly: a Server Action is a public HTTP
 * endpoint, ADR-003 keeps it open to anonymous callers by design, and there is
 * no rate limiter in this app (no middleware, no upstash/arcjet dependency, the
 * device-cookie throttle is still Phase 2, and when it lands it owns BOTH this
 * endpoint and submitObservation). So this schema is the only guard standing
 * between the open internet and a `text` column.
 *
 * `body` is where that matters. Uncapped, one POST can write an 8 KB essay, or
 * a 10 MB one, into the reports table for free, which is storage exhaustion by
 * the same reasoning `searchQueryInput` caps its query at 80. `.max(1000)` is
 * well past a phone paragraph and far below anything worth storing in bulk;
 * `.min(1)` after `.trim()` refuses an empty filing, so a blank report cannot be
 * logged as if it said something.
 *
 * `kind` is a closed enum, the enum IS the guard, the same as `sort` at the
 * offers path. Anything outside the four the reader triages by would sit in the
 * column meaning nothing.
 *
 * `appLocale` is metadata (which language the reporter was reading), NOT
 * security-sensitive, so the client supplies it and the enum bounds it. `userId`
 * is deliberately ABSENT from this payload: attribution is resolved server-side
 * from the session in the action, never taken from the caller, for the same
 * reason `getMyReports` takes no arguments, a client-supplied identity on a
 * public endpoint is a breach waiting for a curl.
 */
const problemReportKind = z.enum(["price_wrong", "place_wrong", "app_bug", "other"], {
  errorMap: () => ({ message: "kind must be one of price_wrong, place_wrong, app_bug, other" }),
});

const submitProblemReportInput = z
  .object({
    kind: problemReportKind,
    body: z
      .string({ required_error: "body is required", invalid_type_error: "body must be a string" })
      .trim()
      .min(1, "say what's wrong")
      .max(1000, "keep it under 1000 characters"),
    appLocale: z.enum(["en", "pidgin", "yoruba"]).optional(),
  })
  .strict();

type SubmitProblemReportInput = z.infer<typeof submitProblemReportInput>;

/**
 * `updateMyProfile`: a signed-in user editing their OWN contact channel.
 *
 * Unlike `submitObservation` and `submitProblemReport`, this write is NOT
 * anonymous-first: the action resolves the session server-side and refuses
 * without one, because a profile belongs to exactly one account and the UI never
 * offers this control signed out. So identity is the action's job; the guard this
 * schema provides is shape and length.
 *
 * NAME AND EMAIL ARE ABSENT FROM THIS PAYLOAD ON PURPOSE. They live in
 * `neon_auth.user`, a Neon-managed table this app cannot write through Drizzle:
 * the UI edits the name client-side via `authClient.updateUser({ name })`, and
 * email is display-only (there is no mounted change-email route on this SDK). This
 * schema and `updateMyProfile` govern ONLY the contact pair, which is the piece
 * that lands in our own `user_profiles` table.
 *
 * The pair is both-or-neither, mirroring the `places` contact columns: a value
 * without a kind is not dialable, and a kind without a value is not a contact.
 * Sending null for both is how the UI clears a channel. `kind` is a closed enum
 * and the enum IS the guard; `value` is capped at the column width (255) so an
 * unthrottled write cannot turn a contact field into free storage, the same
 * reasoning as `body` on the problem report. Format is deliberately not pinned
 * tighter than length, because phone, whatsapp and sms are all phone-number
 * channels and over-rejecting a real number is worse than storing a loose one.
 *
 * `locationSharing` is a SINGLE optional flag, NOT part of the contact pair and
 * with no both-or-neither rule to satisfy: it is the map's public-location opt-in
 * (`user_profiles.location_sharing`, off by default). Optional is meaningful: an
 * absent flag means "leave it unchanged", which is why the action folds it in
 * only when it was sent rather than defaulting it to false on every save.
 */
const contactChannelKind = z.enum(["phone", "whatsapp", "sms"], {
  errorMap: () => ({ message: "contact channel must be one of phone, whatsapp, sms" }),
});

const updateMyProfileInput = z
  .object({
    contactChannelKind: contactChannelKind.nullish(),
    contactChannelValue: z
      .string({ invalid_type_error: "contact must be a string" })
      .trim()
      .min(1, "a contact needs a value")
      .max(255, "keep the contact under 255 characters")
      .nullish(),
    locationSharing: z
      .boolean({ invalid_type_error: "locationSharing must be true or false" })
      .optional(),
    latitude: z.number().finite().gte(-90).lte(90).nullish(),
    longitude: z.number().finite().gte(-180).lte(180).nullish(),
  })
  .strict()
  .refine((v) => (v.contactChannelKind == null) === (v.contactChannelValue == null), {
    message: "a contact needs both a channel and a value, or clear both",
    path: ["contactChannelValue"],
  });

type UpdateMyProfileInput = z.infer<typeof updateMyProfileInput>;

const submitReviewInput = z.object({
  reviewableType: z.string().trim().min(1, "reviewableType is required").max(100),
  reviewableId: z.string().uuid("reviewableId must be a valid UUID"),
  rating: z.number().int("rating must be an integer").min(1, "rating must be at least 1").max(5, "rating cannot be more than 5"),
  title: z.string().trim().max(255, "title must be under 255 characters").nullish(),
  body: z.string().trim().max(2000, "keep the review under 2000 characters").nullish(),
}).strict();

export type SubmitReviewInput = z.infer<typeof submitReviewInput>;

/* ─────────────────────────────────────────────────────────────────────────────
   The helper
   ──────────────────────────────────────────────────────────────────────────── */

/**
 * Parse, or throw with a message that names the action and the field.
 *
 * The rejected VALUE is never echoed. Two reasons: a reflected payload is a log
 * injection vector and a way to have the server store attacker-chosen bytes for
 * free, and Next.js redacts server-action error messages in production anyway ,
 * the client gets a digest, the message reaches the server log. Naming the path
 * and the rule is all the message needs to do, and the length cap keeps a
 * hostile payload from turning a hundred field errors into a log flood.
 */
function assertValid<T>(schema: z.ZodType<T>, data: unknown, action: string): T {
  const result = schema.safeParse(data);
  if (result.success) return result.data;

  const detail = result.error.issues
    .slice(0, 6)
    .map((i) => (i.path.length ? `${i.path.join(".")}: ${i.message}` : i.message))
    .join("; ")
    .slice(0, 400);

  throw new Error(`${action}: rejected invalid input, ${detail}`);
}

/* ─────────────────────────────────────────────────────────────────────────────
   Typed parsers, one per action, so wiring is one line and nothing below it moves.
   ──────────────────────────────────────────────────────────────────────────── */

export function parseSubmitObservation(data: unknown): SubmitObservationInput {
  return assertValid(submitObservationInput, data, "submitObservation");
}

export function parseVisitConfirmation(data: unknown): VisitConfirmationInput {
  return assertValid(visitConfirmationInput, data, "submitVisitConfirmation");
}

export function parseSearchQuery(query: unknown): string {
  return assertValid(searchQueryInput, query, "searchFoodItems");
}

export function parsePopularItemsLimit(limit: unknown): number {
  return assertValid(popularItemsLimitInput, limit, "getPopularItems");
}

export function parsePlaceOffersPlaceId(placeId: unknown): string {
  return assertValid(placeIdInput, placeId, "getPlaceOffers");
}

export function parseContactPolicyPlaceId(placeId: unknown): string {
  return assertValid(placeIdInput, placeId, "getPlaceContactPolicy");
}

export function parseOfferId(offerId: unknown): string {
  return assertValid(offerIdInput, offerId, "getVisitContext");
}

export function parseItemNarrowingOptions(data: unknown): z.infer<typeof itemNarrowingOptionsInput> {
  return assertValid(itemNarrowingOptionsInput, data, "getItemNarrowingOptions");
}

export function parseOffersNarrowed(data: unknown): z.infer<typeof offersNarrowedInput> {
  return assertValid(offersNarrowedInput, data, "getOffersNarrowed");
}

export function parsePlacesNear(data: unknown): z.infer<typeof placesNearInput> {
  return assertValid(placesNearInput, data, "getPlacesNear");
}

export function parseCoverageForPoint(data: unknown): z.infer<typeof coverageForPointInput> {
  return assertValid(coverageForPointInput, data, "getCoverageForPoint");
}

export function parseSubmitProblemReport(data: unknown): SubmitProblemReportInput {
  return assertValid(submitProblemReportInput, data, "submitProblemReport");
}

export function parseUpdateMyProfile(data: unknown): UpdateMyProfileInput {
  return assertValid(updateMyProfileInput, data, "updateMyProfile");
}

export function parseSubmitReview(data: unknown): SubmitReviewInput {
  return assertValid(submitReviewInput, data, "submitReview");
}
