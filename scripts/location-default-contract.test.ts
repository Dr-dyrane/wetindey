import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  mergePersistedLocationState,
  migratePersistedLocationState,
  useLocationStore,
} from "../src/core/state/locationStore";
import {
  PRIMARY_LOCATION,
  SW_LAGOS_AREAS,
  SW_LAGOS_PLACES,
} from "../src/db/lagosSouthWest";

function test(name: string, run: () => void) {
  try {
    run();
    process.stdout.write(`✓ ${name}\n`);
  } catch (error) {
    process.stderr.write(`✗ ${name}\n`);
    throw error;
  }
}

const previousDefault = {
  position: {
    lat: 6.4641,
    lng: 3.2753,
    provenance: "default" as const,
    areaName: "Festac Town",
    areaSlug: "festac",
    setAt: 0,
  },
};

test("the synthetic default uses the canonical Festac area centre", () => {
  const festac = SW_LAGOS_AREAS.find((area) => area.slug === "festac");
  assert.ok(festac);
  assert.deepEqual(
    { lat: PRIMARY_LOCATION.lat, lng: PRIMARY_LOCATION.lng },
    { lat: 6.4655, lng: 3.2790 }
  );
  assert.deepEqual(
    { lat: PRIMARY_LOCATION.lat, lng: PRIMARY_LOCATION.lng },
    festac.center
  );
  assert.equal(PRIMARY_LOCATION.source, festac.source);
});

test("version 1 synthetic defaults migrate to the new canonical centre", () => {
  assert.deepEqual(migratePersistedLocationState(previousDefault, 1), {
    position: {
      lat: PRIMARY_LOCATION.lat,
      lng: PRIMARY_LOCATION.lng,
      provenance: "default",
      areaName: "Festac Town",
      areaSlug: "festac",
      setAt: 0,
    },
  });
});

for (const provenance of ["manual", "simulated", "device"] as const) {
  test(`${provenance} coordinates survive migration unchanged`, () => {
    const persisted = {
      position: {
        lat: 6.50123,
        lng: 3.40123,
        provenance,
        areaName: "Chosen area",
        areaSlug: "chosen-area",
        setAt: 1_721_234_567_890,
      },
    };
    assert.deepEqual(migratePersistedLocationState(persisted, 1), persisted);
    assert.deepEqual(
      mergePersistedLocationState(persisted, useLocationStore.getState()).position,
      persisted.position
    );
  });
}

test("malformed current-version state falls back to the canonical default", () => {
  const merged = mergePersistedLocationState(
    { position: null },
    useLocationStore.getState()
  );
  assert.deepEqual(merged.position, {
    lat: PRIMARY_LOCATION.lat,
    lng: PRIMARY_LOCATION.lng,
    provenance: "default",
    areaName: "Festac Town",
    areaSlug: "festac",
    setAt: 0,
  });
});

test("the collision correction does not move the demo place", () => {
  const stalls = SW_LAGOS_PLACES.find(
    (place) => place.slug === "festac-24-road-stalls"
  );
  assert.ok(stalls);
  assert.deepEqual(stalls.location, { lat: 6.46408, lng: 3.27525 });
  assert.equal(stalls.verified, false);
});

const storeSource = readFileSync(
  join(process.cwd(), "src/core/state/locationStore.ts"),
  "utf8"
);

test("the persisted store wires the selective migration at version 2", () => {
  assert.match(storeSource, /version:\s*2/);
  assert.match(storeSource, /migrate:\s*migratePersistedLocationState/);
  assert.match(storeSource, /merge:\s*mergePersistedLocationState/);
});
