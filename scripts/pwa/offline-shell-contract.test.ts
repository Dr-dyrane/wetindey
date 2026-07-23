/**
 * Offline shell honesty and shell-cache bound contract.
 *
 * Two invariants this repo has already broken once:
 *
 * 1. HONESTY. The offline page may state that queued report bytes are still on
 *    the phone, because that is true; it must never promise that the app will
 *    send them, because nothing writes or drains `pending_observations` and
 *    the contribution containment policy deliberately forbids an offline
 *    drain until durable server idempotency exists.
 *
 * 2. BOUND. Every OK navigated document is written into SHELL_CACHE, so the
 *    cache needs a ceiling, and the ceiling must never evict the installed
 *    shell (SHELL_ASSETS, the offline page) or the boot document "/" -- a
 *    plain LIMITS entry would, because install order makes them FIFO-oldest.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const offlineHtml = readFileSync(join(ROOT, "public/offline.html"), "utf8");
const swSource = readFileSync(join(ROOT, "public/sw.js"), "utf8");
const homeHookSource = readFileSync(
  join(ROOT, "src/app/_components/home-page/hooks/useHomePage.ts"),
  "utf8",
);

// 1a. The false promise stays gone, in any phrasing that pledges sending.
assert.doesNotMatch(
  offlineHtml,
  /go send dem|will (?:be )?sen[dt]|we go send|auto[- ]?send/i,
  "offline.html must not promise that queued reports will be sent",
);
// 1b. The page still shows the truthful queue state and still only reads it.
assert.match(offlineHtml, /Dem dey your phone\./);
assert.match(offlineHtml, /localStorage\.getItem\('pending_observations'\)/);
assert.doesNotMatch(
  offlineHtml,
  /localStorage\.(?:setItem|removeItem)/,
  "offline.html must never mutate the queue",
);
// 1c. The containment policy the honesty rests on is still recorded app-side.
assert.match(homeHookSource, /deliberately has no offline drain/);

// 2a. The shell document trimmer exists, with its ceiling and protected set.
assert.match(swSource, /const SHELL_DOCUMENT_LIMIT = \d+;/);
assert.match(
  swSource,
  /const SHELL_PROTECTED_PATHS = new Set\(SHELL_ASSETS\.concat\("\/"\)\)/,
  "protected set must be built from SHELL_ASSETS plus the boot document",
);
assert.match(swSource, /async function trimShellDocuments\(/);
// 2b. The navigate write path actually invokes it.
assert.match(
  swSource,
  /\.put\(event\.request, response\.clone\(\)\)\s*\.then\(\(\) => trimShellDocuments\(cache\)\)/,
  "handleNavigate must trim after every document write",
);
// 2c. SHELL_CACHE must stay out of LIMITS: the generic FIFO trim would evict
// the installed shell first. The dedicated trimmer is the only bound.
const limitsBlock = swSource.match(/const LIMITS = \{[\s\S]*?\};/)?.[0];
assert.ok(limitsBlock, "LIMITS block missing");
assert.doesNotMatch(limitsBlock, /SHELL_CACHE/);
for (const capped of ["STATIC_CACHE", "PHOTO_CACHE", "MAP_CACHE"]) {
  assert.match(limitsBlock, new RegExp(`\\[${capped}\\]: \\d+`));
}
// 2d. The offline page is in the install set the protected paths derive from.
assert.match(swSource, /const SHELL_ASSETS = \[[\s\S]*?OFFLINE_URL[\s\S]*?\];/);

console.log("offline-shell contract: all assertions passed");
