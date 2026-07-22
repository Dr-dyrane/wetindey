# Historical Lane Archive: human interface and aboki fx

Historical evidence only. This file grants no current path ownership, release permission, provider access, migration authority, or deployment authority. For active locks and gates, read root [LANES.md](../../../../LANES.md).

- Source snapshot commit: `63d927a`
- Extraction method: exact heading block bytes from `LANES.md` at the source snapshot
- Integrity: each block SHA-256 is listed in [this archive index](README.md)

## Records

<a id="2026-07-human-interface-and-aboki-fx-01"></a>

##### ExchangePanel distance parity correction — COMPLETE / PATHS RELEASED

Owner: released.
Exclusive paths:

- `src/app/_components/exchange-panel/views/ExchangePanelView.tsx`
- `LANES.md`

Restored the pre-modularization Haversine distance calculation and original coordinate
order after the extracted view replaced it with a hardcoded `0.5 km`. Typecheck,
exact-path lint, diff checks, and localhost hot reload passed. Luna independently


<a id="2026-07-human-interface-and-aboki-fx-02"></a>

##### Aboki FX decision-first visual hierarchy and live trend — COMPLETE / PATHS RELEASED

Owner: current controller.
Exclusive paths:

- `src/app/_components/exchange-panel/views/ExchangePanelView.tsx`
- `src/app/_components/exchange-panel/styles/ExchangePanel.css`
- `src/app/_components/exchange-panel/hooks/useExchangePanel.ts`
- `src/app/_components/exchange-panel/imports/imports.ts`
- `src/app/_actions/currency-actions.ts`
- `LANES.md`

Flatten the first Aboki FX pane into one decision-first conversion canvas with progressive
rate disclosure and a secondary scroll-to-nearby-BDC action. Preserve currency/rate logic,
provider attribution, distance calculation, accessibility, and all data boundaries. No
actions, schema, picker, currency catalog, or nearby-location data changes.

Implemented as a flat two-amount relationship with progressive rate provenance, one
primary rate action, and one secondary BDC filter/scroll action. No validation or runtime
visual drive was performed in this bounded pass.

Forward recovery: the first pushed candidate used an unsupported `SolidIcon` size token
and failed TypeScript. Corrected to the governed 16px token before release validation.

Founder-directed forward redesign then made the decision state truthful and primary:
`Not confirmed`, actual BDC-kind sample count, and nearest BDC distance precede a compact
two-way conversion rail. The rail and action row each render at 44px; only the best three
BDC-kind samples remain in the first decision layer. Driven Safari evidence confirmed
`100` immediately converted to `138888.89` NGN, CBN attribution/date disclosed on demand,
and no bank-kind record leaked into the BDC list. TypeScript and exact-path lint passed.

Founder-requested follow-up adds a bounded seven-day provider-derived trend. Missing or
invalid history must omit the trend; no synthetic points, database writes, new provider,
or amount egress.

Final live state uses one quiet underlined `Nearby`/`Rate` switch rather than buttons or a
tab surface. Rate is the default: current attributed rate, seven validated provider
observations, direction sentence, sparkline, and one 44px two-way converter rail. Nearby
replaces that content in place with `Not confirmed` plus exactly three BDC-kind samples.
Driven Safari evidence proved a real seven-point CBN path, `Up 1.4%`, no nearby rows in
Rate, three rows in Nearby, unchanged URL, and `100 USD` deriving `138888.89 NGN`.
TypeScript and exact-path lint passed.


<a id="2026-07-human-interface-and-aboki-fx-03"></a>

##### Aboki FX Dyrane cognitive-state correction — COMPLETE / PATHS RELEASED

Owner: released. Former exclusive paths:

- `src/app/_components/exchange-panel/hooks/useExchangePanel.ts`
- `src/app/_components/exchange-panel/imports/imports.ts`
- `src/app/_components/exchange-panel/views/ExchangePanelView.tsx`
- `src/app/_components/exchange-panel/styles/ExchangePanel.css`
- `LANES.md`

The default state now presents one provider-attributed reference-rate hero, one
interpreted date-derived movement, one compact warning that nearby exchange remains
unconfirmed, a two-row reversible converter, and one action. Trend and Nearby remain
separately requested in-place states; Nearby exposes all six existing bank/BDC samples.
No route change or speculative provider claim was introduced.

Evidence: TypeScript passed; exact-path ESLint reported no errors and only the retained
`visibleRate` dependency warning. A reused Safari localhost tab proved Answer hides the
sparkline and provider rows; direct editing converts `250 USD` to `347222.22 NGN`; Trend
reveals movement and the sparkline with zero location rows; Nearby reveals exactly six
sample rows with no sparkline; all transitions retain `/`; both inputs, the swap control,
the primary action, and the Trend hit region meet the 44px contract.

Accepted follow-up, not implemented in this lane: pair-aware CAD↔USD and other
foreign-to-foreign cross-rates plus 7D/2W/1M/3M/6M/1Y trend windows require an ADR-017
update, ordered pair cache keys, same-provider/same-effective-date server derivation, and
two selectable currency rows. Do not emulate this with mixed or client-invented rates.


