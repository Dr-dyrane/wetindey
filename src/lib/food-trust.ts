/**
 * Batched trust reads for the food read paths. INTERNAL, on purpose.
 *
 * This module used to live beside the actions as `_actions/food-trust.ts`,
 * and `food-actions.ts` wrapped `getOfferTrustBatchImpl` in two exported
 * `use server` functions. Those wrappers made a public HTTP endpoint out of
 * a helper with no parse boundary: an unbounded `keys` array, no UUID check,
 * no LIMIT, and zero callers outside the actions module (ADR-002 records the
 * orphaning; ADR-006 names the in-module read paths as the consumers; the
 * service architecture doc calls it "one consumer, this app"). Nothing in any
 * ADR asks for a public trust RPC, so the surface is gone rather than gated:
 * the read paths call `getOfferTrustBatchImpl` directly, in process, and a
 * future wiring that truly needs a client-callable action must add one WITH a
 * parsed schema, not resurrect the bare wrapper.
 *
 * NOT `use server`: a directive here would re-export every async function as
 * an endpoint again. The `db` import keeps it server-bound in practice.
 */
import { db } from "@/db";
import { observations, sources } from "@/db/schema";
import { and, asc, eq, or, sql } from "drizzle-orm";
import {
  assessTrust,
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

export interface OfferKey {
  itemVariantId: string;
  unitId: string;
  placeId: string;
}

export function offerKeyOf(key: OfferKey) {
  return `${key.itemVariantId}|${key.unitId}|${key.placeId}`;
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

export function nullableOfferKey(row: {
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

export function readTrustForKey(
  assessments: Record<string, TrustAssessment>,
  key: OfferKey | null,
  fallbackAvailability: string | null
): ReadTrust | null {
  if (!key) return toReadTrust(assessTrust([]), fallbackAvailability);
  const assessment = assessments[offerKeyOf(key)];
  return assessment ? toReadTrust(assessment, fallbackAvailability) : null;
}

export async function getOfferTrustBatchImpl(
  keys: OfferKey[]
): Promise<Record<string, TrustAssessment>> {
  if (keys.length === 0) return {};

  /*
   * DELIBERATELY NO `observed_at` WINDOW ON THIS READ. This was proposed as a
   * freshness-window predicate (grow-bounded read) and REFUTED against the
   * model and the live data; the ruling is recorded here so the next person
   * who reaches for `observed_at >=` has to argue with it, and the hardening
   * contract pins it.
   *
   * The only branch of `assessTrust` with a finite horizon is the evidence
   * sum: `ageDecay` (trust.ts) reaches ZERO at policy.expirationHours * 2,
   * 144h, so rows past 144h cannot move `confidenceScore`. Every other branch
   * legitimately reads older rows:
   *
   *   1. The newest admitted row, at ANY age, drives freshness, availability,
   *      ageHours and the expired copy ("Last seen N days ago, too old to
   *      stand behind", trust.ts `describe`). Windowed out, those keys would
   *      claim "Nobody has reported this yet", which is false.
   *   2. `provenanceSummary` feeds `toReadTrust`'s `origin` above, which is
   *      how an aged synthetic row keeps its ADR-015 "Sample" label. Measured
   *      on the dev database on 2026-07-23: 965 approved observations, all
   *      synthetic, roughly 95 percent already older than 144h (the exact
   *      count grows hourly as rows cross the boundary). A freshness-scale
   *      window flips that majority from "Sample" to "No observed reports"
   *      the day it ships; an oversized constant flips nothing at first and
   *      then silently breaks as rows age past it, so no constant is safe.
   *   3. `observationCount` / `distinctSourceCount` tally every admitted row
   *      and are RENDERED ("N reports · M sources",
   *      itemDetailSheetPresentation.ts), so a window deflates visible
   *      numbers on any key with mixed-age history.
   *
   * So the growth bound cannot come from a read predicate without changing
   * displayed semantics; it belongs to a retention/archival decision (routed
   * to the controller from sweep two). The read stays bounded per key by the
   * `(item_variant_id, unit_id, place_id)` composite index instead.
   */
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
        sql`${observations.moderationStatus} = 'approved'`,
        or(
          ...keys.map((key) =>
            and(
              eq(observations.itemVariantId, key.itemVariantId),
              eq(observations.unitId, key.unitId),
              eq(observations.placeId, key.placeId)
            )
          )
        )
      )
    )
    .orderBy(
      asc(observations.itemVariantId),
      asc(observations.unitId),
      asc(observations.placeId),
      sql`${observations.observedAt} desc`,
      asc(observations.id)
    );

  const grouped = new Map<string, TrustObservation[]>();
  for (const row of rows) {
    const key = offerKeyOf(row);
    const bucket = grouped.get(key);
    const observation: TrustObservation = {
      observedAt: row.observedAt,
      sourceId: row.sourceId,
      sourceReliability: row.sourceReliability,
      collectionMethod: row.collectionMethod,
      availabilityState: row.availabilityState,
      provenance: row.provenance,
    };
    if (bucket) bucket.push(observation);
    else grouped.set(key, [observation]);
  }

  const out: Record<string, TrustAssessment> = {};
  for (const key of keys) {
    const serializedKey = offerKeyOf(key);
    out[serializedKey] = assessTrust(grouped.get(serializedKey) ?? []);
  }
  return out;
}
