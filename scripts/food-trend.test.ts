import assert from "node:assert/strict";
import test from "node:test";
import { calculateFoodPriceTrend, type RawObservationPoint } from "../src/core/food-trend";

test("Food Price Trend Engine Contracts", async (t) => {
  const now = Date.now();
  const MS_PER_DAY = 24 * 60 * 60 * 1000;

  await t.test("returns insufficient when current or previous window lacks data", () => {
    const sparseObs: RawObservationPoint[] = [
      {
        priceAmount: 2500,
        observedAt: now - 2 * MS_PER_DAY,
        availabilityState: "available",
        provenance: "device",
        placeId: "place-1",
      },
    ];

    const result = calculateFoodPriceTrend(sparseObs, now);
    assert.equal(result.state, "insufficient");
    assert.equal(result.label, "Not enough history");
  });

  await t.test("calculates 'up' trend correctly", () => {
    const obs: RawObservationPoint[] = [
      // Current 7d window (median 2600)
      { priceAmount: 2600, observedAt: now - 2 * MS_PER_DAY, availabilityState: "available", provenance: "device", placeId: "p1" },
      { priceAmount: 2600, observedAt: now - 4 * MS_PER_DAY, availabilityState: "available", provenance: "device", placeId: "p2" },
      // Previous 7d window (median 2400)
      { priceAmount: 2400, observedAt: now - 9 * MS_PER_DAY, availabilityState: "available", provenance: "device", placeId: "p1" },
      { priceAmount: 2400, observedAt: now - 11 * MS_PER_DAY, availabilityState: "available", provenance: "device", placeId: "p2" },
    ];

    const result = calculateFoodPriceTrend(obs, now);
    assert.equal(result.state, "up");
    if (result.state === "up") {
      assert.equal(result.changePercent, 8.3);
      assert.equal(result.label, "Up 8% this week");
      assert.equal(result.origin, "observed");
    }
  });

  await t.test("calculates 'down' trend correctly", () => {
    const obs: RawObservationPoint[] = [
      // Current 7d window (median 2200)
      { priceAmount: 2200, observedAt: now - 3 * MS_PER_DAY, availabilityState: "available", provenance: "synthetic", placeId: "p1" },
      { priceAmount: 2200, observedAt: now - 5 * MS_PER_DAY, availabilityState: "available", provenance: "synthetic", placeId: "p2" },
      // Previous 7d window (median 2400)
      { priceAmount: 2400, observedAt: now - 10 * MS_PER_DAY, availabilityState: "available", provenance: "synthetic", placeId: "p1" },
      { priceAmount: 2400, observedAt: now - 12 * MS_PER_DAY, availabilityState: "available", provenance: "synthetic", placeId: "p2" },
    ];

    const result = calculateFoodPriceTrend(obs, now);
    assert.equal(result.state, "down");
    if (result.state === "down") {
      assert.equal(result.changePercent, -8.3);
      assert.equal(result.label, "Down 8% this week");
      assert.equal(result.origin, "sample");
    }
  });

  await t.test("calculates 'stable' trend for changes under 1%", () => {
    const obs: RawObservationPoint[] = [
      { priceAmount: 2400, observedAt: now - 2 * MS_PER_DAY, availabilityState: "available", provenance: "device", placeId: "p1" },
      { priceAmount: 2400, observedAt: now - 9 * MS_PER_DAY, availabilityState: "available", provenance: "device", placeId: "p1" },
    ];

    const result = calculateFoodPriceTrend(obs, now);
    assert.equal(result.state, "stable");
    assert.equal(result.label, "Stable this week");
  });
});
