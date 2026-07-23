/**
 * Copy-hoist contract: hardcoded user-facing English stays hoisted.
 *
 * The i18n hoist lane moved every user-facing literal in the files below into
 * src/core/i18n/strings.ts and, for locationStore, replaced sentences with
 * StringKey values. This contract keeps all three properties true:
 *
 *   1. None of the hoisted sentences reappear as literals in the source files
 *      they were lifted from. (They still live in strings.ts, which is the
 *      point; only the component/hook/store files are swept.)
 *   2. locationStore's problem() calls carry i18n keys, never sentences: no
 *      quoted argument with a space in it, and the key arguments look like
 *      geo.err_* keys. The StringKey import there stays type-only, so the
 *      node-run location contract never pulls the i18n runtime.
 *   3. Every key the lane introduced exists in the English table, and every
 *      NEW key answers UNTRANSLATED in Pidgin and Yoruba: the lane hoists
 *      copy, it does not invent translations.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { TABLES, UNTRANSLATED, en } from "../../src/core/i18n/strings";

const ROOT = process.cwd();
const read = (path: string) => readFileSync(join(ROOT, path), "utf8");

/* ── 1. The hoisted literals are gone from their source files ─────────────── */

const HOISTED: Record<string, string[]> = {
  "src/design-system/components/BottomSheet.tsx": [
    "Map unavailable",
    "Try loading map again",
    "Try again",
  ],
  "src/design-system/components/SheetPicker.tsx": ["Nothing available"],
  "src/design-system/components/AsyncList.tsx": [
    '"Could not load"',
    '"Could not refresh"',
    '"Try again"',
    '"Updating"',
    ">Loading<",
  ],
  "src/app/_components/home-page/hooks/useHomePage.ts": [
    "We no fit reach the price data right now.",
    "That search is too long. Try something shorter.",
    "Couldn't search. Check your connection.",
    "We no fit load this market right now.",
  ],
  "src/app/_components/home-page/views/HomeSheetResultsView.tsx": [
    "No prices within",
    "Be the first to report one.",
    "Could not load",
    "Check your network and try again.",
    '"Try again"',
    "Try a local name like",
  ],
  "src/app/_components/home-page/views/HomePlaceDetailView.tsx": [
    "No prices here yet",
    "Nobody has reported a price at this market.",
    "Could not load",
    "Check your network and try again.",
    '"Try again"',
  ],
  "src/app/_components/location-sheet/hooks/useLocationSheet.ts": [
    "A newer location is already active",
    "This older response was ignored",
    "We found you, but not our data",
    "couldn't check nearby price coverage",
  ],
  "src/app/_components/get-it-sheet/hooks/useGetItSheet.ts": [
    "A newer location is already active",
    "This older response was ignored",
    "Your location is already out of date",
    "Refresh it again, or open directions with the market only.",
  ],
  "src/core/state/locationStore.ts": [
    "Location is unavailable",
    "This device cannot share its location",
    "Location needs a secure connection",
    "This browser cannot share location",
    "Your device returned an unusable location",
    "Your location is out of date",
    "Location is blocked",
    "Your device could not get a fix",
    "Finding you took too long",
    "Location did not work",
    "Pick an area instead.",
    "continue with your browsing area.",
  ],
};

let sweeps = 0;
for (const [path, literals] of Object.entries(HOISTED)) {
  const source = read(path);
  for (const literal of literals) {
    assert.ok(
      !source.includes(literal),
      `${path} still contains the hoisted literal ${JSON.stringify(literal)}`
    );
    sweeps += 1;
  }
}

/* ── 2. locationStore carries keys, not sentences ─────────────────────────── */

const store = read("src/core/state/locationStore.ts");

// Every quoted argument inside a problem(...) call is a code or a key: no
// spaces, and the second and third arguments are geo.err_* StringKeys.
const problemCalls = [...store.matchAll(/\bproblem\(([\s\S]*?)\)/g)];
assert.ok(problemCalls.length >= 9, "expected the nine problem() call sites");
for (const call of problemCalls) {
  const args = [...call[1].matchAll(/"([^"]*)"/g)].map((m) => m[1]);
  for (const arg of args) {
    assert.ok(
      !arg.includes(" "),
      `problem() carries a sentence, not a key: ${JSON.stringify(arg)}`
    );
  }
  const keys = args.filter((a) => a.includes("."));
  // The helper's own definition has no quoted arguments; call sites have two keys.
  if (args.length > 0) {
    assert.equal(keys.length, 2, `problem() call site should pass exactly two keys: ${call[0]}`);
    for (const key of keys) {
      assert.match(key, /^geo\.err_[a-z_]+_(title|body)$/, `unexpected problem() key ${key}`);
      assert.equal(typeof en[key as keyof typeof en], "string", `${key} missing from en`);
    }
  }
}

