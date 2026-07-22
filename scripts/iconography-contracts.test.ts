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
  category: "src/app/_components/category-selector-sheet/views/CategorySelectorSheetView.tsx",
  profile: "src/app/_components/profile-sheet/views/ProfileSheetView.tsx",
  getIt: "src/app/_components/get-it-sheet/views/GetItSheetView.tsx",
  about: "src/app/_components/about-sheet/views/AboutSheetView.tsx",
  location: "src/app/_components/location-sheet/views/LocationSheetView.tsx",
  reportProblem: "src/app/_components/report-problem-sheet/views/ReportProblemSheetView.tsx",
  contract: "scripts/iconography-contracts.test.ts",
} as const;

function read(path: string): string {
  let content = readFileSync(join(ROOT, path), "utf8");
  if (path === "src/app/_components/about-sheet/views/AboutSheetView.tsx") {
    content += "\n" + readFileSync(join(ROOT, "src/app/_components/about-sheet/views/AboutSheetDetail.tsx"), "utf8");
  }
  return content;
}

function matches(source: string, pattern: RegExp): number {
  return source.match(pattern)?.length ?? 0;
}

function tokenValues(source: string, token: string): string[] {
  return Array.from(
    source.matchAll(new RegExp(`${token}:\\s*(#[0-9a-fA-F]{6});`, "g")),
    (match) => match[1]
  );
}

