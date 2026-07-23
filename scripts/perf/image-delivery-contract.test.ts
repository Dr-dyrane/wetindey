/**
 * Image delivery contract.
 *
 * Every user-facing pixel must arrive through next/image, and the two repairs
 * this pins were both production-only failures:
 *
 * 1. NO RAW <img> IN src/. The one raw <img> (GetIt reviews avatar) loaded
 *    *.public.blob.vercel-storage.com directly, a host neither CSP's img-src
 *    lists, so the avatar was blocked in production and the initials fallback
 *    could never engage because the tag had no onError. next/image serves the
 *    same bytes from /_next/image on this origin ('self'), which both
 *    policies already allow. A raw <img> anywhere in src/ reopens that class
 *    of failure silently, because dev has no enforced CSP.
 *
 * 2. THE ITEM HERO carries `unoptimized` AND `priority`. Without
 *    `unoptimized`, the optimizer fetches Wikimedia server-side from one IP
 *    and gets 429 under load (the exact failure ItemCard, PlaceOfferRow and
 *    ItemDetailSheetView already document); without `priority`, the LCP image
 *    on the one page built for Google lazy-loads and Next logs the LCP
 *    console warning.
 *
 * Plus two small regressions that ride along: the tailwind content globs for
 * directories that do not exist stay gone, and the offline page title stays
 * free of the em dash the house style forbids.
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = process.cwd();

const PATHS = {
  reviews: "src/app/_components/get-it-sheet/views/GetItReviewsView.tsx",
  itemPage: "src/app/item/[slug]/page.tsx",
  tailwind: "tailwind.config.ts",
  offline: "public/offline.html",
  nextConfig: "next.config.ts",
} as const;

function read(path: string): string {
  return readFileSync(join(ROOT, path), "utf8");
}

/**
 * Strip block comments (including JSX `{/* ... *\/}` bodies) so a comment that
 * merely mentions `<img` — opengraph-image.tsx documents the data-URI route in
 * prose — cannot fail the sweep. Line comments are left alone on purpose:
 * naive `//` stripping eats `https://` inside strings, and no line comment in
 * src/ names the tag today; if one ever does, the fix is to reword it.
 */
function withoutBlockComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "");
}

function* walk(dir: string): Generator<string> {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      yield* walk(full);
    } else if (/\.tsx$/.test(entry)) {
      yield full;
    }
  }
}

// ── 1. No raw <img> anywhere in src/ ────────────────────────────────────────
// .tsx only, deliberately: JSX cannot compile in a .ts file, so every rendered
// <img> element lives in .tsx. The two <img> mentions in .ts files are out of
// scope by design — auth-email.ts embeds a cid: logo in an HTML email string
// (mail clients have no /_next/image), and useLocationIdentity.ts names the
// map adapter's DOM <img> in a line comment (that path is already secured at
// the URL level via getImageProps).
const offenders: string[] = [];
for (const file of walk(join(ROOT, "src"))) {
  const source = withoutBlockComments(readFileSync(file, "utf8"));
  if (/<img[\s/>]/.test(source)) offenders.push(relative(ROOT, file));
}
assert.deepEqual(
  offenders,
  [],
  `raw <img> found (use next/image so delivery stays on /_next/image, 'self' under CSP): ${offenders.join(", ")}`,
);

// ── 2. The reviews avatar goes through next/image and can actually fall back ─
const reviews = read(PATHS.reviews);
assert.match(reviews, /import Image from "next\/image";/);
// The fixed 36px circle: fill + a literal sizes, the Avatar.tsx idiom.
const avatarBlock = reviews.match(/<Image[\s\S]*?\/>/)?.[0];
assert.ok(avatarBlock, "ReviewerAvatar must render a next/image <Image>");
assert.match(avatarBlock, /\bfill\b/);
assert.match(avatarBlock, /sizes="36px"/);
// A real error exit into the initials branch, not a decorative prop.
assert.match(avatarBlock, /onError=\{\(\) => setBroken\(true\)\}/);
assert.match(
  reviews,
  /\{url && !broken \? \(/,
  "the initials branch must render when the image errors, not only when url is null",
);

// ── 3. The item hero: unoptimized (Wikimedia 429) and priority (LCP) ────────
const itemPage = read(PATHS.itemPage);
const heroBlockRaw = itemPage.match(/<Image[\s\S]*?\/>/)?.[0];
assert.ok(heroBlockRaw, "item/[slug] must render its hero through next/image");
// Comments inside the props mention these words; only the PROP form counts,
// so strip block comments and demand each prop alone on its line (the dead
// tooth a refuter killed: /\bpriority\b/ matched a comment, not the prop).
const heroBlock = withoutBlockComments(heroBlockRaw);
assert.match(
  heroBlock,
  /^\s*unoptimized\s*$/m,
  "the hero must bypass /_next/image like its three siblings, or Wikimedia 429s take it down in production only",
);
assert.match(heroBlock, /^\s*priority\s*$/m, "the hero is the page's LCP image and must not lazy-load");
assert.match(heroBlock, /sizes="160px"/, "the h-40 w-40 container is 160px fixed");
// The premise of `unoptimized` here: the host really is Wikimedia's CDN.
assert.match(read(PATHS.nextConfig), /upload\.wikimedia\.org/);

// ── 4. The dead tailwind content globs stay gone ─────────────────────────────
const tailwind = read(PATHS.tailwind);
assert.doesNotMatch(tailwind, /src\/pages/, "src/pages does not exist; the glob is dead weight");
assert.doesNotMatch(tailwind, /src\/components/, "src/components does not exist; the glob is dead weight");
assert.doesNotMatch(tailwind, /src\/modules/, "src/modules does not exist; the glob is dead weight");

// ── 5. The offline title carries no em dash ─────────────────────────────────
const offlineTitle = read(PATHS.offline).match(/<title>([^<]*)<\/title>/)?.[1];
assert.ok(offlineTitle, "offline.html must have a <title>");
assert.doesNotMatch(offlineTitle, /—/, "no em dashes in copy, and titles are copy");
assert.match(offlineTitle, /WetinDey/);

console.log("image delivery contract: all assertions passed");
