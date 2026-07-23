/**
 * Server-action read hardening contract (sweep-two lane).
 *
 * Five verified gaps, one pin each. Every assertion is written against the
 * FAILURE it prevents, not the code that happens to exist, so a regression
 * has to defeat a named tooth:
 *
 *   H1  getOfferTrustBatch / getOfferTrust are no longer a public "use
 *       server" surface. The impl lives in src/lib/food-trust.ts and the four
 *       read paths call it in process.
 *   H2  The review reads parse before SQL and the reviews select is bounded.
 *   H3  getPopularItems can no longer build SQL from an empty origin
 *       fragment; the legacy positional signature is gone.
 *   M5  searchItems' category is parsed at the boundary.
 *
 * M4 (uuid guards on the evidence-media reads) is DELIBERATELY ABSENT: the
 * 0019 release manifest byte-pins `src/app/_actions/evidence-media-actions.ts`
 * in `source_sha256` with status shared_applied_immutable, and the
 * evidence-media P1 contract in the CI static stage enforces that pin. Editing
 * the action without amending the manifest refutes the stage, and the manifest
 * is governance-owned, so M4 is routed rather than self-resolved. When the
 * ruling lands, the guards and their pins belong here.
 *
 * Source pins read the files; behavioural pins import the real parsers from
 * src/lib/validation (a plain module, importable under tsx).
 */
import assert from "node:assert/strict";
import test from "node:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import {
  parseItemCategory,
  parsePopularItems,
  parseReviewsQuery,
} from "../../src/lib/validation";

const ROOT = process.cwd();
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");

const foodActions = read("src/app/_actions/food-actions.ts");
const barrel = read("src/app/_actions/actions.ts");
const foodTrust = read("src/lib/food-trust.ts");
const reviewActions = read("src/app/_actions/review-actions.ts");

/** The body of one exported async function, from its header to the next export. */
function slice(source: string, fn: string): string {
  const start = source.indexOf(`export async function ${fn}`);
  assert.ok(start >= 0, `${fn} not found`);
  const end = source.indexOf("\nexport ", start + 1);
  return end === -1 ? source.slice(start) : source.slice(start, end);
}

const A_UUID = "3f9a2b34-6f2a-4d8e-9c1b-2a7f8e5d4c3b";

