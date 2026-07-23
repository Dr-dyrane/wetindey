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
 * Read-hygiene riders from the same sweep, pinned below alongside:
 *
 *   M7   robots.ts carries no rule for the deleted /zzboom route.
 *   M8   The sitemap's evidence probes run through a bounded-concurrency,
 *        order-preserving map instead of one awaited row at a time.
 *   M11  The trust read stays UNWINDOWED, by recorded ruling: rows past the
 *        144h evidence horizon still drive the expired display, the ADR-015
 *        Sample origin, and the rendered report/source counts (evidence in
 *        the comment on getOfferTrustBatchImpl). The pin is the ruling.
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
const robots = read("src/app/robots.ts");
const sitemap = read("src/app/sitemap.ts");

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

test("M7: robots carries no rule for the deleted /zzboom route", () => {
  // The route is gone from src/app, so any mention here is a rule for a 404.
  assert.doesNotMatch(robots, /zzboom/);
  // The ONLY disallow KEY left is the non-production blanket "/": the
  // production branch allows everything and advertises the sitemap. A second
  // key appearing means a new rule snuck in without a route to justify it.
  // (Key form with the colon, because the file's prose legitimately says
  // "disallows" when explaining the non-production default.)
  assert.equal((robots.match(/disallow:/g) ?? []).length, 1);
  assert.match(robots, /disallow: "\/"/);
  assert.match(robots, /allow: "\/"/);
  assert.match(robots, /sitemap: `\$\{origin\}\/sitemap\.xml`/);
});

test("M8: sitemap evidence probes are batched, capped, and order-preserving", () => {
  // The serial one-awaited-row-at-a-time gate is gone.
  assert.doesNotMatch(sitemap, /if \(!\(await family\.hasObservedEvidence/);

  // The bounded map exists, its cap is the named constant at 8, and the
  // probes actually run through it.
  assert.match(sitemap, /const EVIDENCE_PROBE_CONCURRENCY = 8/);
  assert.match(sitemap, /async function mapWithConcurrency/);
  assert.match(sitemap, /mapWithConcurrency\(\s*rows,\s*EVIDENCE_PROBE_CONCURRENCY,/);

  // Order preservation is structural, not incidental: each worker writes to
  // the index it claimed, and emission walks rows by position reading the
  // verdict at the same index. Byte-identity of the emitted sitemap was
  // additionally proven against the dev database (before/after render diff)
  // and the extracted function was driven with randomised delays: output
  // ordered, peak in-flight exactly 8, every row probed once.
  assert.match(sitemap, /results\[index\] = await fn\(items\[index\]\)/);
  assert.match(sitemap, /rows\.forEach\(\(row, index\)/);
  assert.match(sitemap, /if \(!verdicts\[index\]\) return;/);
});

test("M11: the trust read stays unwindowed, and the ruling is on the query", () => {
  const impl = slice(foodTrust, "getOfferTrustBatchImpl");

  // No time predicate reaches the observations read: rows past the 144h
  // evidence horizon still carry the expired display, the ADR-015 Sample
  // origin, and the rendered counts. Anyone adding a window must first
  // delete the recorded refutation beside the query, and this pin.
  assert.doesNotMatch(impl, /observedAt, ['"<>=]|gte\(observations\.observedAt/);
  assert.doesNotMatch(impl, /now\(\) - |make_interval|interval '/);

  // The ruling text itself, anchored on its three load-bearing citations.
  assert.match(impl, /DELIBERATELY NO `observed_at` WINDOW/);
  assert.match(impl, /expirationHours \* 2/);
  assert.match(impl, /ADR-015/);
  assert.match(impl, /distinctSourceCount/);
});
