# App Store distribution decision packet

**For:** WetinDey Founder (decision owner)
**Prepared by:** Executive-Product, controller-directed
**Date:** 2026-07-22
**Issue:** #24 (App Store submission is blocked at step zero: WetinDey is a live PWA, and Apple cannot ingest a raw PWA)
**Status:** Decision packet. Analysis only.

> This document authorizes no implementation. It opens no lane, writes no code, declares no
> schema, generates no migration, changes no copy, and triggers no deployment. It exists to
> put one platform-distribution decision, and its sequencing, in front of the Founder.

---

## 1. What WetinDey is today (verified against the tree)

WetinDey is a Next.js 15 App Router application, server-rendered with Server Actions, hosted
on Vercel, and shipped as an installable Progressive Web App. Confirmed by direct read:

| Fact | Evidence |
|---|---|
| Next.js 15, App Router, Server Actions | `package.json` (`next: ^15.1.0`), `next.config.ts` (`serverActions.bodySizeLimit`), `src/app/` router tree |
| Vercel-hosted | `vercel.json` (headers, two `crons`), `.vercel/`, `@vercel/blob`, `@vercel/analytics` |
| Web App Manifest present | `src/app/manifest.ts`, served at `/manifest.webmanifest`, linked from `src/app/layout.tsx` (`manifest: "/manifest.webmanifest"`). `display: standalone`, `id: "/"`, maskable icons, `categories: [food, shopping, navigation]`, `lang: en-NG` |
| Service worker present, production only | `public/sw.js` (528 lines, `VERSION v5`), registered in `src/app/layout.tsx` in production and unregistered in dev |
| Offline already solved | `public/offline.html` (7 KB) plus per-asset-class caching in `sw.js`: network-first documents with an 8s timeout and cache fallback, cache-first static/photos/map library |
| Account creation exists | Neon Auth email OTP: `@neondatabase/auth` in `package.json`, `src/lib/auth.ts`, `src/lib/auth-client.ts` (this is what makes Apple 5.1.1(v) apply, see section 4) |
| Push notifications absent | No `push` or `notificationclick` handler in `sw.js` (grep count 0). Nothing to migrate; there is simply no push today |
| Deep links absent | Manifest declares no `url_handlers`, `protocol_handlers`, `share_target`, or `shortcuts`; `scope: "/"` only |
| No native wrapper exists | No Capacitor, Bubblewrap, or TWA reference anywhere in `src` or `docs` |

Net: offline is done, the install identity is clean, and there is no push or deep-link
surface to break because none exists yet. The gap in issue #24 is not a code defect. It is
that Apple's App Store does not accept a URL or a PWA as a submittable artifact, and Apple
has no equivalent to Android's Trusted Web Activity.

---

## 2. The current phase this decision sits inside

The operating system doc names the sole active phase as **WetinDey Food Truth & Pilot
Operations** (`docs/operations/WETINDEY-OPERATING-SYSTEM.md`), a bounded Festac Food pilot.
The same doc, on the App Store/release capability, already records: "No App Store submission
is implied while WetinDey remains a PWA." Distribution for this pilot is link-driven and
QR-driven into a bounded geography, not store-listing-driven. That framing matters for every
option below.

---

## 3. The four distribution options, with honest tradeoffs

### Option 1 - Stay PWA / installable web (the status quo)

- **Build cost:** zero. Already shipped and offline-capable.
- **Maintenance:** one codebase, already maintained. No new pipeline.
- **What breaks / must be added:** nothing for the pilot. iOS install is Safari "Add to Home
  Screen" (no store listing, no OS install prompt). iOS web push exists only on iOS 16.4+ and
  only after home-screen install; storage can be evicted under pressure. Offline is already
  present, so the usual PWA weak spot is covered.
- **Apple / Google review exposure:** none. No submission, no 5.1.1(v) gate, no 4.2 minimum-
  functionality risk, no 30% IAP surface, no review latency.
- **Pilot fit:** excellent. A Festac user opens a link and adds to home screen. The only thing
  a store would add here is discoverability, which the bounded pilot does not depend on.
- **Honest catch:** no App Store or Play presence at all. Does not satisfy a stakeholder who
  specifically wants a store listing or store-mediated trust.

### Option 2 - Android TWA on Play (Trusted Web Activity, via Bubblewrap / PWABuilder)

- **Build cost:** low. A TWA is a thin Android shell that renders the live PWA URL full-screen
  with no browser chrome. Bubblewrap generates it. Needs a Digital Asset Links file
  (`assetlinks.json` at `/.well-known/`), a Play Console account ($25 one-time), and signing keys.
- **Maintenance:** low. The shell rarely changes because the content is the live web app.
  Periodic Play policy and target-API-level bumps.
