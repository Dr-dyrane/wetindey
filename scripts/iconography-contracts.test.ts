import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();

const PATHS = {
  globals: "src/app/globals.css",
  tailwind: "tailwind.config.ts",
  orb: "src/design-system/components/IconOrb.tsx",
  solid: "src/design-system/icons/SolidIcon.tsx",
  listRow: "src/design-system/components/ListRow.tsx",
  itemCard: "src/design-system/components/ItemCard.tsx",
  category: "src/app/_components/CategorySelectorSheet.tsx",
  profile: "src/app/_components/ProfileSheet.tsx",
  getIt: "src/app/_components/GetItSheet.tsx",
  about: "src/app/_components/AboutSheet.tsx",
  location: "src/app/_components/LocationSheet.tsx",
  reportProblem: "src/app/_components/ReportProblemSheet.tsx",
  contract: "scripts/iconography-contracts.test.ts",
} as const;

function read(path: string): string {
  return readFileSync(join(ROOT, path), "utf8");
}

function matches(source: string, pattern: RegExp): number {
  return source.match(pattern)?.length ?? 0;
}

function iconBearingListRows(source: string): number {
  return source
    .split("<ListRow")
    .slice(1)
    .filter((row) => row.slice(0, row.indexOf("/>") + 2).includes("icon=")).length;
}

const sources = Object.fromEntries(
  Object.entries(PATHS).map(([name, path]) => [name, read(path)])
) as Record<keyof typeof PATHS, string>;

const implementationSources = [
  sources.globals,
  sources.tailwind,
  sources.orb,
  sources.solid,
  sources.listRow,
  sources.itemCard,
  sources.category,
  sources.profile,
  sources.getIt,
  sources.about,
  sources.location,
  sources.reportProblem,
];

// Primitive contract: exactly three visual sizes, typed semantic ownership,
// decorative subtree, circular borderless geometry, and no private motion.
assert.match(sources.orb, /export type IconOrbSize = 28 \| 32 \| 48;/);
assert.match(sources.orb, /28:\s*"h-7 w-7/);
assert.match(sources.orb, /32:\s*"h-8 w-8/);
assert.match(sources.orb, /48:\s*"h-12 w-12/);
for (const tone of [
  "neutral",
  "domain-food",
  "domain-money",
  "status-confirmed",
  "status-caution",
  "status-unavailable",
  "status-info",
  "rating",
]) {
  assert.ok(sources.orb.includes(`"${tone}"`) || sources.orb.includes(`${tone}:`), tone);
}
assert.match(sources.orb, /aria-hidden="true"/);
assert.match(sources.orb, /squircle-full/);
assert.doesNotMatch(sources.orb, /\bborder(?:-|")|\bshadow-|\banimate-|\bonClick\b|<button\b/);
assert.match(sources.solid, /export type SolidIconSize = 16 \| 18 \| 24;/);
assert.match(sources.solid, /aria-hidden="true"/);
assert.match(sources.solid, /focusable="false"/);
assert.match(sources.solid, /not copied from[\s\S]*Apple SF Symbols/);
assert.doesNotMatch(sources.solid, /\bonClick\b|<button\b|https?:\/\//);
assert.match(sources.globals, /\.solid-icon\s*\{[\s\S]*fill:\s*currentColor;[\s\S]*stroke:\s*none;/);
assert.match(sources.globals, /@media \(prefers-reduced-motion: reduce\)/);
assert.match(
  sources.globals,
  /@media \(forced-colors: active\)[\s\S]*?\.icon-orb[\s\S]*?\.solid-icon/
);
for (const size of ["icon-compact", "icon-standard", "icon-prominent"]) {
  assert.ok(sources.tailwind.includes(`"${size}"`), size);
}

// Token families remain separate even if later palette work changes values.
for (const token of [
  "--color-domain-food",
  "--color-domain-food-bg",
  "--color-domain-money",
  "--color-domain-money-bg",
  "--color-rating",
  "--color-rating-bg",
  "--color-rating-muted",
]) {
  assert.ok(sources.globals.includes(token), token);
}
assert.match(sources.tailwind, /domain:\s*\{/);
assert.match(sources.tailwind, /rating:\s*\{/);
assert.notEqual(
  sources.globals.match(/--color-domain-food:\s*([^;]+);/)?.[1],
  sources.globals.match(/--color-status-caution:\s*([^;]+);/)?.[1]
);
assert.notEqual(
  sources.globals.match(/--color-domain-money:\s*([^;]+);/)?.[1],
  sources.globals.match(/--color-status-confirmed:\s*([^;]+);/)?.[1]
);

// Audited runtime inventory: 10 ListRow icons, seven category icons, seven
// AboutRow icons plus Support, three Location rows, and one success receipt.
const listRowIcons =
  iconBearingListRows(sources.profile) + iconBearingListRows(sources.getIt);
const categoryIcons = matches(
  sources.category,
  /\bid:\s*"(?:food|fuel|home|health|money|transport|community)"/g
);
const aboutIcons = matches(sources.about, /<AboutRow\b/g) + 1;
const locationIcons = matches(sources.location, /<IconOrb\b/g);
const receiptIcons = matches(sources.reportProblem, /<IconOrb\b/g);

assert.equal(listRowIcons, 10);
assert.equal(categoryIcons, 7);
assert.equal(aboutIcons, 8);
assert.equal(locationIcons, 3);
assert.equal(receiptIcons, 1);
assert.equal(
  listRowIcons + categoryIcons + aboutIcons + locationIcons + receiptIcons,
  29
);

assert.match(sources.listRow, /<IconOrb tone=\{iconTone\}>/);
assert.match(sources.category, /tone:\s*"domain-food"/);
assert.match(sources.category, /tone:\s*"domain-money"/);
assert.match(
  sources.category,
  /tone=\{category\.supported \? category\.tone : "neutral"\}/
);
assert.match(sources.reportProblem, /<IconOrb size=\{48\} tone="status-confirmed">/);

// Ordinary actions and destinations stay neutral. Status colors remain legal
// elsewhere in these files only where copy asserts an actual state.
for (const source of [
  sources.profile,
  sources.getIt,
  sources.about,
  sources.location,
]) {
  assert.doesNotMatch(source, /iconTone="status-/);
  assert.doesNotMatch(source, /\biconTint=/);
}

// Scoped regressions this lane exists to remove.
for (const source of implementationSources) {
  assert.doesNotMatch(source, /\btext-info\b/);
  assert.doesNotMatch(source, /\btext-amber-/);
  assert.doesNotMatch(source, /\btext-neutral-/);
  assert.doesNotMatch(source, /\bhsl\(/);
}
assert.doesNotMatch(sources.getIt, /\bborder-t\b|\bborder-dashed\b/);
assert.doesNotMatch(sources.itemCard, /monogramInk|linear-gradient\(145deg/);

// The orb never substitutes for the 44px interactive parent.
assert.match(sources.listRow, /min-h-tap/);
assert.match(sources.category, /className=\{`squircle grid h-12 w-full/);
assert.match(sources.about, /className="flex min-h-tap w-full/);
assert.match(sources.about, /squircle-card flex min-h-tap items-center/);
assert.equal(matches(sources.location, /className="flex min-h-tap w-full/g), 3);

console.log("Controlled semantic iconography contracts satisfied.");