function relativeLuminance(hex: string): number {
  const channels = [1, 3, 5].map((index) => {
    const channel = Number.parseInt(hex.slice(index, index + 2), 16) / 255;
    return channel <= 0.04045
      ? channel / 12.92
      : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrastRatio(first: string, second: string): number {
  const lighter = Math.max(relativeLuminance(first), relativeLuminance(second));
  const darker = Math.min(relativeLuminance(first), relativeLuminance(second));
  return (lighter + 0.05) / (darker + 0.05);
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
assert.match(sources.orb, /28:\s*"[^"]*h-icon-compact[^"]*w-icon-compact/);
assert.match(sources.orb, /32:\s*"[^"]*h-icon-standard[^"]*w-icon-standard/);
assert.match(sources.orb, /48:\s*"[^"]*h-icon-prominent[^"]*w-icon-prominent/);
for (const tone of [
  "neutral",
  "domain-food",
  "domain-money",
  "context-location",
  "context-navigation",
  "context-contact",
  "status-confirmed",
  "status-caution",
  "status-unavailable",
  "rating",
]) {
  assert.ok(sources.orb.includes(`"${tone}"`) || sources.orb.includes(`${tone}:`), tone);
}
assert.match(sources.orb, /aria-hidden="true"/);
assert.match(sources.orb, /squircle-full/);
assert.doesNotMatch(sources.orb, /\bborder(?:-|")|\bshadow-|\banimate-|\bonClick\b|<button\b/);
assert.match(sources.solid, /export type SolidIconSize = 16 \| 18 \| 24;/);
assert.match(sources.solid, /16:\s*"h-icon-compact w-icon-compact"/);
assert.match(sources.solid, /18:\s*"h-icon-standard w-icon-standard"/);
assert.match(sources.solid, /24:\s*"h-icon-prominent w-icon-prominent"/);
assert.match(sources.solid, /aria-hidden="true"/);
assert.match(sources.solid, /focusable="false"/);
assert.match(sources.solid, /shapeRendering="geometricPrecision"/);
assert.match(sources.solid, /\| "food"/);
assert.match(sources.solid, /\| "settings"/);
assert.doesNotMatch(sources.solid, /\bonClick\b|<button\b|https?:\/\//);
assert.doesNotMatch(sources.solid, /className\??:\s*string|\$\{className\}|\bstyle=/);
assert.match(sources.globals, /\.solid-icon\s*\{[\s\S]*fill:\s*currentColor;[\s\S]*stroke:\s*none;/);
assert.match(sources.globals, /@media \(prefers-reduced-motion: reduce\)/);
assert.match(
  sources.globals,
  /@media \(forced-colors: active\)[\s\S]*?\.icon-orb/
);
assert.doesNotMatch(
  sources.globals,
  /@media \(forced-colors: active\)[\s\S]*?\.solid-icon\s*\{[\s\S]*?\bcolor\s*:/
);
assert.match(
  sources.globals,
  /\.icon-orb\s*\{[\s\S]*?background-image:\s*linear-gradient[\s\S]*?box-shadow:/
);
const orbBlock = sources.globals.match(/\.icon-orb\s*\{([\s\S]*?)\n  \}/)?.[1] ?? "";
const sheenBlock =
  sources.globals.match(/\.icon-orb::before\s*\{([\s\S]*?)\n  \}/)?.[1] ?? "";
assert.doesNotMatch(orbBlock, /radial-gradient|\binset\b/);
assert.match(sheenBlock, /top:\s*5%/);
assert.match(sheenBlock, /height:\s*8%/);
assert.match(sheenBlock, /filter:\s*blur\(0\.75px\)/);
assert.doesNotMatch(
  orbBlock,
  /\bborder(?:-|\s*:)/,
);
for (const [size, value] of [
  ["icon-compact", "16px"],
  ["icon-standard", "18px"],
  ["icon-prominent", "24px"],
] as const) {
  assert.ok(sources.tailwind.includes(`"${size}": "${value}"`), `${size}=${value}`);
}
assert.doesNotMatch(
  sources.orb,
  /bg-(?:fillTertiary|domain-(?:food|money)-bg|rating-bg|status-(?:confirmed|caution|unavailable|info)-bg)/
);
for (const className of [
  "text-iconOrb-neutral-ink",
  "text-domain-food-orb-ink",
  "text-domain-money-orb-ink",
  "text-iconOrb-location-ink",
  "text-iconOrb-navigation-ink",
  "text-iconOrb-contact-ink",
  "text-rating-orb-ink",
  "text-status-confirmed-orb-ink",
  "text-status-caution-orb-ink",
  "text-status-unavailable-orb-ink",
]) {
  assert.ok(sources.orb.includes(className), className);
}

for (const [familyToken, inkToken] of [
  ["--color-icon-orb-neutral", "--color-icon-orb-neutral-ink"],
  ["--color-domain-food-orb", "--color-domain-food-orb-ink"],
  ["--color-domain-money-orb", "--color-domain-money-orb-ink"],
  ["--color-context-location-orb", "--color-context-location-orb-ink"],
  ["--color-context-navigation-orb", "--color-context-navigation-orb-ink"],
  ["--color-context-contact-orb", "--color-context-contact-orb-ink"],
  ["--color-rating-orb", "--color-rating-orb-ink"],
  ["--color-status-confirmed-orb", "--color-status-confirmed-orb-ink"],
  ["--color-status-caution-orb", "--color-status-caution-orb-ink"],
  ["--color-status-unavailable-orb", "--color-status-unavailable-orb-ink"],
] as const) {
  const tops = tokenValues(sources.globals, `${familyToken}-top`);
  const bases = tokenValues(sources.globals, `${familyToken}-base`);
  const deeps = tokenValues(sources.globals, `${familyToken}-deep`);
  const inks = tokenValues(sources.globals, inkToken);
  assert.equal(tops.length, 2, `${familyToken} light/dark opaque top values`);
  assert.equal(bases.length, 2, `${familyToken} light/dark opaque base values`);
  assert.equal(deeps.length, 2, `${familyToken} light/dark opaque deep values`);
  assert.equal(inks.length, 2, `${inkToken} light/dark opaque values`);
  for (let theme = 0; theme < 2; theme += 1) {
    const stops = [tops[theme], bases[theme], deeps[theme]];
    for (const stop of stops) {
      assert.ok(
        contrastRatio(stop, inks[theme]) >= 4.5,
        `${familyToken} theme ${theme} stop ${stop} contrast`
      );
    }
    assert.ok(
      relativeLuminance(tops[theme]) > relativeLuminance(bases[theme]) &&
        relativeLuminance(bases[theme]) > relativeLuminance(deeps[theme]),
      `${familyToken} theme ${theme} lighter-top/deeper-lower order`
    );
  }
}

for (const [tailwindKey, token] of [
  ["neutral-top", "--color-icon-orb-neutral-top"],
  ["location-top", "--color-context-location-orb-top"],
  ["navigation-top", "--color-context-navigation-orb-top"],
  ["contact-top", "--color-context-contact-orb-top"],
] as const) {
  assert.ok(
    sources.tailwind.includes(`"${tailwindKey}": "var(${token})"`),
    `${tailwindKey} stable contextual mapping`
  );
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

// Contextual actions must never borrow status colors. Adoption is a later lane,
// so existing callers remain unchanged while the foundation exposes the names.
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
assert.ok(sources.tailwind.includes('tap: "44px"'), "tap target token remains exactly 44px");
assert.match(sources.listRow, /min-h-tap/);
assert.match(sources.category, /className=\{`squircle grid h-12 w-full/);
assert.match(sources.about, /className="flex min-h-tap w-full/);
assert.match(sources.about, /squircle-card flex min-h-tap items-center/);
assert.equal(matches(sources.location, /className="flex min-h-tap w-full/g), 3);

console.log("Controlled semantic iconography contracts satisfied.");
