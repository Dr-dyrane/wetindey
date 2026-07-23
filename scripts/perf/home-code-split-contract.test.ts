/**
 * Home first-load code-split contract.
 *
 * Nine rarely-opened surfaces live in on-demand chunks. Three invariants:
 *
 * 1. SPLIT: the barrels load them through next/dynamic (ssr:false, null
 *    loading), never statically, and nothing else imports their modules
 *    statically from outside their own subtree, or the split silently
 *    collapses back into the first-load bundle.
 *
 * 2. LATCHED: dynamic components fetch their chunk when first rendered, so
 *    the views must gate each one behind a once-opened latch: no chunk at
 *    boot, and no unmount after (ModalSheet exit animations need the
 *    component alive through the transition).
 *
 * 3. BOUNDED: the hot path stays static (ItemDetail, GetIt, ConfirmVisit,
 *    CategorySelector), page.tsx is untouched, and the always-visible header
 *    gets Avatar from its own module, not through the profile sheet.
 */
import assert from "node:assert/strict";
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");
const homeBarrel = read("src/app/_components/home-page/imports/imports.ts");
const hostBarrel = read("src/app/_components/presentation-host/imports/imports.ts");
const homeView = read("src/app/_components/home-page/views/HomePageView.tsx");
const hostView = read("src/app/_components/presentation-host/views/PresentationHostView.tsx");
const latch = read("src/app/_components/home-page/hooks/useEverPresented.ts");

// 1a. Every split surface is a next/dynamic with ssr:false + null loading.
const DYNAMIC = [
  ["homeBarrel", homeBarrel, ["settings-sheet/SettingsSheet", "report-price-sheet/ReportPriceSheet", "profile-sheet/ProfileSheet", "exchange-panel/ExchangePanel"]],
  ["hostBarrel", hostBarrel, ["location-sheet/LocationSheet", "my-reports-sheet/MyReportsSheet", "manage-profile-sheet/ManageProfileSheet", "report-problem-sheet/ReportProblemSheet", "about-sheet/AboutSheet"]],
] as const;
for (const [name, source, modules] of DYNAMIC) {
  for (const mod of modules) {
    assert.match(
      source,
      new RegExp(`dynamic\\(\\s*\\(\\) =>\\s*import\\("@/app/_components/${mod.replace(/\//g, "\\/")}"\\)`),
      `${name}: ${mod} must load via next/dynamic`,
    );
    assert.doesNotMatch(
      source,
      new RegExp(`^import (?!type )[^;]*from "@/app/_components/${mod.replace(/\//g, "\\/")}";`, "m"),
      `${name}: ${mod} must not ALSO be imported statically (type-only excepted)`,
    );
  }
  assert.ok(
    (source.match(/\{ ssr: false, loading: \(\) => null \}/g)?.length ?? 0) >= modules.length,
    `${name}: every dynamic needs ssr:false and a null loading state`,
  );
}
// Type-only imports of split modules are fine; value imports are not.
assert.match(homeBarrel, /import type \{ ExchangeLocationFilter \} from "@\/app\/_components\/exchange-panel\/ExchangePanel"/);

// 1b. No static value import of any split module from outside its subtree.
const grep = execSync(
  `grep -rln 'from "@/app/_components/\\(settings-sheet\\|profile-sheet/ProfileSheet\\|report-price-sheet/ReportPriceSheet\\|exchange-panel/ExchangePanel\\|location-sheet/LocationSheet\\|my-reports-sheet\\|manage-profile-sheet\\|report-problem-sheet\\|about-sheet\\)' src --include='*.ts' --include='*.tsx' || true`,
  { cwd: ROOT, encoding: "utf8" },
)
  .split("\n")
  .filter(Boolean)
  .filter(
    (f) =>
      !f.startsWith("src/app/_components/settings-sheet/") &&
      !f.startsWith("src/app/_components/profile-sheet/") &&
      !f.startsWith("src/app/_components/report-price-sheet/") &&
      !f.startsWith("src/app/_components/exchange-panel/") &&
      !f.startsWith("src/app/_components/location-sheet/") &&
      !f.startsWith("src/app/_components/my-reports-sheet/") &&
      !f.startsWith("src/app/_components/manage-profile-sheet/") &&
      !f.startsWith("src/app/_components/report-problem-sheet/") &&
      !f.startsWith("src/app/_components/about-sheet/"),
  );
for (const file of grep) {
  const source = read(file);
  const staticValueImport = source.match(
    /^import (?!type )[^;]*from "@\/app\/_components\/(settings-sheet|profile-sheet\/ProfileSheet|report-price-sheet\/ReportPriceSheet|exchange-panel\/ExchangePanel|location-sheet|my-reports-sheet|manage-profile-sheet|report-problem-sheet|about-sheet)[^"]*";/m,
  );
  assert.ok(!staticValueImport, `${file} statically imports a split surface: ${staticValueImport?.[0]}`);
}

// 2. Latches: hook exists, both views use one per split surface.
assert.match(latch, /export function useEverPresented\(open: boolean\): boolean/);
assert.match(latch, /if \(open && !ever\) setEver\(true\);/);
// The latch must never unlatch: exactly one setEver call, latching true, and
// no reset path (a reset would unmount a sheet mid exit animation and
// re-download its chunk on the next open).
assert.equal((latch.match(/setEver\(/g) ?? []).length, 1, "latch must have exactly one setEver call");
assert.doesNotMatch(latch, /setEver\((?!true)/, "latch must only ever set true");
for (const l of ["settingsEver", "profileEver", "reportEver"]) {
  assert.match(homeView, new RegExp(`const ${l} = useEverPresented\\(`));
  assert.match(homeView, new RegExp(`\\{${l} && \\(`));
}
for (const l of ["locationEver", "myReportsEver", "manageProfileEver", "reportProblemEver", "aboutEver"]) {
  assert.match(hostView, new RegExp(`const ${l} = useEverPresented\\(`));
  assert.match(hostView, new RegExp(`\\{${l} && \\(`));
}

// 3. Boundaries.
assert.match(read("src/app/page.tsx"), /^(?![\s\S]*next\/dynamic)/, "page.tsx stays out of this lane");
for (const hot of ["ItemDetailSheet", "GetItSheet", "ConfirmVisitSheet"]) {
  assert.match(
    homeBarrel,
    new RegExp(`^import [^;]*${hot}[^;]*from "@/app/_components/`, "m"),
    `${hot} stays a static import (hot path or boot-consumed arm)`,
  );
}
assert.match(homeBarrel, /import \{ Avatar \} from "@\/app\/_components\/profile-sheet\/views\/Avatar"/);
// The manage-profile barrel must also take Avatar directly: importing it
// through ProfileSheet coupled two on-demand chunks for one atom.
assert.match(
  read("src/app/_components/manage-profile-sheet/imports/imports.ts"),
  /import \{ Avatar \} from "@\/app\/_components\/profile-sheet\/views\/Avatar"/,
);
assert.match(read("src/app/_components/profile-sheet/views/Avatar.tsx"), /export function Avatar\(/);

console.log("home code-split contract: all assertions passed");
