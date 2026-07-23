import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

/**
 * ADR-031 lane 1 + lane 2 P1 contract: the agri / AGRICULTURE pillar foundation
 * is app-layer only and default-off. Lane 2 has landed, so agri is now a member
 * of the CategoryPillar union, but the selector view gates its rendering on the
 * default-off `PILLAR_FLAGS.agri`, so no shopper can see or select agri until the
 * credential-gated activation flips the flag.
 *
 * Option B, recorded on ADR-031: there is NO migration, because `place_type`
 * and `category` are open varchars and ADR-014 forbids the pillar owning
 * duplicate catalog tables. This contract locks that shape: the two domain
 * constants exist, the flag is off, and agri is surfaced in the union only
 * behind the flag gate. The map symbol is lane 3 (Maps seat) with its own
 * contract, so it is deliberately not asserted here.
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

  // Lane 2 landed: agri is now a member of the CategoryPillar union, so the
  // type layer accepts it as an active category.
  const selector = read(
    "src/app/_components/category-selector-sheet/CategorySelectorSheet.tsx",
  );
  const union =
    selector.match(/export type CategoryPillar =([^;]+);/)?.[1] ?? "";
  assert.match(union, /"agri"/);

  // ...but the selector view gates its rendering on the default-off flag, so no
  // shopper can see or select agri until the credential-gated activation flips it.
  const view = read(
    "src/app/_components/category-selector-sheet/views/CategorySelectorSheetView.tsx",
  );
  assert.match(
    view,
    /import\s*\{[^}]*\bPILLAR_FLAGS\b[^}]*\}\s*from\s*["']@\/config\/pillars["']/,
  );
  assert.match(view, /PILLAR_FLAGS\.agri/);

  // The flag itself is still default-off (also asserted above against pillars.ts).
  assert.match(pillars, /agri:\s*false/);
});
