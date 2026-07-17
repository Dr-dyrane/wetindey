/**
 * The trust model.
 *
 * WetinDey's claim is not "we have prices" — it is "we know how old this price
 * is and how many people stand behind it". This module is that claim, expressed
 * once, in one place, testable without a database.
 *
 * ─── Provenance ────────────────────────────────────────────────────────────
 *
 * This is a PORT, not a new invention. The repo already contained a real trust
 * model with zero importers:
 *
 *   src/modules/food/application/FoodModule.ts:138-176
 *     · freshnessPolicy { staleHours: 24, expirationHours: 72 }   (:139-142)
 *     · age-decayed confidence                                     (:167-168)
 *     · confidence-ranked sorting                                  (:238-240)
 *
 * The seed already derives freshness from that same policy (src/db/seed.ts:29-30,
 * :309-315). The app's WRITE path now does too — `submitObservation` derives
 * `trust_level` and `freshness_state` through `assessTrust` and windows its price
 * band on `FRESHNESS_POLICY`, so this module has live call sites rather than
 * aspirational ones.
 *
 * One caller still holds the old arithmetic: `getFoodItemCandidates`
 * (src/app/actions.ts:194) computes `supportingObservationCount * 10` — uncapped,
 * and blind to who reported. Ten reports from one person on a sofa read as 100%.
 * Its consumer is owned by another lane and it is flagged, not silently moved.
 *
 * What this module keeps from FoodModule, verbatim in spirit:
 *   · the 24h/72h policy                          (FoodModule.ts:139-142)
 *   · the linear age-decay curve                  (FoodModule.ts:167)
 *   · newest observation drives freshness         (FoodModule.ts:154-157)
 *   · confidence-descending ranking               (FoodModule.ts:238-240)
 *
 * What it adds, because FoodModule assessed only the single latest observation
 * and therefore never had to:
 *   · collection method weight    — a visit confirmation outranks a form fill
 *   · source reliability          — sources.reliabilityScoreInternal, 98/85/75,
 *                                   which until now was read by nothing
 *   · DISTINCT-source aggregation with a per-source cap, so three reports from
 *     one source cannot equal three reports from three
 *
 * ─── The shape of the answer ───────────────────────────────────────────────
 *
 * `offers_current.freshness_state` is confirmed|caution|unavailable. That column
 * is two columns wearing a trenchcoat: the first two values describe HOW RECENTLY
 * WE HEARD, the third describes WHAT WE HEARD. They are independent facts — a
 * report from five minutes ago saying "they're sold out" is maximally fresh AND
 * unavailable, and today that offer is indistinguishable from one nobody has
 * looked at in a week.
 *
 * This module returns them separately — `freshness` and `availability`. See
 * `legacyFreshnessState()` for the lossy collapse back to the single column.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Policy
// ─────────────────────────────────────────────────────────────────────────────

interface FreshnessPolicy {
  /** Beyond this, we say "check before you go". FoodModule.ts:141. */
  staleHours: number;
  /** Beyond this, we stop standing behind the price at all. FoodModule.ts:140. */
  expirationHours: number;
}

/**
 * The one policy. FoodModule.ts:139-142 declared it; src/db/seed.ts:29-30
 * duplicated its numbers as bare constants. Both should import this.
 */
export const FRESHNESS_POLICY: FreshnessPolicy = {
  staleHours: 24,
  expirationHours: 72,
};

/**
 * How much a report is worth by how it was collected.
 *
 * Grounded in what the codebase actually writes, not in what would be tidy:
 *   · 'visit_confirmation' — src/app/actions.ts:512, :601. Somebody went to the
 *     place and confirmed. This is the strongest signal the app can produce: the
 *     act of arriving is the corroboration.
 *   · 'app_entry'          — src/app/actions.ts:275, src/db/seed.ts:294. A form
 *     fill. Honest, but unwitnessed — the reporter may be on a sofa.
 *   · 'sms', 'scraper'     — declared in src/db/schema/index.ts:175, written by
 *     nothing yet. Weighted now so that the day they start writing, they do not
 *     silently arrive at parity with a person who walked to the market.
 *
 * There is deliberately no default. See `methodWeight()`.
 */
export const COLLECTION_METHOD_WEIGHTS: Readonly<Record<string, number>> = {
  visit_confirmation: 1.0,
  app_entry: 0.8,
  sms: 0.7,
  scraper: 0.6,
};

/**
 * The most one source can ever contribute to total evidence, no matter how many
 * times it reports. This is the cap that makes the model resistant to the sofa:
 * a single source saturates at the worth of one perfect report.
 */
