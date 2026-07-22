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
