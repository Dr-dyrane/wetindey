# ADR-005: Mapbox is the map provider, and there is no geocoder

**Date:** 2026-07-16
**Status:** Accepted
**Owners:** Dr Dyrane Alexander

## Context

This ADR records a decision that was made in code and never written down. Mapbox shipped;
it is the base layer of the app and every screen sits on top of it. Nothing here is being
deliberated — it is being ratified so it stops being re-opened.

The hazard is specific. `WETINDEY_BIBLE.md:4396` lists "Map/geocoding provider." under
**40.2 Open decisions**. An agent reading that as fact concludes the choice is live and
swaps the map. It is not live, and the swap would rewrite working code.

What is actually in the tree, verified today:

- `src/app/layout.tsx:88-89` loads Mapbox GL JS **v3.1.2 from `api.mapbox.com`** — a
  `<link>` for the CSS and a `defer`red `<script>`. It is **not** a package dependency:
  `package.json` has no `mapbox-gl`. The architecture of record's claim that this is
  CDN-loaded is correct.
- The library is consumed off `window.mapboxgl` (`MapboxAdapter.ts:250-262`,
  `MapboxCanvas.tsx:181-194`), which is why `whenMapboxReady` has to poll for it —
  `defer` does not guarantee the script runs before React fires effects.
- The token is `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN`, read at `MapboxAdapter.ts:299` and
  `MapboxCanvas.tsx:258`. `NEXT_PUBLIC_` means it is public by construction — a Mapbox
  `pk.…` token, meant to ship to the browser and scoped by URL restriction on Mapbox's
  side. Both readers fall back to `""` rather than throwing, so a missing token renders a
  blank map with no error.
- There **is** a provider-agnostic interface: `MapProviderAdapter`
  (`MapboxAdapter.ts:83-108`). Its only implementer is `MapboxAdapter` (`:264`), and no
  file names the interface as a type — `MapboxCanvas.tsx:259` constructs `new
  MapboxAdapter(accessToken)` directly and its ref is typed `MapboxAdapter | null`
  (`:211`). The seam is a shape, not a switch. There is no factory and no
  `NEXT_PUBLIC_MAP_PROVIDER`; `.env.example` lists that key under "Deliberately absent".

**There is no geocoding, so half of the Bible's question is moot.** Nothing in `src/`
calls a geocoding endpoint — the only `api.mapbox.com` requests in the tree are the two
library fetches in `layout.tsx`. Places carry hardcoded coordinates
(`src/db/lagosSouthWest.ts`), location entry is Nigeria's administrative tree (commit
e4e2ecc), and distance is a local Haversine written expressly to avoid Mapbox billing
(`src/lib/geospatial.ts:1-30`). Geocoding is not deferred pending a provider — it is
ruled out by evidence: `lagosSouthWest.ts:20-21` records that Mapbox places "D Close,
Lagos 10" 20km from where it is, so a geocoder would move the pilot across Lagos.

## Decision

Mapbox GL JS is the map provider. It stays loaded from the Mapbox CDN at a pinned
version, keyed by a public `pk.…` token in `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN`.

`MapProviderAdapter` is the intended seam and `src/integrations/maps/` is the only place
allowed to know that Mapbox exists. It is not, today, a wired abstraction, and this ADR
does not ask anyone to finish it. Wire it when a second provider is real — per ADR-002's
standing rule, an interface with one implementer and no callers is exactly the shape that
produced this repo's dead code.

**There is no geocoder and none is planned.** The Bible's "geocoding provider" question is
closed as moot, not answered.

## Alternatives considered

Reconstructed after the fact. The contemporaneous reasoning is not recorded anywhere in
the repo, and the entries below are inference from what the code does, not history.

- **Google Maps.** No trace in the tree. Nothing records why it was passed over; the
  plausible reading is cost and the absence of a browser GL renderer with Mapbox's
  runtime style-swap, which the app relies on for theming (`MapboxAdapter.setTheme`).
- **MapLibre GL + a tile provider.** The obvious escape from lock-in, and the cheapest
  one to reach: MapLibre is an API-compatible fork, so `MapboxAdapter` would largely
  survive the move. The reason it was not taken is not recorded. What it costs is a tile
  contract and a style — Mapbox bundles both.
- **Leaflet / OSM.** Raster tiles, no GPU style layer. The route layer and the
  padding-aware camera (`setPadding`, and everything that depends on it) are GL
  affordances the app leans on hard; Leaflet would mean rewriting them, not porting them.
- **Keep the coordinates, drop the map.** Never seriously available. "Know before you go"
  is a claim about a place you are about to walk to.

## Consequences

- **Lock-in is real but bounded.** Mapbox owns the basemap styles
  (`mapbox://styles/mapbox/streets-v12`, `dark-v11`), the tiles, the marker DOM contract
  and the camera API. It is confined to one file, so the blast radius of a swap is
  `src/integrations/maps/` plus the `<script>` tag — but `MapProviderAdapter` has never
  been exercised against a second implementation, so its provider-neutrality is asserted,
  not proven.
- **Cost scales with map loads, and only map loads.** The app makes no Geocoding,
  Directions or Distance Matrix calls, so there is no per-query bill to grow.
  `geospatial.ts` names this as its reason for existing.
- **CDN-loading trades a bundle for a runtime dependency.** No `mapbox-gl` in
  `package.json` means no npm audit surface and no bundle weight — and no offline build,
  no integrity pin, and a third-party origin the PWA cannot function without.
  `whenMapboxReady` (`MapboxCanvas.tsx:181`) and `MapFailed` exist because of this.
- **The seam had a real, non-obvious cost, and here is the evidence.** `src/integrations`
  was never in `tailwind.config.ts`'s `content` globs. `MapboxAdapter.addMarker` builds
  its element with `el.className = "…"` (`:472`), and a class Tailwind never scans is a
  class Tailwind never emits — so `shadow-md`, `hover:scale-105` and `active:scale-95`
  resolved to nothing, and every place pin on the map was flat and unresponsive to press
  from the day it was written. No error, anywhere. `h-9` and `bg-status-confirmed` worked
  only by coincidence, because some scanned file used the same classes. Commit 8f36c65
  added `"./src/integrations/**/*.{js,ts,jsx,tsx,mdx}"` to `content`; it is there now, and
  the config carries the rule in a comment. Putting a renderer outside the tree the build
  scans is what a provider seam costs.

## Validation and review

`WETINDEY_BIBLE.md:4396` should stop listing this as open — that is the one change this
ADR is asking for, and it is out of this document's lane.

Reconsider if any of the following becomes true, and not otherwise:

- Mapbox's terms or per-load pricing change enough to matter at pilot scale. MapLibre is
  the first candidate, and the adapter is the only file that should move.
- A second map provider is genuinely required. Then, and only then, type against
  `MapProviderAdapter` and add the factory — wired in the same change, per ADR-002.
- Coverage grows past a hand-curated place list. That is the only condition under which
  geocoding is worth re-opening, and `lagosSouthWest.ts:12-21` is the standing evidence
  that a geocoder must never be pointed at the existing coordinates.