const PER_SOURCE_CAP = 1.0;

/**
 * Weight multiplier applied to a source's 2nd, 3rd, … report (0.35, then 0.1225…).
 * Repetition from the same mouth is worth something — it is a re-check, and a
 * re-check is not nothing — but it decays fast and hits PER_SOURCE_CAP quickly.
 */
const REPEAT_OBSERVATION_DECAY = 0.35;

/**
 * Saturation constant for the evidence → score curve. See `scoreFromEvidence()`.
 * Tuned so the 2nd and 3rd distinct source move the number most, which is where
 * the real information is.
 */
const EVIDENCE_SATURATION = 1.6;

// ─────────────────────────────────────────────────────────────────────────────
// Inputs and outputs
// ─────────────────────────────────────────────────────────────────────────────

/**
 * One row of evidence. Maps to `observations` joined to `sources`
 * (src/db/schema/index.ts:154-179). Deliberately plain — no Drizzle types, no
 * Date-vs-string ambiguity at the call site, so this module is testable with
 * object literals and no database.
 */
export interface TrustObservation {
  /** observations.observed_at */
  observedAt: Date | string;
  /** observations.source_id — the identity that makes "distinct" meaningful. */
  sourceId: string;
  /** sources.reliability_score_internal, 0-100. Seeded 98/85/75 (seed.ts:199-201). */
  sourceReliability: number;
  /** observations.collection_method — must be a key of COLLECTION_METHOD_WEIGHTS. */
  collectionMethod: string;
  /** observations.availability_state — 'available' | 'unavailable'. */
  availabilityState: string;
}

/** How recently we heard. Nothing to do with what we heard. */
export type Freshness = "fresh" | "stale" | "expired";

/** What we heard. Nothing to do with how recently. */
export type Availability = "available" | "unavailable";

/**
 * PROVISIONAL. What earns each band is a product decision, not an engineering
 * one — see the module docblock in the handover and `trustBand()` below.
 */
type TrustBand = "high" | "medium" | "low" | "none";

export interface TrustAssessment {
  /** 0-100. Asymptotic: it never reaches 100, because we are never certain. */
  confidenceScore: number;
  /** PROVISIONAL banding — see `trustBand()`. */
  band: TrustBand;
  /** How recently we heard. */
  freshness: Freshness;
  /** What we heard, per the newest report. */
  availability: Availability;
  /** Age of the newest report, in hours. */
  ageHours: number;
  /** People, not reports. This is the number that carries trust. */
  distinctSourceCount: number;
  /** Raw tally, for comparison against offers_current.supporting_observation_count. */
  observationCount: number;
  /** Summed per-source contribution, each capped at PER_SOURCE_CAP. Unbounded above. */
  evidence: number;
  /** Human-readable, in the app's voice. */
  explanation: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// The model
// ─────────────────────────────────────────────────────────────────────────────

const MS_PER_HOUR = 3_600_000;

/** Tolerance for client clock skew before a future timestamp is a data fault. */
const FUTURE_SKEW_TOLERANCE_HOURS = 1;

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}

function toMillis(value: Date | string): number {
  const ms = value instanceof Date ? value.getTime() : Date.parse(value);
  // A timestamp we cannot read is not a timestamp we may guess at. The (0,0)
  // incident is the whole argument: a plausible wrong answer hides for months.
  if (!Number.isFinite(ms)) {
    throw new Error(`trust: undecodable observedAt ${JSON.stringify(value)}`);
  }
  return ms;
}

/**
 * Age in hours, as a non-negative number.
 *
 * A report dated in the future is a fault — a broken client clock, or a bug that
 * writes `expiresAt` into `observedAt`. Small skew is normal and clamps to zero;
 * anything past the tolerance throws, because "reported 40 years from now" would
 * otherwise read as permanently, maximally fresh. That is exactly the class of
 * plausible-wrong the repo has already paid for once.
 */
function ageHoursOf(observedAt: Date | string, now: number = Date.now()): number {
  const ageH = (now - toMillis(observedAt)) / MS_PER_HOUR;
  if (ageH < -FUTURE_SKEW_TOLERANCE_HOURS) {
    throw new Error(
      `trust: observation dated ${Math.abs(Math.round(ageH))}h in the future (${String(observedAt)})`
    );
  }
  return Math.max(0, ageH);
}

