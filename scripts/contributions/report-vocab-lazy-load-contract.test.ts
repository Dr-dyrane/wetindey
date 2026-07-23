/**
 * Report-sheet vocabulary lazy-load contract.
 *
 * getInitialSubmissionData dumps the full places/items/variants/units
 * vocabulary (unbounded: it grows with the catalog). It used to ride the
 * boot-time Promise.all, so every visitor paid for it and the first map-pin
 * render waited on it. It must load only behind the report sheet's first
 * open, with a guarded single fetch and an explicit retry.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const hook = readFileSync(
  join(ROOT, "src/app/_components/home-page/hooks/useHomePage.ts"),
  "utf8",
);
const view = readFileSync(
  join(ROOT, "src/app/_components/report-price-sheet/views/ReportPriceSheetView.tsx"),
  "utf8",
);
const actions = readFileSync(join(ROOT, "src/app/_actions/report-actions.ts"), "utf8");

// 1. The boot path no longer fetches the vocabulary. loadBaseline is
// getPlaces-only, and the sole vocabulary call lives in the lazy callback.
const loadBaseline = hook.match(/const loadBaseline = useCallback[\s\S]*?\n  \}, \[\]\);/)?.[0];
assert.ok(loadBaseline, "loadBaseline not found");
assert.doesNotMatch(loadBaseline, /getInitialSubmissionData/);
assert.equal(
  hook.match(/getInitialSubmissionData\(\)/g)?.length,
  1,
  "exactly one runtime call site, inside the lazy callback",
);
const lazy = hook.match(
  /const loadSubmissionVocabulary = useCallback[\s\S]*?\n  \}, \[\]\);/,
)?.[0];
assert.ok(lazy, "loadSubmissionVocabulary not found");
assert.match(lazy, /getInitialSubmissionData\(\)/);

// 2. Re-entry is ref-guarded (state alone is stale inside a double-fired
// effect), latched on success, unlatched on error so retry works.
assert.match(lazy, /if \(submitVocabInFlight\.current\) return;/);
assert.match(lazy, /submitVocabInFlight\.current = true;/);
const catchBlock = lazy.match(/catch[\s\S]*$/)?.[0];
assert.ok(catchBlock, "lazy callback needs a catch");
assert.match(catchBlock, /submitVocabInFlight\.current = false;/);
assert.match(catchBlock, /setSubmitVocabStatus\("error"\)/);

// 3. The fetch is keyed on the sheet opening from idle, nothing else.
assert.match(
  hook,
  /if \(isReportOpen && submitVocabStatus === "idle"\) \{\s*void loadSubmissionVocabulary\(\);/,
);

// 4. Defaults seed only into fields the user has not already set.
assert.match(lazy, /setFormPlaceId\(\(v\) => v \|\| metadata\.places\[0\]\.id\)/);
assert.match(lazy, /setFormItemId\(\(v\) => v \|\| metadata\.items\[0\]\.id\)/);
assert.match(lazy, /setFormUnitId\(\(v\) => v \|\| metadata\.units\[0\]\.id\)/);

// 5. Vocabulary failures never speak through the home list's error
// affordance: the lazy callback must not touch loadError.
assert.doesNotMatch(lazy, /setLoadError/);

// 6. The sheet is honest in both pending states: pickers lock until ready,
// the error state offers a retry wired to the lazy callback.
assert.match(view, /const vocabPending = p\.vocabStatus !== "ready";/);
assert.match(view, /vocabPending;?$/m);
assert.match(view, /p\.t\["report\.options_loading"\]/);
assert.match(view, /p\.t\["report\.options_failed"\]/);
assert.match(view, /onClick=\{p\.onRetryVocab\}/);

// 7. The server action is untouched: same name, same file, still the slice
// boundary the contribution contract depends on.
assert.match(actions, /export async function getInitialSubmissionData/);

console.log("report-vocab lazy-load contract: all assertions passed");
