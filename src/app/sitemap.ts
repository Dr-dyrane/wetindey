import { existsSync } from "node:fs";
import { join } from "node:path";
import type { MetadataRoute } from "next";
import { and, asc, eq, gte, lte, max, ne } from "drizzle-orm";
import { db, items, observations, places } from "@/db";
import { FRESHNESS_POLICY } from "@/lib/trust";

/**
 * Pins this route to build-time generation.
 *
 * This is already Next's default for a `sitemap.ts` that touches no dynamic
 * API, so it changes no behaviour — it makes the guarantee explicit and load
 * bearing, because `routeExists()` below reads `src/app` off disk. That is only
 * true during a build, where cwd is the project root and the source tree is
 * present. On a serverless invocation neither holds, and the probe would answer
 * "no route exists" — plausibly, silently, and wrongly.
 *
 * So: do not add `revalidate` here, and do not let this route become dynamic,
 * without replacing the probe first. The sitemap refreshes on deploy.
 */
export const dynamic = "force-static";

/**
 * Absolute origin for every `<loc>`. Sitemap URLs MUST be absolute — a relative
 * one is not merely ignored, it invalidates the entry.
 *
 * Resolution order is two real sources and then a throw, never a guess:
 *
 *   1. `NEXT_PUBLIC_APP_URL` — the knob this project already declares in
 *      .env.example and sets in .env.local. It wins, so a self-hosted or
 *      preview deploy can say what it actually is.
 *   2. `VERCEL_PROJECT_PRODUCTION_URL` — injected by Vercel, host only, no
 *      scheme. Correct for the production domain, which is the only place a
 *      sitemap matters.
 *   3. Nothing. Throw.
 *
 * The throw is the point, and it is the same discipline as
 * `geographyPoint.fromDriver`: a defaulted origin (localhost, or the deploy's
 * own ephemeral hostname) would produce a sitemap that is well-formed, passes
 * every check, and points every crawler at the wrong host. That is a plausible
 * wrong answer, and it would hide for months. A failed build surfaces on day
 * one.
 */
export function siteOrigin(): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (configured) return configured.replace(/\/+$/, "");

  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (vercel) return `https://${vercel.replace(/\/+$/, "")}`;

  throw new Error(
    "sitemap: cannot resolve a site origin. Set NEXT_PUBLIC_APP_URL (declared in " +
      ".env.example) to the absolute public origin, e.g. https://wetindey.app. " +
      "Refusing to emit a sitemap of relative or localhost URLs.",
  );
}

/**
 * Whether an App Router page actually exists for a segment.
 *
 * WHY THIS IS A PROBE AND NOT A BOOLEAN: `/item/[slug]` and `/place/[slug]` do
 * not exist yet (docs/product/USER-FLOW.md's "Pages this implies" table marks both
 * "Needs a URL? Yes"; the app is currently the single `/` route). Listing them
 * now would hand Google a sitemap of 404s, which is worse than no sitemap. But
 * a hand-maintained `built: false` flag is a thing someone must remember to
 * flip, and the failure mode of forgetting is invisible — the routes ship and
 * are never indexed.
 *
 * Probing the filesystem means the day `src/app/item/[slug]/page.tsx` lands,
 * this sitemap starts emitting item URLs with no edit here at all.
 *
 * If the app directory itself is missing, the probe's own assumption has broken
 * and every answer it gives is garbage — so it throws rather than reporting
 * "no routes". Same rule as everywhere else in this repo: never a silent
 * fallback.
 */
const APP_DIR = join(process.cwd(), "src", "app");

function routeExists(segment: string): boolean {
  if (!existsSync(APP_DIR)) {
    throw new Error(
      `sitemap: expected the App Router source at ${APP_DIR} and it is not there. ` +
        "This route probes the source tree to decide which URL families are real, " +
        "which is only valid at build time (see `export const dynamic` above). " +
        "Refusing to silently report that no dynamic routes exist.",
    );
  }
  return (
    existsSync(join(APP_DIR, segment, "page.tsx")) ||
    existsSync(join(APP_DIR, segment, "page.ts"))
  );
}

/**
 * A URL family: a route segment, and how to enumerate its rows.
 *
 * Slugs are read from the DB, never hardcoded — `items.slug` and `places.slug`
 * are both `notNull().unique()` (schema/index.ts:154, :101), so they are the
 * canonical public identifier already. Hardcoding them would put a second,
 * silently-drifting copy of the catalogue in the build.
 */
type UrlFamily = {
  /** App Router segment, relative to src/app. */
  readonly segment: string;
  /** URL prefix, which is `segment` minus the `[slug]` placeholder. */
  readonly prefix: string;
  readonly rows: () => Promise<Array<{ slug: string; updatedAt: Date }>>;
};

const FAMILIES: readonly UrlFamily[] = [
  {
    segment: "item/[slug]",
    prefix: "item",
    /**
     * `active` is honoured because the app honours it — actions.ts filters on it
     * at :35 and :76 (docs/APP-MAP.md:145). An inactive item is not in search,
     * so submitting it to a crawler would advertise a page the product hides.
     */
    rows: () =>
      db
        .select({ slug: items.slug, updatedAt: items.updatedAt })
        .from(items)
        .where(eq(items.active, true))
        .orderBy(asc(items.slug)),
  },
  {
    segment: "place/[slug]",
    prefix: "place",
    /**
     * No `verificationStatus` filter. Every seeded place is real and rendered on
     * the map today; `unverified` is the DEFAULT (schema/index.ts:107), so
     * filtering on it would silently drop nearly the whole catalogue. If a
     * moderation state ever gates the place page, this filter must match that
     * gate exactly — the sitemap must never disagree with the route.
     */
    rows: () =>
      db
        .select({ slug: places.slug, updatedAt: places.updatedAt })
        .from(places)
        .orderBy(asc(places.slug)),
  },
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const origin = siteOrigin();

  /**
   * The root renders nearby live information, so its public freshness comes
   * only from non-rejected observed evidence inside the shared expiration
   * window. `offers_current.updated_at` is deliberately not used: that
   * projection has no provenance and can be refreshed by sample or quarantined
   * origins.
   *
   * `max()` over an empty table yields NULL. That is not an error — it is an
   * unseeded database honestly reporting it has no offers — so the entry simply
   * carries no `lastModified` rather than a fabricated one.
   */
  const now = new Date();
  const freshnessCutoff = new Date(
    now.getTime() - FRESHNESS_POLICY.expirationHours * 3_600_000,
  );
  const [observedFreshness] = await db
    .select({ latest: max(observations.observedAt) })
    .from(observations)
    .where(
      and(
        eq(observations.provenance, "observed"),
        ne(observations.moderationStatus, "rejected"),
        gte(observations.observedAt, freshnessCutoff),
        lte(observations.observedAt, now),
      ),
    );

  const entries: MetadataRoute.Sitemap = [
    {
      url: `${origin}/`,
      ...(observedFreshness?.latest
        ? { lastModified: observedFreshness.latest }
        : {}),
    },
  ];

  /**
   * `changeFrequency` and `priority` are deliberately absent from every entry.
   * Google ignores both outright, and `priority` is relative-within-your-own-
   * sitemap by spec, so it cannot mean what people think it means. Emitting them
   * would be decoration that reads as configuration.
   */
  for (const family of FAMILIES) {
    if (!routeExists(family.segment)) continue;
    for (const row of await family.rows()) {
      entries.push({
        url: `${origin}/${family.prefix}/${encodeURIComponent(row.slug)}`,
        lastModified: row.updatedAt,
      });
    }
  }

  return entries;
}