/**
 * The age-decay curve, ported from FoodModule.ts:167.
 *
 *   FoodModule:  Math.max(0.5, 1 - ageHours / (expirationHours * 2))
 *   here:        clamp01(       1 - ageHours / (expirationHours * 2))
 *
 * Same slope, same intercept, ZERO at 144h. The 0.5 floor is dropped on purpose,
 * and the reason is the one substantive difference between the two models:
 * FoodModule assessed only the single latest observation (:154-157), so a floor
 * was harmless — the level was forced to "unavailable" past 72h anyway (:160-161).
 * This module SUMS across observations. With a floor, a hundred ancient reports
 * would pile up into high confidence forever. Evidence has to be able to reach
 * zero, or age stops meaning anything.
 */
export function ageDecay(
  ageHours: number,
  policy: FreshnessPolicy = FRESHNESS_POLICY
): number {
  return clamp01(1 - ageHours / (policy.expirationHours * 2));
}

/**
 * Weight for a collection method.
 *
 * Throws on an unrecognised method rather than defaulting. A new method string
 * arriving with a silent 0.5 would quietly re-weight the entire corpus and
 * nobody would notice for months; an exception surfaces on the first write.
 * Adding a method to the schema means deciding what it is worth — that decision
 * belongs here, made deliberately, not inferred by a fallback.
 */
function methodWeight(collectionMethod: string): number {
  const weight = COLLECTION_METHOD_WEIGHTS[collectionMethod];
  if (weight === undefined) {
    throw new Error(
      `trust: unweighted collectionMethod ${JSON.stringify(collectionMethod)} — ` +
        `add it to COLLECTION_METHOD_WEIGHTS in src/lib/trust.ts with a deliberate weight`
    );
  }
  return weight;
}

/** Normalise sources.reliability_score_internal (0-100) to a 0-1 multiplier. */
function reliabilityWeight(sourceReliability: number): number {
  if (!Number.isFinite(sourceReliability) || sourceReliability < 0 || sourceReliability > 100) {
    throw new Error(`trust: sourceReliability out of range: ${sourceReliability}`);
  }
  return sourceReliability / 100;
}

/**
 * What one report is worth: who said it × how they said it × how long ago.
 * Range 0-1. A perfect report is a maximally reliable source confirming a visit
 * right now.
 */
function observationWeight(
  observation: TrustObservation,
  now: number = Date.now(),
  policy: FreshnessPolicy = FRESHNESS_POLICY
): number {
  return (
    reliabilityWeight(observation.sourceReliability) *
    methodWeight(observation.collectionMethod) *
    ageDecay(ageHoursOf(observation.observedAt, now), policy)
  );
}

/**
 * What ONE source is worth across all its reports — the anti-sofa function.
 *
 * Best report at full weight, each subsequent one decayed by
 * REPEAT_OBSERVATION_DECAY, the total capped at PER_SOURCE_CAP. So one source
 * reporting three times lands at ~1.0; three sources reporting once each land at
 * ~3.0. The brief's requirement, arithmetically: three reports from one source
 * do not equal three from three.
 */
function sourceContribution(
  weights: number[],
  cap: number = PER_SOURCE_CAP
): number {
  const ordered = [...weights].sort((a, b) => b - a);
  const total = ordered.reduce(
    (sum, weight, index) => sum + weight * Math.pow(REPEAT_OBSERVATION_DECAY, index),
    0
  );
  return Math.min(cap, total);
}

/**
 * Evidence → a 0-100 score.
 *
 *   score = 100 * (1 - e^(-evidence / EVIDENCE_SATURATION))
 *
 * Saturating, and it never reaches 100 — which is the honest shape. Certainty is
 * not available to us; we are counting strangers' recollections of a market
 * stall. The curve is steepest where the information is (the jump from one
 * source to two, and two to three) and flattens after, because the tenth
 * corroboration tells you far less than the second did.
 *
 * For orientation, with perfect fresh reports (weight ~1 each):
 *   1 source → ~46    2 sources → ~71    3 sources → ~85    4 sources → ~91
 *
 * One report is 46, and that is deliberate. One report is one person.
 */
function scoreFromEvidence(evidence: number): number {
  if (!Number.isFinite(evidence) || evidence < 0) {
    throw new Error(`trust: evidence out of range: ${evidence}`);
  }
  return Math.round(100 * (1 - Math.exp(-evidence / EVIDENCE_SATURATION)));
}

/**
 * How recently we heard — and ONLY that.
 *
 * Ported from FoodModule.ts:159-164, with the availability value removed from
 * the enum. FoodModule's third state ("unavailable") answered a different
 * question than its first two, which is the conflation this module exists to
 * undo.
 */
