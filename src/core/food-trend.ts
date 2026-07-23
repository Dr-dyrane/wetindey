/**
 * Food Price Trend Engine
 *
 * Computes authoritative 7-day food price trends across an already validated,
 * homogeneous cohort (same variant, unit, geography, provenance origin).
 */

export type FoodPriceTrend =
  | { state: "insufficient"; label: "Not enough history" }
  | {
      state: "up" | "down" | "stable";
      window: "7d";
      changePercent: number;
      currentMedian: number;
      previousMedian: number;
      observationCount: number;
      placeCount: number;
      origin: "observed" | "sample";
      label: string;
    };

export interface CohortObservationPoint {
  priceAmount: number;
  observedAt: Date | number;
  availabilityState: string;
  provenance: "device" | "synthetic" | "partner" | "reference" | "inferred" | string;
  placeId: string;
  sourceId: string;
}

function computeMedian(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

interface WindowStats {
  validCount: number;
  placeCount: number;
  sourceCount: number;
  marketMedian: number;
}

function evaluateWindow(
  observations: readonly CohortObservationPoint[],
  minAgeMs: number,
  maxAgeMs: number,
  now: number
): WindowStats | null {
  const windowObs = observations.filter((obs) => {
    if (obs.availabilityState !== "available" || !Number.isFinite(obs.priceAmount) || obs.priceAmount <= 0) {
      return false;
    }
    const time = typeof obs.observedAt === "number" ? obs.observedAt : obs.observedAt.getTime();
    const age = now - time;
    return age >= minAgeMs && age <= maxAgeMs;
  });

  const places = new Set<string>();
  const sources = new Set<string>();
  const obsByPlace = new Map<string, number[]>();

  for (const obs of windowObs) {
    places.add(obs.placeId);
    sources.add(obs.sourceId);
    const list = obsByPlace.get(obs.placeId) ?? [];
    list.push(obs.priceAmount);
    obsByPlace.set(obs.placeId, list);
  }

  // Threshold: >= 3 valid observations, >= 2 distinct places, >= 2 independent sources
  if (windowObs.length < 3 || places.size < 2 || sources.size < 2) {
    return null;
  }

  // Calculate median for each place to prevent one reporter from dominating, then market median
  const placeMedians: number[] = [];
  for (const [, prices] of obsByPlace.entries()) {
    placeMedians.push(computeMedian(prices));
  }

  const marketMedian = computeMedian(placeMedians);
  if (marketMedian <= 0) return null;

  return {
    validCount: windowObs.length,
    placeCount: places.size,
    sourceCount: sources.size,
    marketMedian,
  };
}

export function calculateCohortFoodPriceTrend(
  observations: readonly CohortObservationPoint[],
  origin: "observed" | "sample",
  now: number = Date.now()
): FoodPriceTrend {
  const MS_PER_DAY = 24 * 60 * 60 * 1000;
  const SEVEN_DAYS_MS = 7 * MS_PER_DAY;
  const FOURTEEN_DAYS_MS = 14 * MS_PER_DAY;

  // Evaluate current (0-7d) and previous (7d-14d) windows
  const current = evaluateWindow(observations, 0, SEVEN_DAYS_MS, now);
  const previous = evaluateWindow(observations, SEVEN_DAYS_MS, FOURTEEN_DAYS_MS, now);

  if (!current || !previous) {
    return { state: "insufficient", label: "Not enough history" };
  }

  const rawChangePercent = ((current.marketMedian - previous.marketMedian) / previous.marketMedian) * 100;
  const changePercent = Math.round(rawChangePercent * 10) / 10;

  const totalObsCount = current.validCount + previous.validCount;
  const allPlaces = new Set<string>();
  for (const obs of observations) {
    const time = typeof obs.observedAt === "number" ? obs.observedAt : obs.observedAt.getTime();
    const age = now - time;
    if (age >= 0 && age <= FOURTEEN_DAYS_MS) {
      allPlaces.add(obs.placeId);
    }
  }

  let state: "up" | "down" | "stable" = "stable";
  let label = "Stable this week";

  if (changePercent >= 2.0) {
    state = "up";
    label = `Up ${Math.round(changePercent)}% this week`;
  } else if (changePercent <= -2.0) {
    state = "down";
    label = `Down ${Math.abs(Math.round(changePercent))}% this week`;
  }

  return {
    state,
    window: "7d",
    changePercent,
    currentMedian: current.marketMedian,
    previousMedian: previous.marketMedian,
    observationCount: totalObsCount,
    placeCount: allPlaces.size,
    origin,
    label,
  };
}

/**
 * The succinct VISIBLE badge for a computed trend: a direction arrow and the
 * rounded percent, nothing else (↑4%, ↓4%, →0%). The verbose `label`
 * ("Down 4% this week") stays as the accessible, screen-reader form, because a
 * reader over a lone glyph announces nothing useful. The cadence is weekly and
 * constant, so once a viewer has seen it, spelling out "this week" on every card
 * is noise: the house rule is the most succinct copy, Apple style.
 *
 * Returns null when there is no trend to show, so a caller can gate on it. This
 * is the single source of the glyph+percent form, shared by the item card and
 * the cross-category signal rail so the two can never drift apart.
 */
export function trendBadge(trend: FoodPriceTrend): string | null {
  if (trend.state === "insufficient") return null;
  const arrow = trend.state === "up" ? "↑" : trend.state === "down" ? "↓" : "→";
  return `${arrow}${Math.abs(Math.round(trend.changePercent))}%`;
}