- **What breaks / must be added:** host `assetlinks.json`; complete the Play Data Safety form;
  satisfy Google Play's own account-deletion requirement (in-app path plus a public web URL),
  which lands on the same ADR-021 saga as Apple. Web push works on Android/Chrome inside a TWA.
  Deep links come from Asset Links plus intent filters.
- **Review exposure:** Play review is real but lighter than Apple. A TWA is a Google-sanctioned
  pattern, so it is not exposed to a "this is just a website" rejection. Google Play account
  deletion applies.
- **Pilot fit:** partial. It only addresses Android, and Android users can already install the
  PWA today without Play. Its marginal value is a Play listing for discoverability. Critically,
  **it does nothing for issue #24, which is about Apple.** There is no TWA on iOS.

### Option 3 - Native wrapper (Capacitor) around the existing web app

- **Build cost:** medium. Capacitor wraps the web app in a WKWebView (iOS) and a WebView
  (Android). Because WetinDey relies on Server Actions and SSR, it cannot be statically
  exported cleanly, so the realistic Capacitor pattern is a shell pointed at the live Vercel
  URL. That is, in substance, a wrapped webview.
- **What breaks / must be added:**
  - **Apple 4.2 minimum functionality:** a wrapper that is only your website is exactly what
    Apple rejects under 4.2 unless it adds genuine native capability. This is the primary
    review risk of this option.
  - **Push:** must build a real push backend (Capacitor Push plugin over APNs and FCM). Absent
    today.
  - **Deep links:** Universal Links (iOS `apple-app-site-association`) and App Links (Android
    `assetlinks.json`) plus the Capacitor App plugin. Absent today.
  - **Auth in a webview:** the Neon Auth email OTP return must survive inside WKWebView, which
    typically means Universal Links to bring the email link back into the app. Needs testing.
  - **Offline and CSP:** the existing service worker and the strict `vercel.json` CSP
    (`connect-src 'self'`, `frame-ancestors 'none'`) are written for the web origin; a bundled-
    asset webview under a different origin scheme would need rework. A live-URL webview mostly
    inherits today's behavior but is still a new runtime to verify.
- **Maintenance:** medium and rising. Now maintaining iOS and Android native projects, signing
  and provisioning, two store review cycles, plugin updates, and a Mac plus Xcode build
  pipeline, on top of the web app.
- **Review exposure:** highest on Apple. 4.2 minimum functionality, 5.1.1(v) in-app account
  deletion (hard gate, see section 4), privacy nutrition labels. Plus Google Play data safety
  and deletion.
- **Pilot fit:** poor. It buys a store presence at the cost of two native pipelines, a push
  backend, deep-link infrastructure, and Apple 4.2 risk, none of which the bounded Festac pilot
  needs. Premature against the current phase.

### Option 4 - Thicker native shell (React Native or a native nav shell, key screens native)

- **Build cost:** high. Real native engineering: a native shell with native navigation and tab
  bar, and progressively native screens. The map (Mapbox GL JS) would move toward the Mapbox
  native SDKs. This is effectively a second front-end.
- **What breaks / must be added:** everything option 3 adds (push, deep links, native auth
  return) plus native UI parity, native map, and a natively rebuilt offline strategy.
- **Maintenance:** highest. Three surfaces (web, iOS, Android) or two native plus shared web.
- **Review exposure:** best on Apple 4.2 because it is a real native app, but 5.1.1(v)
  deletion is still a hard gate, plus the full native review surface.
- **Pilot fit:** worst. It over-invests far ahead of pilot validation and contradicts the
  operating doc's ordering (correctness and pilot before category or platform expansion).

### Options at a glance