function freshnessOf(
  ageHours: number,
  policy: FreshnessPolicy = FRESHNESS_POLICY
): Freshness {
  if (ageHours > policy.expirationHours) return "expired";
  if (ageHours > policy.staleHours) return "stale";
  return "fresh";
}

/**
 * PROVISIONAL — the thresholds below are an engineering placeholder for a
 * product decision that has been raised as a blocker, not a decision this module
 * made. "High" is what WetinDey stands behind; what earns it is not an
 * implementation detail. Recommendation and reasoning are in the handover.
 *
 * Encoded here so there is exactly one place to change when the call is made,
 * rather than a threshold smeared across call sites.
 */
const TRUST_BANDS = {
  /** Provisional: ≥2 fresh distinct sources, roughly. */
  high: 70,
  /** Provisional: roughly one solid fresh report. */
  medium: 40,
  /** Below `medium` but non-zero evidence. */
  low: 1,
} as const;

function trustBand(confidenceScore: number, freshness: Freshness): TrustBand {
  // No evidence is 'none', and it outranks every other rule. Checked before the
  // expiry gate because an observation old enough to have fully decayed (>144h,
  // ageDecay hits zero) carries exactly as much information as no observation at
  // all — and must not read as 'low', which implies we know something faint. We
  // know nothing. Say so.
  if (confidenceScore < TRUST_BANDS.low) return "none";
  // Expiry is a hard gate regardless of score, mirroring FoodModule.ts:160-161:
  // past 72h we do not stand behind the price, however many people once said it.
  if (freshness === "expired") return "low";
  if (confidenceScore >= TRUST_BANDS.high) return "high";
  if (confidenceScore >= TRUST_BANDS.medium) return "medium";
  return "low";
}

/**
 * The lossy collapse back to `offers_current.freshness_state`
 * (src/db/schema/index.ts:192), whose enum is confirmed|caution|unavailable.
 *
 * Provided so callers can keep writing the column that exists today while the
 * two-column split is scheduled. It is lossy in one direction that matters:
 * "sold out five minutes ago" and "nobody has looked in a week" both collapse to
 * 'unavailable', and no reader can tell them apart afterwards. That information
 * loss is the argument for the migration, not a reason to route around it here.
 */
export function legacyFreshnessState(
  freshness: Freshness,
  availability: Availability
): "confirmed" | "caution" | "unavailable" {
  if (availability === "unavailable") return "unavailable";
  if (freshness === "expired") return "unavailable";
  if (freshness === "stale") return "caution";
  return "confirmed";
}

function describe(
  ageHours: number,
  distinctSourceCount: number,
  freshness: Freshness,
  availability: Availability
): string {
  const when =
    ageHours < 1
      ? "less than an hour ago"
      : ageHours < 48
        ? `${Math.round(ageHours)}h ago`
        : `${Math.round(ageHours / 24)} days ago`;

  /**
   * "sources", not "people" — and the difference is the product's core claim,
   * so it is not a wording preference.
   *
   * This string used to read "N different people". It was measurably false, and
   * the wiring of accounts (ADR-003) makes it false in a NEW way rather than
   * fixing it, which is why it is corrected here and not left to become true on
   * its own:
   *
   *   · The shared ANONYMOUS row is an unknown number of people — everyone who
   *     ever reported without an account — collapsed into one row. It counts as
   *     1. "1 person" understates it and misdescribes it in the same breath.
   *   · 'Public data' is a dataset and 'Vendor' is a shop. Neither is a person
   *     at all. Against the live database, 163 offer groups count 2 sources and
   *     156 count 3 — those are these CATEGORY rows, because the seed spread
   *     observations across all three. Every one of those "3 different people"
   *     was three categories.
   *   · Only a signed-in contributor's own row is reliably one human, and even
   *     that is one ACCOUNT.
   *
   * `distinctSourceCount` is `weightsBySource.size` — a count of source rows.
   * "Sources" is what the number is, and it stays true whatever mix of accounts,
   * pools and feeds the table holds. The claim WetinDey wants to make — "N
   * different PEOPLE stand behind this price" — needs a count that admits only
   * attributed rows; it is not available yet and must not be implied by copy.
   * Raised in the handover: the words belong to the design lane, the honesty
   * does not.
   */
  const who =
    distinctSourceCount === 1
      ? "1 source"
      : `${distinctSourceCount} different sources`;

  if (availability === "unavailable") {
    return `Reported sold out ${when}.`;
  }
  if (freshness === "expired") {
    return `Last seen ${when} — too old to stand behind.`;
  }
  if (freshness === "stale") {
    return `${who} reported this, last seen ${when}. Check before you go.`;
  }
  return `${who} reported this, last seen ${when}.`;
}

