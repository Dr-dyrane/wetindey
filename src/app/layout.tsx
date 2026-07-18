import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { Analytics } from "@vercel/analytics/next";
import { ThemeProvider } from "@/core/context/ThemeContext";
import { siteOrigin } from "./sitemap";
import { CSP_NONCE_HEADER, isCspNonce } from "@/lib/security/csp-policy";
import { JsonLd, organizationJsonLd, websiteJsonLd } from "@/lib/seo";
import "./globals.css";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  /**
   * The absolute origin every other URL in the tree resolves against: canonical
   * tags, OpenGraph `url`, and the OG image. Without it Next resolves them
   * against `http://localhost:3000` and warns, so a shared production link would
   * carry a localhost OG image. Resolved through the same `siteOrigin()` the
   * sitemap and robots use, so there is one canonical host, not three.
   */
  metadataBase: new URL(siteOrigin()),
  /**
   * A title TEMPLATE, so every child route reads "<its title> · WetinDey"
   * without repeating the brand. `default` is what `/` and any route that sets
   * no title get. The middot is not an em dash: the house rule forbids em
   * dashes in copy, and titles are copy.
   */
  title: {
    default: "WetinDey: nearby live local information",
    template: "%s · WetinDey",
  },
  description:
    "Understand nearby live local information before you leave. Food price and availability are WetinDey's current V1 capability in south-west Lagos; coverage and freshness vary.",
  applicationName: "WetinDey",
  // app/manifest.ts is served at /manifest.webmanifest, not /manifest.json.
  manifest: "/manifest.webmanifest",
  alternates: { canonical: "/" },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "WetinDey",
  },
  openGraph: {
    type: "website",
    siteName: "WetinDey",
    locale: "en_NG",
    url: "/",
    title: "WetinDey: nearby live local information",
    description:
      "Nearby live local information for south-west Lagos. Food price and availability are WetinDey's current V1 capability; coverage and freshness vary.",
  },
  twitter: {
    card: "summary_large_image",
    title: "WetinDey: nearby live local information",
    description:
      "Nearby live local information for south-west Lagos. Food price and availability are WetinDey's current V1 capability; coverage and freshness vary.",
  },
  /**
   * Google Search Console verification, emitted as
   * `<meta name="google-site-verification">` only when the token is set. The
   * value is public by design (it ships in the HTML), so a NEXT_PUBLIC_ env is
   * correct; it is spread conditionally so an unset token adds no empty tag.
   * See docs/SEO.md.
   */
  ...(process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION
    ? { verification: { google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION } }
    : {}),
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  /**
   * NO `maximumScale` AND NO `userScalable: false`. Their absence is the point,
   * so it is written down — an empty space cannot defend itself from the next
   * person who adds them back to make the PWA "feel native".
   *
   * Together they disable pinch-zoom, which is WCAG 2.1 SC 1.4.4 (Resize Text,
   * AA): text must reach 200% without assistive technology. `docs/ACCESSIBILITY.md`
   * carries it as **P0-3** and calls it "the single most cited AA failure in mobile
   * web… no interpretation, no edge case".
   *
   * It is not a neutral default here. iOS Safari has ignored `user-scalable=no`
   * since iOS 10; **Android Chrome honours it** — so it bit Android, which is most
   * of this pilot's audience. (Reported to be ignored on web *pages* but possibly
   * honoured in standalone web views, and this app ships `appleWebApp.capable`
   * with `display: "standalone"` — unverified, so the blast radius may be wider
   * than Android alone, not narrower.)
   *
   * WHAT THIS LINE DOES *NOT* BUY, because the first draft of this comment claimed
   * it did and was wrong: it does not, by itself, let anyone zoom anything.
   * `touch-action` decides that, and it wins. The map canvas carries
   * `touch-action: none` from Mapbox's own v3.1.2 stylesheet, and the bottom sheet
   * carried `pan-y` — between them, the entire viewport. Removing the viewport lock
   * is **necessary and not sufficient**; the fix lands in `BottomSheet.tsx`, which
   * now says `pan-y pinch-zoom`. Verified in-browser, not reasoned about:
   * `.mapboxgl-canvas` → `none`, sheet root → `pan-y`, and the "E sure" badge's
   * nearest touch-action ancestor was that sheet.
   *
   * The audit flagged rather than fixed it, on the reasonable ground that "someone
   * chose this". **Nobody did.** It arrived in the initial commit as boilerplate
   * and was the only non-obvious line in this file with no comment — in a file
   * where the theme-color literals below get six lines explaining themselves. An
   * undocumented default is not a decision.
   *
   * The usual defence is that document zoom fights the map. Mapbox GL manages its
   * own gestures via `touch-action` on its canvas; it never needed the whole
   * document's zoom disabled to do it.
   */
  viewportFit: "cover",
  /**
   * The only colour literals in the app, and they cannot be tokens.
   *
   * These become <meta name="theme-color">, which the browser reads to paint
   * its own chrome before any stylesheet is parsed — a var() would resolve to
   * nothing. So they are duplicated by necessity and MUST be kept in step with
   * --color-background in globals.css by hand.
   */
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F2F2F7" },
    { media: "(prefers-color-scheme: dark)", color: "#000000" },
  ],
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const nonce = (await headers()).get(CSP_NONCE_HEADER);
  if (!nonce || !isCspNonce(nonce)) {
    throw new Error("RootLayout requires the request-boundary CSP nonce.");
  }

  return (
    /**
     * `suppressHydrationWarning` is required by the theme script below, not a
     * papering-over of a real mismatch.
     *
     * The script deliberately mutates `<html>` before React hydrates: the server
     * cannot know the visitor's theme, so it renders `class="h-full"`, and the
     * script adds `dark` and `color-scheme` from localStorage. React then
     * compares the two, finds attributes it did not write, and logs a hydration
     * error on EVERY page load — one per render pass.
     *
     * Suppression is scoped to this element and does not cascade past its own
     * attributes, so a genuine mismatch inside the tree still reports. This is
     * the same approach next-themes takes, for the same reason.
     */
    <html lang="en" className="h-full" suppressHydrationWarning>
      <head>
        {/**
         * Resolve the theme BEFORE first paint.
         *
         * This is blocking and inline on purpose. Everything downstream reads
         * `documentElement.classList` to decide what it is: the CSS variables,
         * and — critically — the map, which must choose streets-v12 vs dark-v11
         * at construction. ThemeContext applies that class in an effect, so
         * anything else reading it from an effect is racing the provider, and
         * effect order between sibling components is not guaranteed. The map
         * only picked the right basemap because its CDN await happened to push
         * init later. That is luck.
         *
         * Running here makes the class true from the first byte of paint: no
         * flash, and every consumer — including a map that reloads — reads a
         * settled value. Wrapped in try/catch because localStorage throws
         * outright in some privacy modes, and a theme is not worth a blank page.
        */}
        <script
          nonce={nonce}
          dangerouslySetInnerHTML={{
            __html: `(function(){try{
              var t=localStorage.getItem('theme');
              if(t!=='dark'&&t!=='light'){t=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';}
              var r=document.documentElement;
              r.classList.toggle('dark',t==='dark');
              r.style.colorScheme=t;
            }catch(e){}})();`,
          }}
        />
        {/**
         * `crypto.randomUUID` for non-secure origins, so the app boots on a phone.
         *
         * WHY THIS EXISTS. Over `http://192.168.x.x:3000` — the only way a phone
         * reaches a dev server, and this is a phone-first Lagos app — the app used
         * to die at boot to the "Something scatter" boundary with
         * `TypeError: crypto.randomUUID is not a function`. Not our code: the
         * bundled Neon/better-auth client runs `crypto.randomUUID()` at MODULE TOP
         * LEVEL (grep `CURRENT_TAB_CLIENT_ID` in the served chunk). `randomUUID` is
         * secure-context-only — present on https and on localhost, undefined on
         * plain-http LAN. Top level means no try/catch of ours can reach it, and
         * a polyfill applied after the bundle has run is already too late. It has
         * to be here, blocking, before any bundle byte executes.
         *
         * Production is HTTPS, so `randomUUID` is native and this NEVER FIRES
         * there. That is exactly why the bug hid: every environment anyone tested
         * — prod, and localhost, which is secure by spec — was immune. Nobody had
         * opened the app on a phone.
         *
         * IT IS NOT WEAK. `getRandomValues` is NOT secure-context-gated (measured:
         * `function` on the same origin where `randomUUID` is `undefined`), so this
         * is a real v4 UUID from the same CSPRNG the native one uses. No
         * `Math.random`. If `getRandomValues` is ever missing too, we define
         * nothing and let the original TypeError happen — a wrong id is worse than
         * a loud crash on the one path that would produce it.
         *
         * `src/lib/report-error.ts` already guards its own `randomUUID` call for
         * this exact reason, and says so. Our code anticipated the platform rule;
         * the dependency did not. That guard is NOT made redundant by this: it
         * still covers the server path, where this script never runs.
         *
         * ORDER IS GUARANTEED, NOT LUCKY — and not for the obvious reason. Next's
         * chunk tags sit ABOVE this one and are `async`, which looks like a race.
         * It is not: those chunks only push factory functions onto an array. The
         * code that RUNS them is `webpack.js`, which the parser does not reach
         * until far below this script, in `<body>`. So the top-level
         * `crypto.randomUUID()` inside the auth factory cannot execute before this
         * line. Do NOT "fix" this with `next/script strategy="beforeInteractive"`:
         * that hands ordering to Next's injector and forfeits the document-order
         * guarantee that is currently making it correct.
         *
         * IT SHIPS TO PRODUCTION, DELIBERATELY. The service-worker script below
         * gates on NODE_ENV; this one does not. ~400 inert bytes, because prod is
         * HTTPS and Vercel 308s http to https before this HTML is ever parsed. The
         * trade: if the app is ever served from an unexpected plain-http origin, it
         * boots with a proper CSPRNG v4 instead of crashing. Gating it would buy
         * nothing and forfeit that.
         *
         * THIS IS PERMANENT UNTIL SOMEONE FILES UPSTREAM. It reads like a
         * temporary workaround; it is not. Both exits are unowned — Neon is pinned
         * at `0.4.2-beta`, and nothing has moved on serving the dev server over
         * https. A top-level secure-context-only call in a client SDK breaks every
         * plain-http dev origin, which is worth reporting; no agent here can send
         * it. See LANES.md H17. Delete this when that issue closes, not before.
        */}
        <script
          nonce={nonce}
          dangerouslySetInnerHTML={{
            __html: `(function(){try{
              var c=window.crypto;
              if(!c||typeof c.randomUUID==='function'||typeof c.getRandomValues!=='function')return;
              c.randomUUID=function(){
                var b=new Uint8Array(16);
                c.getRandomValues(b);
                b[6]=(b[6]&15)|64;
                b[8]=(b[8]&63)|128;
                var h=[],i=0;
                for(;i<256;i++)h[i]=(i+256).toString(16).slice(1);
                return h[b[0]]+h[b[1]]+h[b[2]]+h[b[3]]+'-'+h[b[4]]+h[b[5]]+'-'+h[b[6]]+h[b[7]]+'-'+h[b[8]]+h[b[9]]+'-'+h[b[10]]+h[b[11]]+h[b[12]]+h[b[13]]+h[b[14]]+h[b[15]];
              };
            }catch(e){}})();`,
          }}
        />
        <link href="https://api.mapbox.com/mapbox-gl-js/v3.1.2/mapbox-gl.css" rel="stylesheet" />
        <script
          nonce={nonce}
          src="https://api.mapbox.com/mapbox-gl-js/v3.1.2/mapbox-gl.js"
          defer
        />
      </head>
      <body className="h-full min-h-screen selection:bg-accent selection:text-accent-contrast">
        {/* Site-wide structured data. Outside ThemeProvider's visibility gate on
            purpose: a script carries no pixels, so it does not need to wait for
            the theme, and it is read from the HTML source either way. Per-page
            structured data (Product / GroceryStore / BreadcrumbList) is added by
            each route; this is the WebSite + Organization every page shares. */}
        <JsonLd data={websiteJsonLd()} />
        <JsonLd data={organizationJsonLd()} />
        <ThemeProvider>{children}</ThemeProvider>
        {/* Vercel Web Analytics. Cookieless and no cross-site tracking, so it
            needs no consent banner. Only reports once deployed to Vercel; it
            no-ops locally. */}
        <Analytics />
        {/**
         * The service worker is registered in PRODUCTION ONLY, and unregistered
         * in development.
         *
         * `sw.js` caches `/_next/static/` with `immutableFirst`, on the premise
         * that Next fingerprints those filenames with a content hash so a given
         * URL's bytes never change. That premise is true of `next build` and
         * FALSE of `next dev`, which serves chunks at stable paths that change
         * content on every edit. The result is a service worker that pins the
         * developer to a stale bundle indefinitely: this cost real debugging time
         * when the landing list threw `getPopularItems: invalid centre
         * lat=undefined` — cached JS still calling a signature the server had
         * already replaced. The app looked broken; only the cache was.
         *
         * Registering in dev buys nothing — offline behaviour is a production
         * concern, testable against `next build && next start`, where the hashes
         * are real. The unregister branch matters as much as the guard: without
         * it, a worker installed by a previous dev session survives this change
         * and keeps serving stale chunks to a developer who no longer registers
         * one.
        */}
        <script
          nonce={nonce}
          dangerouslySetInnerHTML={{
            __html:
              process.env.NODE_ENV === "production"
                ? `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', function() {
                  navigator.serviceWorker.register('/sw.js').catch(function(err) {
                    console.error('SW registration failed:', err);
                  });
                });
              }
            `
                : `
              if ('serviceWorker' in navigator) {
                navigator.serviceWorker.getRegistrations().then(function(rs) {
                  rs.forEach(function(r) { r.unregister(); });
                  if (rs.length) {
                    caches.keys().then(function(ks) {
                      return Promise.all(ks.map(function(k) { return caches.delete(k); }));
                    }).then(function() { location.reload(); });
                  }
                });
              }
            `,
          }}
        />
      </body>
    </html>
  );
}