| | Build cost | Maintenance | Answers Apple (issue #24)? | Apple review risk | Deletion gate (5.1.1(v) / Play) | Pilot fit |
|---|---|---|---|---|---|---|
| 1. Stay PWA | none | one codebase | No (Apple has no PWA lane) | none (no submission) | not triggered | excellent |
| 2. Android TWA | low | low | No (Android only) | n/a on Apple | Play deletion applies | partial, Android only |
| 3. Capacitor wrapper | medium | medium | Yes | high (4.2 + 5.1.1(v)) | hard gate | poor |
| 4. Native shell | high | highest | Yes | moderate (5.1.1(v)) | hard gate | worst |

---

## 4. Hard gates, called out explicitly

**Gate A - Apple App Store Review 5.1.1(v), in-app account deletion.** Any app that supports
account creation must let the user initiate account deletion from within the app. WetinDey
supports account creation (Neon Auth email OTP, section 1). Therefore any iOS App Store
submission (options 3 and 4) is blocked until an in-app, user-initiated deletion path exists.
That path is exactly ADR-021 (`docs/adr/021-account-deletion-lifecycle.md`). Its "Truthful UI
and completion" clause forbids exposing an enabled self-delete control until the full async
saga exists. Status of that saga:

- **P1 (persistence and provider boundary): DELIVERED** at commit `4d7038c` (deletion schema,
  migration `0018` held `candidate_unapplied` with all authorization flags false, an inert
  server-only Neon branch-admin adapter, phase and idempotency primitives; tsc clean; P1
  contract 17/17). Exit still needs the disposable PGlite fresh-and-upgrade migration proof (a
  host tooling step) before any shared apply.
- **P2 (cleanup adapters and orchestration): PENDING.**
- **P3 (user flow, self-delete UI, end-to-end release evidence): PENDING.** P3 is what actually
  exposes the in-app deletion control, and only after P1 and P2 pass and the full saga is driven
  in each authorized environment.

**Consequence, stated plainly: App Store readiness DEPENDS on the ADR-021 deletion saga
completing through P3.** P1 landing is groundwork, not readiness. Until P2 and P3 land, no iOS
submission can satisfy 5.1.1(v), and per ADR-021 no self-delete control may be shown at all.

**Gate B - Google Play account deletion.** Play requires an account-deletion path (in-app plus
a public web URL) for apps that support account creation. So options 2, 3, and 4 all gate on the
same ADR-021 saga, not only Apple.

**Gate C - Apple 4.2 minimum functionality.** A webview-only wrapper (option 3) risks rejection
unless it adds real native value such as push or native integrations. Android's TWA (option 2)
is a sanctioned pattern on Play and is not exposed to this; Apple has no such carve-out.

**Gate D - Developer accounts and toolchain.** Apple Developer Program ($99/year) and a Mac plus
Xcode pipeline for any iOS build (options 3 and 4); Google Play ($25 one-time) for options 2, 3,
4. Signing and provisioning for each.

**Gate E - Auth inside a webview.** For options 3 and 4, the Neon Auth email OTP return flow must
be proven inside WKWebView and WebView, which typically requires Universal Links and App Links.

Only Option 1 clears every gate today, because it makes no submission.

---

## 5. Recommendation

**Stay on the PWA (Option 1) for the Food pilot, and defer any store submission until two
conditions are both met.** Rationale, tied to the evidence:

1. The pilot does not need a store. Distribution into a bounded Festac cohort is link-driven and
   QR-driven, and the operating doc already states no App Store submission is implied while
   WetinDey is a PWA. Offline, the usual PWA weakness, is already solved (`sw.js`, `offline.html`).
2. The only options that answer Apple (issue #24) are 3 and 4, and both are blocked by Gate A
   until ADR-021 reaches P3. Submitting before then is impossible, and building the wrapper
   ahead of P3 produces a shell that cannot pass review.
3. Building native now spends the pilot's scarce effort on push backends, deep-link
   infrastructure, two native pipelines, and Apple 4.2 risk, ahead of any pilot outcome
   evidence.

**Sequencing when a store is warranted (post-pilot):**

- Complete ADR-021 **P2 then P3** under the appropriate platform seat (it is already the App
  Store critical path, wave 1). This makes Gate A and Gate B satisfiable and gives both stores a
  real in-app deletion path.
- Ship **Android TWA on Play (Option 2) first.** Lowest cost, Google-sanctioned, no 4.2 risk,
  reuses the live PWA. This is the cheapest way to earn a real store listing once deletion P3 has
  landed.
- Only if an iOS App Store presence is independently justified after the pilot, build a
  **Capacitor wrapper (Option 3) that adds genuine native value** (push plus deep links) so it
  clears Apple 4.2. Never submit a bare webview. Reserve Option 4 (thicker native shell) for a
  post-pilot growth decision backed by real demand, not for the pilot.

In one line: PWA through the pilot, deletion saga to P3 as the true unlock, then Play via TWA,
then Apple via a value-added Capacitor wrapper only if iOS store presence is justified.

---

## 6. The exact decision the Founder must make

1. **Pilot distribution path.** Confirm PWA-only, no store submission, for the duration of the
   Food pilot. (Recommended.) Or direct a store track to begin now, accepting that Apple cannot
   be reached until ADR-021 P3 lands regardless.
2. **The unlock trigger.** Authorize store work to begin only after both (a) the Food pilot
   truth and coverage gate is met, and (b) ADR-021 P2 and P3 land. Confirm that ADR-021 P2/P3 is
   resourced under the platform seat as the App Store critical path (P1 is already delivered at
   `4d7038c`).
3. **First store target, when the trigger fires.** Confirm Android TWA on Play before any Apple
   wrapper. Or state a different order and accept its higher cost and review risk.
4. **Whether iOS App Store presence is a real requirement at all.** Decide if an Apple listing is
   a genuine pilot-phase need or a post-pilot growth decision, since the only paths to Apple
   (Options 3 and 4) are the expensive ones and Apple is the entire reason issue #24 exists.

No lane opens and no work begins on any of the above until the Founder records this decision and
the controller grants the corresponding paths.