<a id="2026-07-human-interface-and-aboki-fx-04"></a>

##### Aboki FX truthful pair conversion — CLOSED / PATHS RELEASED

Owner: current controller.
Exclusive paths:

- `docs/adr/017-cbn-reference-rate-converter.md`
- `src/app/_data/reference-currencies.ts`
- `src/app/_data/exchange-sample-locations.ts`
- `src/app/_actions/currency-actions.ts`
- `src/app/_actions/exchange-location-actions.ts`
- `src/app/_components/currency-picker-sheet/`
- `src/app/_components/exchange-panel/hooks/useExchangePanel.ts`
- `src/app/_components/exchange-panel/views/ExchangePanelView.tsx`
- `src/app/_components/home-page/hooks/useHomePage.ts`
- `src/app/_components/home-page/views/HomePageView.tsx`
- `src/app/_components/home-page/imports/imports.ts`
- `src/app/_components/home-page/styles/HomePage.css`
- `src/app/_components/CrossCategorySignalRail.tsx`
- `src/integrations/maps/MapboxNearbyExchangeSearch.ts`
- `src/core/state/locationStore.ts`
- `scripts/location-default-contract.test.ts`
- `LANES.md`

Preserve Antigravity's accepted two-row UI while replacing its client-side placeholder
rate table with a server-validated ordered-pair result. Cross-rates must use one provider
and one effective date, caches must be pair-aware, NGN must be a typed selectable
currency, and unavailable evidence must fail closed. No amount may leave the browser.
Trend-window expansion remains a separate follow-up.

Replace the Sample exchange-point fixture with bounded live Mapbox Search Box discovery
around the selected browsing context. Results are map listings only: they do not prove a
current licence, opening state, exchange service, or offered rate. Do not send precise
device location or couple discovery to Food places. When no usable provider listing is
returned, retain the existing typed demonstration venues only as an unmistakably Sample
fallback around the canonical Lagos browsing context. Legacy outside-Lagos device values
must not rehydrate as browsing context; the independent session device fix remains true.

Completed 21 July 2026. Ordered-pair/provider/date derivation, duplicate rejection,
amount privacy, browsing-only discovery provenance, coordinate coarsening, fail-closed
Mapbox partial failure, canonical persisted browsing context, and restored modular
location assertions passed focused contracts, exact-path ESLint, TypeScript, production
build, localhost HTML smoke, and independent default-to-REFUTED review. No shared DB,
provider configuration, migration, or deployment was performed. All paths above are
released after the path-scoped commit.


<a id="2026-07-human-interface-and-aboki-fx-05"></a>

##### Human Interface delivery decision tree — COMPLETE / PATHS RELEASED

Owner: current controller.
Exclusive paths:

- `AGENTS.md`
- `docs/DYRANE-CONSTITUTION.md`
- `docs/design-system/UI-DELIVERY-DECISION-TREE.md`
- `LANES.md`

Record the Founder-approved visual-convergence-first workflow without weakening lane
ownership, truth boundaries, accessibility, independent refutation, or release evidence.
The process must distinguish visual ambiguity, behavioral defects, and consequential
truth/privacy/provider/schema work so each starts at the correct layer.

Completed in `31358b3`. The decision tree is wired from `AGENTS.md`, preserves the Dyrane
Constitution and evidence boundaries, and all four paths are released.


<a id="2026-07-human-interface-and-aboki-fx-06"></a>

##### Aboki FX User Origin Polylines + Browsing Anchor — COMPLETE / PATHS RELEASED

Owner: Codex Controller, taking over the completed Antigravity handoff. Exclusive paths:

- `src/app/_components/home-page/hooks/useHomePage.ts`
- `src/app/_components/home-page/views/HomePageView.tsx`
- `src/app/_components/get-it-sheet/hooks/useGetItSheet.ts`
- `src/app/_components/map-presentation/imports/imports.ts`
- `src/app/_components/map-presentation/views/MapPresentationView.tsx`
- `src/design-system/components/MapboxCanvas.tsx`
- `src/integrations/maps/MapboxAdapter.ts`
- `src/lib/directions.ts`
- `LANES.md`

Objective: Preserve Food-market route polylines from either the canonical browsing origin
or a fresh device origin explicitly disclosed for that exact Food target. FX discovery
pins are map listings only and must not produce navigation routes. Personal identity and
avatar markers render only for a fresh device fix; browsing context remains represented
by location chrome and never masquerades as Me. Do not publish Presence, claim physical
precision, or widen into exchange-panel UI/data.

Controller completion on 21 July 2026: non-device browsing context no longer renders a
personal marker; fresh device identity remains authoritative. Disclosed device origin is
captured with its immutable Food target and rejected after a target switch. Route geometry
is keyed by target, destination, and exact browse/disclosed origin so stale geometry hides
synchronously. FX listings no longer create routes. Scoped ESLint, TypeScript, and diff
checks passed. Independent default-to-REFUTED review returned PASS after three forward
corrections. Reused-tab runtime confirmed Food map render without the false browsing-avatar
marker and clean FX selection without a route. The stale modular location-contract
references were repaired and independently reviewed in `d1f87d0`.


---

