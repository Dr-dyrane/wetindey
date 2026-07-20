/**
 * Food Price Trend Engine
 *
 * Computes authoritative 7-day food price trends by comparing median prices
 * of available-price observations in the current 7-day window vs the previous
 * 7-day window (7-14 days ago) for identical item variants and units.
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

export interface RawObservationPoint {
  priceAmount: number;
  observedAt: Date | number;
  availabilityState: string;
  provenance: string;
  placeId: string;
}

function computeMedian(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

export function calculateFoodPriceTrend(
  observations: readonly RawObservationPoint[],
  now: number = Date.now()
): FoodPriceTrend {
  const MS_PER_DAY = 24 * 60 * 60 * 1000;
  const SEVEN_DAYS_MS = 7 * MS_PER_DAY;
  const FOURTEEN_DAYS_MS = 14 * MS_PER_DAY;

  // Filter available-price observations only
  const available = observations.filter(
    (o) => o.availabilityState === "available" && Number.isFinite(o.priceAmount) && o.priceAmount > 0
  );

  const currentWindowPrices: number[] = [];
  const previousWindowPrices: number[] = [];
  const currentPlaces = new Set<string>();
  const previousPlaces = new Set<string>();
  let hasSynthetic = false;

  for (const obs of available) {
    const time = typeof obs.observedAt === "number" ? obs.observedAt : obs.observedAt.getTime();
    const age = now - time;

    if (obs.provenance === "synthetic" || obs.provenance === "sample") {
      hasSynthetic = true;
    }

    if (age >= 0 && age <= SEVEN_DAYS_MS) {
      currentWindowPrices.push(obs.priceAmount);
      currentPlaces.add(obs.placeId);
    } else if (age > SEVEN_DAYS_MS && age <= FOURTEEN_DAYS_MS) {
      previousWindowPrices.push(obs.priceAmount);
      previousPlaces.add(obs.placeId);
    }
  }

  // Require evidence in both comparison windows (current 7d and previous 7d)
  if (currentWindowPrices.length === 0 || previousWindowPrices.length === 0) {
    return { state: "insufficient", label: "Not enough history" };
  }

  const currentMedian = computeMedian(currentWindowPrices);
  const previousMedian = computeMedian(previousWindowPrices);

  if (previousMedian <= 0) {
    return { state: "insufficient", label: "Not enough history" };
  }

  const rawChangePercent = ((currentMedian - previousMedian) / previousMedian) * 100;
  const changePercent = Math.round(rawChangePercent * 10) / 10; // 1 decimal place

  const allPlaces = new Set([...currentPlaces, ...previousPlaces]);
  const totalObsCount = currentWindowPrices.length + previousWindowPrices.length;
  const origin: "observed" | "sample" = hasSynthetic ? "sample" : "observed";

  let state: "up" | "down" | "stable" = "stable";
  let label = "Stable this week";

  if (changePercent >= 1.0) {
    state = "up";
    label = `Up ${Math.round(changePercent)}% this week`;
  } else if (changePercent <= -1.0) {
    state = "down";
    label = `Down ${Math.abs(Math.round(changePercent))}% this week`;
  }

  return {
    state,
    window: "7d",
    changePercent,
    currentMedian,
    previousMedian,
    observationCount: totalObsCount,
    placeCount: allPlaces.size,
    origin,
    label,
  };
}
