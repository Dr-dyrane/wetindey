# SEO and Google Search Console

How WetinDey is made discoverable, and the steps to connect Google Search
Console (GSC). Domain: **https://wetindey.live**.

## What ships

| Surface | File | Notes |
|---|---|---|
| Robots policy | `src/app/robots.ts` | Production indexes `/`; every preview deploy is `Disallow: /`. |
| Sitemap | `src/app/sitemap.ts` | Auto-includes `/`, and every `/item/[slug]` and `/place/[slug]` once those routes exist (they now do). Slugs come from the DB, so it never drifts. |
| Root metadata | `src/app/layout.tsx` | `metadataBase`, canonical, title template, OpenGraph, Twitter, and the GSC verification tag. |
| Site JSON-LD | `src/app/layout.tsx` via `src/lib/seo.tsx` | `WebSite` + `Organization` on every page. |
| Item page | `src/app/item/[slug]/page.tsx` | Server-rendered. `Product` + `AggregateOffer` + `BreadcrumbList` JSON-LD. Targets "&lt;food&gt; price in Lagos". |
| Place page | `src/app/place/[slug]/page.tsx` | Server-rendered. `GroceryStore`/`ConvenienceStore` + `BreadcrumbList` JSON-LD. Targets "&lt;market&gt;, &lt;area&gt;". |
| OG card | `src/app/opengraph-image.tsx` | The share image for the root; nested routes inherit it unless they add their own. |

The read queries for the two routes live in `src/lib/seo-queries.ts` (not
`actions.ts`), so they never touch the hot, contested query file.

## Connect Google Search Console

Search Console does not take keywords as input. Its Performance report is an
**output**: it shows the queries the site already earns impressions and clicks
for. The job is to give Google good content and pages, then read what it finds.

### 1. Add and verify the property

Pick one of two methods.

**A. HTML meta tag (simplest, tied to the app).**
1. In GSC, add a **URL-prefix** property for `https://wetindey.live`.
2. Choose the "HTML tag" method and copy the `content="..."` token.
3. Set the environment variable and redeploy:
   ```
   NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION=<token>
   ```
   The layout emits `<meta name="google-site-verification" content="...">`
   (Next reads `metadata.verification.google`). The token is public by design.
4. Back in GSC, click **Verify**.

**B. DNS TXT (recommended if you control DNS).**
Add a **Domain** property instead, and paste Google's TXT record into the
`wetindey.live` DNS zone. A domain property covers every subdomain and both
`http`/`https` at once, and it does not depend on a deploy. Prefer this if the
domain's DNS is reachable.

### 2. Submit the sitemap

In GSC, **Sitemaps** > add `sitemap.xml` (full URL
`https://wetindey.live/sitemap.xml`). Confirm it reports "Success" and a
discovered-URL count matching the item and place catalogue.

### 3. Read the results

- **Performance > Queries**: the actual search terms bringing impressions and
  clicks. This is the "keywords" view.
- **URL Inspection**: paste an item or place URL to see how Google renders it and
  whether it is indexed. Use "Test live URL" after a deploy.
- **Pages (Indexing)**: coverage and any exclusion reasons.
- **Rich Results Test** (search.google.com/test/rich-results): paste a URL to
  confirm the `Product` / `GroceryStore` / `BreadcrumbList` JSON-LD is valid.

## Notes for whoever maintains this

- **Prices are kobo.** `offers_current.price_min/max` are integer kobo. Display
  uses `formatNaira` (kobo in); JSON-LD divides by 100 once in `seo.tsx`. Do not
  double-convert.
- **Content is hidden until hydration.** `ThemeProvider` (ThemeContext.tsx)
  wraps the whole tree in `visibility: hidden` until React mounts, to kill the
  theme flash on the map. Server-rendered page HTML, `<head>` metadata, and the
  JSON-LD `<script>` tags are all present in the source regardless, and Googlebot
  renders JS, so the pages index. If a future need calls for content visible
  with JS off, that means changing the visibility gate, which belongs to the map
  and theme work, not here.
- **One origin.** `siteOrigin()` in `sitemap.ts` resolves the canonical host from
  `NEXT_PUBLIC_APP_URL` (or Vercel's production URL). `robots.ts`, `sitemap.ts`,
  and `seo.tsx` all read it, so canonical, sitemap, and JSON-LD URLs cannot drift
  apart. Set `NEXT_PUBLIC_APP_URL=https://wetindey.live` in production.
- **Preview deploys never index.** `robots.ts` returns `Disallow: /` unless
  `VERCEL_ENV` or `APP_ENV` is `production`, so previews cannot compete with the
  live site for the same content.
- **The map homepage stays client-rendered.** Its ranking value is thin by
  nature (one URL, JS-drawn map). The item and place pages are where organic
  search traffic is won, so growth here means more items and markets with fresh
  reported prices, each of which is its own indexable page automatically.
