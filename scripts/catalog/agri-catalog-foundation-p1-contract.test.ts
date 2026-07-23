import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

/**
 * ADR-031 lane 1 P1 contract: the agri / AGRICULTURE pillar foundation is
 * app-layer only, default-off, and surfaced nowhere.
 *
 * Option B, recorded on ADR-031: there is NO migration, because `place_type`
 * and `category` are open varchars and ADR-014 forbids the pillar owning
 * duplicate catalog tables. This contract locks that shape: the two domain
 * constants exist, the flag is off, and agri does not leak into the category
 * selector before lane 2 lands. The map symbol is lane 3 (Maps seat) with its
 * own contract, so it is deliberately not asserted here.
 */

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const read = (path: string): string =>
  readFileSync(resolve(root, path), "utf8");

test("ADR-031 lane 1: agri pillar foundation is app-layer, default-off, unsurfaced", () => {
  const pillars = read("src/config/pillars.ts");

  // The two domain constants are the single source of truth lanes 2 and 3 read.
  assert.match(pillars, /AGRO_DEALER_PLACE_TYPE = "agro_dealer"/);
  assert.match(pillars, /AGRI_CATEGORY = "agri"/);

  // Default-off: agri flips on only at the credential-gated activation, never
  // as a code default.
  assert.match(pillars, /agri:\s*false/);

  // Option B: no agri schema DDL is bundled into this pillar lane. The config
  // defines no table and imports no schema builder (matched on constructs, not
  // the prose word "migration" which the file's own comment uses).
  assert.doesNotMatch(pillars, /pgTable\(|from ["']drizzle-orm["']|CREATE TABLE/i);

  // Not surfaced in the category selector union: lane 2 has not landed, so a
  // shopper cannot select agri yet.
  const selector = read(
    "src/app/_components/category-selector-sheet/CategorySelectorSheet.tsx",
  );
  const union =
    selector.match(/export type CategoryPillar =([^;]+);/)?.[1] ?? "";
  assert.doesNotMatch(union, /agri/);
});
