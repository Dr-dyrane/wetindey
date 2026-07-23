import type { MetadataRoute } from "next";
import { siteOrigin } from "./sitemap";

/**
 * Same reasoning as sitemap.ts: `siteOrigin()` reads env, and the `Sitemap:`
 * line in robots.txt must be an absolute URL, so this is pinned to build time
 * alongside it. There is nothing here that could change between requests.
 */
export const dynamic = "force-static";

/**
 * Is this the deploy that is allowed to be in an index?
 *
 * Every Vercel preview gets its own public hostname serving the same content as
 * production. Without this check they are all crawlable, and Google gets N
 * copies of the app competing with each other — the canonical one does not
 * reliably win.
 *
 * Two sources, either sufficient:
 *   · `VERCEL_ENV === "production"` — Vercel's own answer, and the one that
 *     holds on the real deployment.
 *   · `APP_ENV === "production"` — this project's own knob (declared in
 *     .env.example), which is what a non-Vercel host would set.
 *
 * The default is NOT production, and that direction is chosen on purpose. If
 * this cannot tell, it disallows: the cost of a wrong "no" is a missing index
 * entry that one env var fixes, and the cost of a wrong "yes" is duplicate
 * content that has to be un-indexed. Unlike the origin in sitemap.ts this does
 * not throw, because there is a safe answer here and there is no safe default
 * origin there.
 */
function isProductionDeploy(): boolean {
  return (
    process.env.VERCEL_ENV === "production" || process.env.APP_ENV === "production"
  );
}

export default function robots(): MetadataRoute.Robots {
  const origin = siteOrigin();

  if (!isProductionDeploy()) {
    /**
     * No `sitemap` line on a non-production deploy. Advertising a sitemap while
     * disallowing everything is a contradiction, and the URLs in it would point
     * at this preview's own host anyway.
     */
    return {
      rules: [{ userAgent: "*", disallow: "/" }],
    };
  }

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // No blocked paths. The only entry this rule ever held pointed at the
        // error-boundary exercise route, which no longer exists in src/app; a
        // rule for a 404 is dead weight that reads as coverage. The hardening
        // contract pins the absence.
      },
    ],
    sitemap: `${origin}/sitemap.xml`,
    host: origin,
  };
}
