import assert from "node:assert/strict";
import test from "node:test";
import { calculateCohortFoodPriceTrend, type CohortObservationPoint } from "../src/core/food-trend";

test("Food Price Trend Engine Contracts", async (t) => {
  const now = Date.now();
  const MS_PER_DAY = 24 * 60 * 60 * 1000;

  await t.test("returns insufficient when observations < 3, places < 2, or sources < 2", () => {
    const sparseObs: CohortObservationPoint[] = [
      { priceAmount: 2500, observedAt: now - 2 * MS_PER_DAY, availabilityState: "available", provenance: "device", placeId: "p1", sourceId: "s1" },
      { priceAmount: 2500, observedAt: now - 3 * MS_PER_DAY, availabilityState: "available", provenance: "device", placeId: "p2", sourceId: "s2" },
      // Previous window missing
    ];

    const result = calculateCohortFoodPriceTrend(sparseObs, "observed", now);
    assert.equal(result.state, "insufficient");
    assert.equal(result.label, "Not enough history");
  });

  await t.test("calculates 'up' trend correctly when thresholds are met", () => {
    const obs: CohortObservationPoint[] = [
      // Current 7d window (median 2600, 3 obs, 2 places, 2 sources)
      { priceAmount: 2600, observedAt: now - 2 * MS_PER_DAY, availabilityState: "available", provenance: "device", placeId: "p1", sourceId: "s1" },
      { priceAmount: 2600, observedAt: now - 3 * MS_PER_DAY, availabilityState: "available", provenance: "device", placeId: "p1", sourceId: "s2" },
      { priceAmount: 2600, observedAt: now - 4 * MS_PER_DAY, availabilityState: "available", provenance: "device", placeId: "p2", sourceId: "s2" },

      // Previous 7d window (median 2400, 3 obs, 2 places, 2 sources)
      { priceAmount: 2400, observedAt: now - 9 * MS_PER_DAY, availabilityState: "available", provenance: "device", placeId: "p1", sourceId: "s1" },
      { priceAmount: 2400, observedAt: now - 10 * MS_PER_DAY, availabilityState: "available", provenance: "device", placeId: "p2", sourceId: "s2" },
      { priceAmount: 2400, observedAt: now - 11 * MS_PER_DAY, availabilityState: "available", provenance: "device", placeId: "p2", sourceId: "s1" },
    ];

    const result = calculateCohortFoodPriceTrend(obs, "observed", now);
    assert.equal(result.state, "up");
    if (result.state === "up") {
      assert.equal(result.changePercent, 8.3);
      assert.equal(result.label, "Up 8% this week");
      assert.equal(result.origin, "observed");
    }
  });

  await t.test("calculates 'down' trend correctly for sample origin", () => {
    const obs: CohortObservationPoint[] = [
      // Current 7d window (median 2200)
      { priceAmount: 2200, observedAt: now - 2 * MS_PER_DAY, availabilityState: "available", provenance: "synthetic", placeId: "p1", sourceId: "s1" },
      { priceAmount: 2200, observedAt: now - 3 * MS_PER_DAY, availabilityState: "available", provenance: "synthetic", placeId: "p2", sourceId: "s2" },
      { priceAmount: 2200, observedAt: now - 4 * MS_PER_DAY, availabilityState: "available", provenance: "synthetic", placeId: "p2", sourceId: "s1" },

      // Previous 7d window (median 2400)
      { priceAmount: 2400, observedAt: now - 9 * MS_PER_DAY, availabilityState: "available", provenance: "synthetic", placeId: "p1", sourceId: "s1" },
      { priceAmount: 2400, observedAt: now - 10 * MS_PER_DAY, availabilityState: "available", provenance: "synthetic", placeId: "p2", sourceId: "s2" },
      { priceAmount: 2400, observedAt: now - 11 * MS_PER_DAY, availabilityState: "available", provenance: "synthetic", placeId: "p2", sourceId: "s1" },
    ];

    const result = calculateCohortFoodPriceTrend(obs, "sample", now);
    assert.equal(result.state, "down");
    if (result.state === "down") {
      assert.equal(result.changePercent, -8.3);
      assert.equal(result.label, "Down 8% this week");
      assert.equal(result.origin, "sample");
    }
  });

  await t.test("calculates 'stable' trend when movement is within [-2%, +2%]", () => {
    const obs: CohortObservationPoint[] = [
      // Current 7d window
      { priceAmount: 2410, observedAt: now - 2 * MS_PER_DAY, availabilityState: "available", provenance: "device", placeId: "p1", sourceId: "s1" },
      { priceAmount: 2410, observedAt: now - 3 * MS_PER_DAY, availabilityState: "available", provenance: "device", placeId: "p2", sourceId: "s2" },
      { priceAmount: 2410, observedAt: now - 4 * MS_PER_DAY, availabilityState: "available", provenance: "device", placeId: "p2", sourceId: "s1" },

      // Previous 7d window
      { priceAmount: 2400, observedAt: now - 9 * MS_PER_DAY, availabilityState: "available", provenance: "device", placeId: "p1", sourceId: "s1" },
      { priceAmount: 2400, observedAt: now - 10 * MS_PER_DAY, availabilityState: "available", provenance: "device", placeId: "p2", sourceId: "s2" },
      { priceAmount: 2400, observedAt: now - 11 * MS_PER_DAY, availabilityState: "available", provenance: "device", placeId: "p2", sourceId: "s1" },
    ];

    const result = calculateCohortFoodPriceTrend(obs, "observed", now);
    assert.equal(result.state, "stable");
    assert.equal(result.label, "Stable this week");
  });
});
