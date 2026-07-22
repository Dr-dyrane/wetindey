# Native-incorporation readiness assessment

**For:** WetinDey Founder (decision owner)
**Prepared by:** Executive-Product, controller-directed
**Date:** 2026-07-22
**Companion to:** `docs/operations/decisions/app-store-distribution-packet.md` (issue #24)
**Status:** Readiness assessment. Analysis and inert scaffolding only.

> This document authorizes no implementation. It opens no lane, installs no dependency,
> writes no application code, declares no schema, generates no migration, changes no copy,
> touches neither the manifest nor the service worker, and triggers no deployment. It records
> a decision already made and measures how far the current PWA is from a future native wrap.

---

## 0. The decision this records

**Founder decision: WetinDey stays a PWA now, and is built native-incorporation-ready.**

That is two commitments held together:

1. **Stay PWA.** No store submission, no native project, no wrapper for the Food pilot. The
   distribution packet's Option 1 recommendation stands, and every reason in it holds
   (link-driven and QR-driven pilot, offline already solved, no Apple PWA lane, ADR-021 not
   yet at P3).
2. **Native-incorporation-ready.** When a store presence is later justified, wrapping the
   existing web app must not require re-architecting it. This document names exactly what is
   already sufficient, what a wrapper would still need, and the minimal steps a future lane
   would take. The only artifact this readiness posture adds today is an inert
   `capacitor.config.ts` at the repo root (section 4), which changes nothing at runtime.

Readiness is a posture, not a project. Nothing below is a task list for now; it is a map for
later.

---

## 1. What is already ready (verified against the tree)

The PWA fundamentals a native wrapper would otherwise have to build already exist and are
maintained. Confirmed by direct read.

| Capability | State | Evidence |
|---|---|---|
| Install identity | Ready | `src/app/manifest.ts`: `id: "/"`, `display: "standalone"`, `scope: "/"`, `start_url: "/"`, `lang: "en-NG"`, served at `/manifest.webmanifest`, linked from `src/app/layout.tsx` (`manifest: "/manifest.webmanifest"`) |
| Installability | Ready | Manifest plus production service worker satisfy the installable-PWA criteria; iOS installs via Safari Add to Home Screen, Android via the install prompt |
| Offline behavior | Ready (strong) | `public/sw.js` (`VERSION v5`), registered production-only in `src/app/layout.tsx` and unregistered in dev. Per-asset-class strategy: network-first documents with an 8s timeout and complete-shell cache fallback, cache-first `/_next/static`, shell assets, Wikimedia photos, and the Mapbox library; bounded Mapbox style/glyph cache; `/api/` and non-GET never intercepted |
| Offline page | Ready | `public/offline.html` cached in the shell cache and served only when no complete shell exists |
| Theme and splash color | Ready (light only) | `theme_color` / `background_color` `#F2F2F7` in the manifest; `<meta name="theme-color">` in layout. A manifest has no media query, so the splash is a single light frame by design |
| Maskable icons | Ready at 192 and 512 | `public/icons/icon-{192,512}.png` and `icon-maskable-{192,512}.png`, wired in the manifest with `purpose: "any"` and `purpose: "maskable"` |

Net: the install identity is clean and pinned (`id: "/"` survives a future `start_url` change),
and offline (the usual PWA weak spot) is already covered per asset class. A wrapper inherits
all of this rather than rebuilding it.

---

## 2. What a wrapper would still need (the real gap)

None of the following exists today. Each is a genuine addition a future native lane owns, not a
defect in the PWA.

### 2.1 A wrappable target: static export or hosted origin

WetinDey is server-rendered and uses Server Actions (`next.config.ts` `serverActions.bodySizeLimit`,
the `src/app/` router tree, `@vercel/blob` avatar uploads through Server Actions). It therefore
**cannot cleanly `next export` to a static `out/` directory.** The realistic wrapper pattern is a
native shell whose webview points at the live hosted origin (the value already declared as
`NEXT_PUBLIC_APP_URL`, e.g. `https://wetindey.app`, per `src/app/sitemap.ts`). This is, in
substance, a wrapped webview, and it is the pattern the distribution packet's Option 3 assumes.
Consequence: `webDir` in a Capacitor config is a placeholder unless a static target is built;
`server.url` is the field that actually carries WetinDey.

### 2.2 Native shells for capabilities the web app does not have

- **Push.** There is no push today: `public/sw.js` has no `push` or `notificationclick` handler.
  A native wrapper that wants notifications needs a real push backend (APNs on iOS, FCM on
  Android) behind a native plugin. Nothing to migrate; there is simply nothing yet.
- **Deep links.** The manifest declares no `url_handlers`, `protocol_handlers`, `share_target`,
  or `shortcuts`. Native deep links need Universal Links (iOS `apple-app-site-association`) and
  App Links (Android `assetlinks.json` at `/.well-known/`) plus the wrapper's app plugin.
- **Status bar and safe areas.** A standalone webview needs explicit native status-bar styling
  and safe-area handling to match the light `#F2F2F7` chrome; the web `theme-color` does not
  reach a native status bar.
- **Auth return inside a webview.** Neon Auth email OTP (`@neondatabase/auth`, `src/lib/auth.ts`,
  `src/lib/auth-client.ts`) must be proven to complete inside WKWebView and WebView. The email
  return link typically requires Universal Links / App Links to land back in the app. Untested
  in a native runtime.
- **CSP under a webview origin.** The strict `vercel.json` CSP (`frame-ancestors 'none'`,
  scoped `connect-src`, `script-src`, and `img-src`) is written for the web origin. A
  live-URL webview mostly inherits today's behavior; a bundled-asset webview under a
  `capacitor://` or `https://localhost` scheme would need CSP and origin rework.

### 2.3 Icon and splash pipeline

Only `192` and `512` icons exist (any and maskable). A native build additionally needs the full
native asset set: iOS app icons across required sizes, iOS launch/splash images, Android
adaptive-icon foreground/background layers, and the round-icon set. This is normally generated
from a single source mark by the wrapper's asset tooling (for example `@capacitor/assets`), not
authored by hand, but the source mark and the generation step do not exist yet.

### 2.4 Account deletion (the hard gate, tied to ADR-021)

WetinDey supports account creation (Neon Auth email OTP). That makes **Apple App Store Review
5.1.1(v)** (in-app, user-initiated account deletion) and the equivalent Google Play requirement
apply to any store submission. The compliant path is exactly `docs/adr/021-account-deletion-lifecycle.md`,
whose "Truthful UI and completion" clause forbids exposing an enabled self-delete control until
the full async saga exists end to end.

Status of that saga (from the distribution packet):

- **P1 (persistence and provider boundary): delivered** (deletion schema, an inert server-only
  Neon branch-admin adapter, phase and idempotency primitives; migration held unapplied with
  authorization flags false). Delivery of P1 is groundwork, not readiness.
- **P2 (cleanup adapters and orchestration): pending.**
- **P3 (user flow, self-delete UI, end-to-end release evidence): pending.**

**Stated plainly: a store-submittable native build is blocked until ADR-021 reaches P3.** No
wrapper, however well built, can pass 5.1.1(v) before then, and ADR-021 forbids showing a
self-delete control at all until P3. This is the true unlock, ahead of any icon, push, or
deep-link work.

---

## 3. Readiness scorecard

| Wrapper prerequisite | Ready today? | Owned by |
|---|---|---|
| Install identity and manifest | Yes | PWA (done) |
| Offline / service worker | Yes | PWA (done) |
| Base icons (192, 512, maskable) | Yes | PWA (done) |
| Wrappable target (hosted origin) | Partial: hosted origin exists; no static export | Future native lane |
| Push backend (APNs / FCM) | No | Future native lane |
| Deep links (Universal / App Links) | No | Future native lane |
| Status bar / safe-area native styling | No | Future native lane |
| Auth return proven in webview | No | Future native lane |
| Full native icon/splash set | No | Future native lane |
| In-app account deletion (5.1.1(v)) | No: ADR-021 at P1, needs P3 | ADR-021 P2 then P3 |

---

## 4. The inert `capacitor.config.ts`

A new `capacitor.config.ts` sits at the repo root as readiness scaffolding. What it is and is
not:

- **It is inert.** It installs no dependency, imports nothing, and is imported by nothing.
  `next build` never reads it. It carries `appId` (`app.wetindey.mobile`, a reserved shape, not
  yet registered), `appName` (`WetinDey`, mirroring the manifest), `webDir` (`out`, a
  placeholder per section 2.1), and `server` settings (`androidScheme: "https"`, `cleartext:
  false`).
- **It is not typed against Capacitor.** The real `CapacitorConfig` type lives in the Capacitor
  CLI, which is deliberately not installed. The file pins its shape with a local structural
  interface instead, so `npx tsc --noEmit` stays clean with zero install.
- **It decides nothing.** `server.url` is intentionally left undefined so the inert config
  asserts no live target. It exists so a future lane starts from a decided shape rather than a
  blank file.

---

## 5. The exact minimal steps a future native lane would take

Ordered, and gated. This is a map, not an authorization.

1. **Unlock deletion first.** Land ADR-021 **P2 then P3** so an in-app deletion control can
   legally exist. Without this, no store build is submittable (section 2.4). This is the
   critical path and precedes every step below.
2. **Choose the target.** Confirm the wrapper loads the hosted origin (`server.url` =
   `NEXT_PUBLIC_APP_URL`) rather than a static export, given SSR + Server Actions (section 2.1).
3. **Install and initialize.** Add `@capacitor/core` and `@capacitor/cli`, then swap the inert
   config's local interface for `import type { CapacitorConfig } from "@capacitor/cli"` and set
   `server.url`. This is the first step that changes `package.json`; it is out of scope today.
4. **Add native shells only as needed.** Push plugin (APNs/FCM) and deep-link plugin (Universal
   Links / App Links) so an iOS wrapper adds genuine native value and clears Apple 4.2
   minimum-functionality; native status-bar and safe-area styling.
5. **Prove auth in the webview.** Verify the Neon Auth email OTP return completes inside
   WKWebView and WebView via the deep-link return path (section 2.2).
6. **Generate the asset set.** Produce the full native icon and splash set from a single source
   mark (section 2.3).
7. **Ship the cheapest store first.** Per the distribution packet: Android TWA on Play before any
   Apple wrapper, then a value-added Capacitor wrapper for iOS only if an Apple listing is
   independently justified after the pilot.

In one line: PWA now, deletion saga to P3 as the real unlock, then a hosted-origin wrapper with
push and deep links, Play before Apple, all under a future authorized lane. Nothing in this
document begins any of it.

---

## References

- `docs/operations/decisions/app-store-distribution-packet.md` (issue #24, the four options and
  the hard gates)
- `docs/adr/021-account-deletion-lifecycle.md` (the deletion saga and the 5.1.1(v) unlock)
- `docs/operations/WETINDEY-OPERATING-SYSTEM.md` (active phase: Food Truth and Pilot Operations)
- `src/app/manifest.ts`, `public/sw.js`, `public/offline.html`, `next.config.ts`, `vercel.json`
  (the verified PWA surface)
- `capacitor.config.ts` (the inert scaffolding this document describes)
