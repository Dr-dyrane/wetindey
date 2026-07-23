/**
 * ADR-031 lane 3 contract: the agro-dealer map surface.
 *
 * Static assertions only; the surface is dormant by construction until lane 2
 * flips the pillar flag and the credential-gated activation seeds real
 * agro-dealer places, so no runtime map behavior is asserted here. What must
 * hold regardless of activation:
 *
 *   1. The adapter's symbol and label vocabularies carry the agro-dealer
 *      entry, keyed by the lane-1 constant, never a hardcoded literal, so
 *      src/config/pillars.ts stays the one source of truth.
 *   2. The own-markets glow excludes the type: agro-dealers are not
 *      market-family, and the glow's meaning must not dilute (recorded
 *      controller ruling and steward recommendation, agreed).
 *   3. The pillar flag is still default-off (defense in depth with the
 *      lane-1 contract; if that contract moves, this one still refuses a
 *      silently enabled pillar).
 */
import assert from "node:assert";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { AGRO_DEALER_PLACE_TYPE, PILLAR_FLAGS } from "../../src/config/pillars";

const adapterSource = readFileSync(
  resolve(__dirname, "../../src/integrations/maps/MapboxAdapter.ts"),
  "utf8"
);

// 0. The constant's contract value itself: the test pins the literal so a
// silent rename in lane 1 cannot drift the map surface out from under the
// stored place_type values; the ADAPTER must never hardcode it, the test may.
assert.strictEqual(AGRO_DEALER_PLACE_TYPE, "agro_dealer");

// 1. Symbol and label keyed by the imported constant, not a literal.
assert.match(
  adapterSource,
  /import \{ AGRO_DEALER_PLACE_TYPE \} from "@\/config\/pillars";/,
  "adapter must import the place-type constant from the lane-1 source of truth"
);
assert.match(
  adapterSource,
  /\[AGRO_DEALER_PLACE_TYPE\]:\s*\n?\s*'<path/,
  "PLACE_TYPE_SYMBOLS must carry an agro-dealer symbol keyed by the constant"
);
assert.match(
  adapterSource,
  /\[AGRO_DEALER_PLACE_TYPE\]: "agro-dealer"/,
  "PLACE_TYPE_LABELS must carry the agro-dealer label keyed by the constant"
);
const literalKeyPattern = /^\s*agro_dealer\s*:/m;
assert.ok(
  !literalKeyPattern.test(adapterSource),
  "the adapter must not key the vocabularies with a hardcoded agro_dealer literal"
);

// 2. Glow exclusion: the market-family set must not contain the type.
const glowTypes = /const PLACES_GLOW_TYPES[^;]*;/s.exec(adapterSource)?.[0] ?? "";
assert.ok(glowTypes.length > 0, "PLACES_GLOW_TYPES must exist");
assert.ok(
  !glowTypes.includes("agro_dealer") && !glowTypes.includes("AGRO_DEALER"),
  "agro-dealers are not market-family; the own-markets glow must exclude the type"
);

// 3. Pillar still dormant.
assert.strictEqual(
  PILLAR_FLAGS.agri,
  false,
  "the agri pillar flag must remain default-off until credential-gated activation"
);

console.log("agri-map-surface contract: all assertions passed");