/**
 * Assess a set of observations backing ONE offer — one (item variant, unit,
 * place) triple.
 *
 * Live call sites: `submitObservation` (the write path — it derives the
 * `trust_level` and `freshness_state` it stores from this) and
 * `getOfferTrustBatch` (the read path). `getFoodItemCandidates` still reports
 * `supportingObservationCount * 10` and is the last holdout; see the module
 * docblock.
 *
 * Callers must pass only observations they consider admissible; this module does
 * not know about moderation. The two paths do not currently agree on what
 * admissible means — the write path admits `moderation_status = 'approved'`,
 * `getOfferTrustBatch` admits `<> 'rejected'`. Identical today (every row in the
 * live table is 'approved'), divergent the day anything writes 'pending'. That
 * is a moderation-policy decision with no moderator to make it, and it is
 * escalated rather than settled by whichever function was edited last.
 *
 * The reliability weighting ADR-003 asked for is not new code — `observationWeight`
 * has multiplied by `reliabilityWeight(sourceReliability)` since this module was
 * written. What was missing was an INPUT that varied: every contribution resolved
 * to one shared source row, so the model faithfully weighted a constant. The fix
 * was in the write path, not here.
 */
export function assessTrust(
  observations: TrustObservation[],
  now: number = Date.now(),
  policy: FreshnessPolicy = FRESHNESS_POLICY
): TrustAssessment {
  if (observations.length === 0) {
    return {
      confidenceScore: 0,
      band: "none",
      freshness: "expired",
      availability: "unavailable",
      ageHours: Infinity,
      distinctSourceCount: 0,
      observationCount: 0,
      evidence: 0,
      explanation: "Nobody has reported this yet.",
    };
  }

  // Newest report drives freshness AND availability — FoodModule.ts:154-157, and
  // the same rule the seed writes by (src/db/seed.ts:300-302: only the newest
  // report carries current availability; older ones are history).
  let newest = observations[0];
  let newestMs = toMillis(newest.observedAt);
  for (const observation of observations) {
    const ms = toMillis(observation.observedAt);
    if (ms > newestMs) {
      newest = observation;
      newestMs = ms;
    }
  }

  const ageHours = ageHoursOf(newest.observedAt, now);
  const freshness = freshnessOf(ageHours, policy);

  if (newest.availabilityState !== "available" && newest.availabilityState !== "unavailable") {
    throw new Error(
      `trust: unknown availabilityState ${JSON.stringify(newest.availabilityState)}`
    );
  }
  const availability: Availability = newest.availabilityState;

  // Group by source, then cap each source. This is the whole point: the unit of
  // trust is a person, not a row.
  const weightsBySource = new Map<string, number[]>();
  for (const observation of observations) {
    if (!observation.sourceId) {
      throw new Error("trust: observation without a sourceId cannot be attributed");
    }
    const weight = observationWeight(observation, now, policy);
    const existing = weightsBySource.get(observation.sourceId);
    if (existing) existing.push(weight);
    else weightsBySource.set(observation.sourceId, [weight]);
  }

  let evidence = 0;
  for (const weights of weightsBySource.values()) {
    evidence += sourceContribution(weights);
  }

  const confidenceScore = scoreFromEvidence(evidence);
  const distinctSourceCount = weightsBySource.size;

  return {
    confidenceScore,
    band: trustBand(confidenceScore, freshness),
    freshness,
    availability,
    ageHours,
    distinctSourceCount,
    observationCount: observations.length,
    evidence,
    explanation: describe(ageHours, distinctSourceCount, freshness, availability),
  };
}

/**
 * Confidence-descending sort — ported from FoodModule.ts:238-240, which sorted
 * `b.detail.confidenceScore - a.detail.confidenceScore` and had no importers.
 *
 * Ties break on freshness, then on distinct sources: between two equal scores,
 * prefer the one we heard about more recently, then the one more people saw.
 */
function rankByConfidence<T>(
  candidates: T[],
  assessmentOf: (candidate: T) => TrustAssessment
): T[] {
  return [...candidates].sort((a, b) => {
    const left = assessmentOf(a);
    const right = assessmentOf(b);
    if (right.confidenceScore !== left.confidenceScore) {
      return right.confidenceScore - left.confidenceScore;
    }
    if (left.ageHours !== right.ageHours) return left.ageHours - right.ageHours;
    return right.distinctSourceCount - left.distinctSourceCount;
  });
}