test("H1: the trust batch is internal, not a public action", () => {
  // The old module location is gone; the impl lives in lib and carries no
  // "use server" directive that would re-mint endpoints out of its exports.
  assert.equal(existsSync(join(ROOT, "src/app/_actions/food-trust.ts")), false);
  assert.ok(existsSync(join(ROOT, "src/lib/food-trust.ts")));
  assert.doesNotMatch(foodTrust, /"use server"/);

  // No wrapper action survives anywhere on the "use server" surface, and the
  // barrel no longer names either symbol.
  assert.doesNotMatch(foodActions, /export async function getOfferTrust/);
  assert.doesNotMatch(barrel, /getOfferTrust/);

  // The four read paths still batch: exactly four in-process call sites
  // (searchItems, getPopularItems, getPlaceOffers, getOffersNarrowed). A
  // per-row loop or a dropped trust read both move this count.
  assert.equal(
    (foodActions.match(/await getOfferTrustBatchImpl\(/g) ?? []).length,
    4,
  );

  // The public type seam moved with the module and still resolves.
  assert.match(
    foodActions,
    /export type \{ OfferKey, ReadTrust \} from "@\/lib\/food-trust"/,
  );
});

test("H2: review reads parse before SQL and the select is bounded", () => {
  const reviewsFn = slice(reviewActions, "getReviewsForEntity");
  const aggregateFn = slice(reviewActions, "getReviewAggregate");

  // Parse strictly precedes the query in both functions.
  for (const fn of [reviewsFn, aggregateFn]) {
    const parseAt = fn.indexOf("parseReviewsQuery(");
    const dbAt = fn.indexOf("await db");
    assert.ok(parseAt >= 0 && dbAt >= 0 && parseAt < dbAt);
  }

  // The reviews select is LIMITed to the 200 newest, not the table.
  assert.match(reviewActions, /const REVIEWS_LIMIT = 200/);
  assert.match(reviewsFn, /ORDER BY r\.created_at DESC\s*\n\s*LIMIT \$\{REVIEWS_LIMIT\}/);

  // The parser rejects garbage before any SQL could see it.
  assert.deepEqual(
    parseReviewsQuery({ reviewableType: "place", reviewableId: A_UUID }),
    { reviewableType: "place", reviewableId: A_UUID },
  );
  assert.throws(() => parseReviewsQuery({ reviewableType: "place", reviewableId: "not-a-uuid" }));
  assert.throws(() => parseReviewsQuery({ reviewableType: "", reviewableId: A_UUID }));
  assert.throws(() => parseReviewsQuery({ reviewableType: "x".repeat(101), reviewableId: A_UUID }));
  assert.throws(() =>
    parseReviewsQuery({ reviewableType: "place", reviewableId: A_UUID, extra: 1 }),
  );
});

test("H3: getPopularItems cannot build SQL from an empty origin", () => {
  const popular = slice(foodActions, "getPopularItems");

  // The positional legacy signature is gone (verified uncalled in src and
  // scripts before removal), and the object input is parsed at the boundary.
  assert.doesNotMatch(foodActions, /limitOrOptions/);
  assert.match(popular, /const input = parsePopularItems\(options\)/);

  // No empty sql fragment exists inside this function, and BOTH ST_DWithin
  // sites (main query and cohort-trend query) interpolate the real origin.
  // This is the tooth on the original bug: `sql\`\`` reaching `::geography`.
  assert.doesNotMatch(popular, /sql``/);
  assert.equal(
    (popular.match(/ST_DWithin\(pl\.location, \$\{origin\}::geography, \$\{radiusM\}\)/g) ?? [])
      .length,
    2,
  );

  // searchItems keeps its optional coords, so its empty fragments must stay
  // guarded: every one of them sits inside a `useLocation ?` conditional.
  const search = slice(foodActions, "searchItems");
  const bare = (search.match(/sql``/g) ?? []).length;
  const guarded = (search.match(/useLocation \? sql`[^`]*` : sql``/g) ?? []).length;
  const declaration = (search.match(/coords === undefined \? sql`` :/g) ?? []).length;
  assert.equal(bare, guarded + declaration, "unguarded empty sql fragment in searchItems");

  // The parser holds the same line the hand-rolled checks held, plus the caps.
  const good = { lat: 6.4654, lng: 3.2846, radiusKm: 10 };
  assert.deepEqual(parsePopularItems(good), good);
  parsePopularItems({ ...good, category: "food", limit: 8 });
  assert.throws(() => parsePopularItems({ lng: 3.2846, radiusKm: 10 }));
  assert.throws(() => parsePopularItems({ ...good, radiusKm: 0 }));
  assert.throws(() => parsePopularItems({ ...good, radiusKm: 40_000 }));
  assert.throws(() => parsePopularItems({ ...good, limit: 1e9 }));
  assert.throws(() => parsePopularItems({ ...good, limit: 0 }));
  assert.throws(() => parsePopularItems({ ...good, unexpected: true }));
});

test("M5: searchItems' category is parsed at the boundary", () => {
  const search = slice(foodActions, "searchItems");
  const parseAt = search.indexOf("parseItemCategory(category)");
  const dbAt = search.indexOf("await db.execute");
  assert.ok(parseAt >= 0 && dbAt >= 0 && parseAt < dbAt);

  // Slug shape, not an enum: seeded categories pass, and a future pillar slug
  // passes, but shouting, injection punctuation, and free payloads do not.
  assert.equal(parseItemCategory("food"), "food");
  assert.equal(parseItemCategory("health"), "health");
  assert.equal(parseItemCategory("agri_input"), "agri_input");
  assert.equal(parseItemCategory("agri-input"), "agri-input");
  assert.throws(() => parseItemCategory("FOOD"));
  assert.throws(() => parseItemCategory("food; drop table items"));
  assert.throws(() => parseItemCategory(""));
  assert.throws(() => parseItemCategory("x".repeat(41)));
  assert.throws(() => parseItemCategory(42));
});