// The store may carry keys but must not pull in the i18n runtime.
assert.match(
  store,
  /import type \{ StringKey \} from "@\/core\/i18n";/,
  "locationStore's StringKey import must be type-only"
);

/* ── 3. Every key the lane introduced exists in en; new keys stay honest ──── */

// Keys that already existed (the dormant geo titles). They must still exist,
// and the three alignment edits must match the store's live copy verbatim.
assert.equal(en["geo.err_unsupported_title"], "This browser cannot share location");
assert.equal(en["geo.err_unavailable_title"], "Your device could not get a fix");
assert.equal(en["geo.err_unknown_title"], "Location did not work");
assert.equal(en["geo.err_insecure_title"], "Location needs a secure connection");
assert.equal(en["geo.err_denied_title"], "Location is blocked");
assert.equal(en["geo.err_timeout_title"], "Finding you took too long");

// Keys the lane added. Each exists in English and answers UNTRANSLATED in
// both other locales; inventing local copy is out of this lane's authority.
const NEW_KEYS = [
  "sheet.map_unavailable",
  "sheet.map_retry",
  "sheet.map_retry_a11y",
  "picker.empty",
  "picker.placeholder",
  "list.err_load_title",
  "list.err_refresh_title",
  "list.retry",
  "list.loading_a11y",
  "list.updating_a11y",
  "home.err_prices_unreachable",
  "home.err_search_too_long",
  "home.err_search_network",
  "home.err_market_load",
  "home.empty_prices_title",
  "home.empty_prices_body",
  "home.err_load_title",
  "home.err_network_body",
  "home.retry",
  "home.search_empty_body",
  "home.place_empty_title",
  "home.place_empty_body",
  "location.superseded_title",
  "location.superseded_body",
  "location.coverage_check_failed_title",
  "location.coverage_check_failed_body",
  "get.superseded_title",
  "get.superseded_body",
  "get.origin_stale_title",
  "get.origin_stale_body",
  "geo.err_device_title",
  "geo.err_invalid_title",
  "geo.err_stale_title",
  "geo.err_device_body",
  "geo.err_insecure_body",
  "geo.err_unsupported_body",
  "geo.err_invalid_body",
  "geo.err_stale_body",
  "geo.err_denied_body",
  "geo.err_unavailable_body",
  "geo.err_timeout_body",
  "geo.err_unknown_body",
] as const;

for (const key of NEW_KEYS) {
  assert.equal(typeof en[key], "string", `${key} missing from the English table`);
  assert.equal(TABLES.pidgin[key], UNTRANSLATED, `${key} must be UNTRANSLATED in Pidgin`);
  assert.equal(TABLES.yoruba[key], UNTRANSLATED, `${key} must be UNTRANSLATED in Yoruba`);
}

// The one interpolated key keeps its hole; useT() fills it, the dictionary
// cannot, which is why HomeSheetResultsView reads it through useT().
assert.equal(en["home.empty_prices_title"], "No prices within {km} km");

// Copy riders (second hoist wave): the location sheet's local copy module is
// gone, its consumers read the dictionary, and the home/map rider literals
// no longer appear in source.
assert.ok(
  !existsSync(join(ROOT, "src/app/_components/location-sheet/copy/copy.ts")),
  "the local copy module must stay deleted",
);
const riderSweeps: Array<[string, string[]]> = [
  ["src/app/_components/home-page/views/HomePlaceDetailView.tsx", ['"Visit shop"', '"Visit market"', 'aria-label="Close"']],
  ["src/app/_components/home-page/views/HomeSheetResultsView.tsx", ["} prices"]],
  ["src/design-system/components/MapboxCanvas.tsx", ['aria-label="Recenter on my location"']],
  ["src/app/_components/location-sheet/views/LocationSheetView.tsx", ['"Where are you?"', '"Use my location"', '"Back"']],
  ["src/app/_components/location-sheet/hooks/useLocationSheet.ts", ['"We no fit load the areas right now."']],
];
let riderCount = 0;
for (const [file, literals] of riderSweeps) {
  const source = readFileSync(join(ROOT, file), "utf8");
  for (const literal of literals) {
    assert.ok(!source.includes(literal), `${file} still carries ${literal}`);
    riderCount += 1;
  }
}
console.log(`copy riders: ${riderCount} literal sweeps clean, copy module deleted.`);

console.log(
  `copy-hoist contract: ${sweeps} literal sweeps, ${problemCalls.length} problem() sites, ` +
    `${NEW_KEYS.length} new keys verified.`
);
