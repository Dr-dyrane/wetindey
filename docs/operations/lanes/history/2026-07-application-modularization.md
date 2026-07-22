# Historical Lane Archive: application modularization

Historical evidence only. This file grants no current path ownership, release permission, provider access, migration authority, or deployment authority. For active locks and gates, read root [LANES.md](../../../../LANES.md).

- Source snapshot commit: `63d927a`
- Extraction method: exact heading block bytes from `LANES.md` at the source snapshot
- Integrity: each block SHA-256 is listed in [this archive index](README.md)

## Records

<a id="2026-07-application-modularization-01"></a>

##### Live-app modularization manifest — COMPLETE THROUGH SLICE 7 / RELEASED

Owner: persistent Modularization Engineer `019f7b10-8c5a-70e2-8fc9-2fb0b2b328dc`.

Released Slice 8 paths:

- `src/app/_components/home-page/views/HomePageView.tsx`
- new `src/app/_components/home-page/views/HomePlaceDetailView.tsx`

Slice 8 extracted only the live Market/Place detail renderer from `HomePageView` into the
dedicated presentational subview. The existing navigation level, compact/regular layout,
distance origin, offer loading/error/empty states, Visit shop/market action, callbacks,
copy, and data semantics remain unchanged. Independent static refutation passed with no
P1/P2/P3; runtime/type/build evidence was not requested. Both source paths are released.

Released Slice 9 paths:

- `src/app/_components/home-page/views/HomePageView.tsx`
- new `src/app/_components/home-page/views/HomeSheetHeaderView.tsx`

Slice 9 extracted only the live sheet brand/category/signal/action/search header into a
dedicated presentational subview. Category switching, cross-category signals, Food-only
report/search controls, profile identity, labels, hit regions, comments, and callbacks
remain unchanged. Independent static refutation passed with no P1/P2/P3; runtime/type/build
evidence was not requested. Both source paths are released.

Released Slice 10 paths:

- `src/app/_components/home-page/views/HomePageView.tsx`
- new `src/app/_components/home-page/views/HomeSheetResultsView.tsx`

Slice 10 extracted only the live Food/Money results body into a dedicated presentational
subview. Exchange selection/filtering, Food popular/search branches, subject keys, retry,
loading/error/empty states, photo credits, scroll containment, and safe-area reservation
remain unchanged. Independent static refutation passed with no P1/P2/P3; runtime/type/build
evidence was not requested. Both source paths are released.

Released Slice 7 paths:

- `src/app/_components/currency-picker-sheet/views/CurrencyPickerSheetView.tsx`
- `src/app/_components/currency-picker-sheet/views/CurrencyPickerSheetContent.tsx` (new)

Slice 7 completed in `00e9340`: the existing search field, currency row/group, and
picker-content renderers moved from the 367-line view into one live 272-line content
subview, leaving the host at 103 lines. Every prop, branch, copy string, key,
preview/trend/NGN calculation, fallback `ModalSheet`, navigation behavior, and public
controller edge was preserved. Exact-path lint, TypeScript, diff checks, and independent
refutation passed. Both paths are released.

Released Slice 6 paths:

- `src/app/_components/about-sheet/views/AboutSheetView.tsx`
- `src/app/_components/about-sheet/views/AboutSheetDetail.tsx` (new)

Slice 6 completed in `6040aac`: the existing detail-page renderers moved from the
330-line host into one live 223-line detail subview, leaving the host at 118 lines. Every
export, prop, branch, copy string, interaction, and navigation behavior was preserved;
focused structure, TypeScript, exact-path lint, diff checks, and independent refutation
passed. Both paths are released. This remains a sequential queue: allocate one slice at a
time and wire its live caller in the same commit:

1. new `src/app/_hooks/useLocationIdentity.ts` plus `src/app/page.tsx`;
2. new `src/app/_components/MapPresentation.tsx` plus `src/app/page.tsx`, without
   changing `MapboxCanvas.tsx` or `MapboxAdapter.ts`;
3. new `src/app/_components/FoodResultsPanel.tsx` plus `src/app/page.tsx`, pure rendering
   only.

Every slice must preserve camera/browsing/device separation, one map mount, stable marker
callbacks, async states, and sheet/action transitions. Do not use orphan `src/modules/`,
`src/db/queries/`, or trust paths. Queue these behind map recovery, self-avatar/recenter
correction, and Presence page integration sequencing; no path is currently owned.


<a id="2026-07-application-modularization-02"></a>

##### Live-app modularization Slice 1 — COMPLETE / RELEASED

Owner: Core / Application Architecture worker. Exclusive paths:

- new `src/app/_hooks/useLocationIdentity.ts`
- `src/app/page.tsx`

Move only the current browsing/device/self-location identity state, effects, and callback
assembly into the live hook and wire `page.tsx` to it in the same commit. No semantic change,
new store, Presence/shared-user behavior, Mapbox/Canvas/Adapter, action, schema, or migration
changes. Preserve provenance, accuracy, timestamps, profile/avatar invalidation, recenter
semantics, and every current output. Require exact source-shape comparison, focused
type/static evidence, and independent default-to-REFUTED review. Later modularization slices
remain pathless.


<a id="2026-07-application-modularization-03"></a>

##### Live-app modularization Slice 2 — COMPLETE / RELEASED

Owner: Antigravity (External Approved Contractor - Product Engineering & UX Department). Former paths:

- new `src/app/_components/map-presentation/MapPresentation.tsx`
- new `src/app/_components/map-presentation/MapPresentationView.tsx`
- new `src/app/_components/map-presentation/useMapPresentation.ts`
- new `src/app/_components/map-presentation/imports.ts`
- new `src/app/_components/map-presentation/copy.ts`
- new `src/app/_components/map-presentation/MapPresentation.css`
- `src/app/page.tsx`

The map presentation rendering UI, floating controls, notice display, and recenter callback assembly are successfully extracted out of the monolithic `src/app/page.tsx` into a deeply modular component structure under `src/app/_components/map-presentation/`. Bounded verification passed successfully (strict types compiled cleanly, lint passed with 0 warnings on modified files). Release all 7 paths. Commit `aea79fa` is pushed locally.


<a id="2026-07-application-modularization-04"></a>

##### Live-app modularization Slice 3 — COMPLETE / RELEASED

Owner: Antigravity (External Approved Contractor - Product Engineering & UX Department). Former paths:

- `src/app/page.tsx`
- new `src/app/useHomePage.ts`
- new `src/app/HomePageView.tsx`
- new `src/app/imports.ts`
- new `src/app/copy.ts`
- new `src/app/HomePage.css`

The monolithic root page `src/app/page.tsx` is successfully strangulated and modularized into a logic hook, presentational JSX view, CSS layout, localized copy, imports manifest, and controller, preserving all developer inline comments and rollback notes. All static checks and full production build verification passed cleanly with zero warnings on the new files. Release all 6 paths. Commit `88964e1` is pushed locally.


<a id="2026-07-application-modularization-05"></a>

##### Live-app modularization Slice 4 — COMPLETE / RELEASED

Owner: Antigravity (External Approved Contractor - Product Engineering & UX Department). Former paths:

- `src/app/page.tsx`
- new `src/app/_components/home-page/`
- delete `src/app/useHomePage.ts`
- delete `src/app/HomePageView.tsx`
- delete `src/app/imports.ts`
- delete `src/app/copy.ts`
- delete `src/app/HomePage.css`
- new `src/app/_actions/`
- delete `src/app/actions.ts`
- delete `src/app/currency-actions.ts`
- delete `src/app/problem-report-actions.ts`
- `src/design-system/components/PlaceOfferRow.tsx`
- `src/design-system/components/MapboxCanvas.tsx`
- `src/integrations/maps/MapboxAdapter.ts`
- `src/app/_hooks/useLocationIdentity.ts`
- `src/app/_components/ManageProfileSheet.tsx`
- `src/app/_components/MyReportsSheet.tsx`
- `src/app/_components/LocationSheet.tsx`
- `src/app/_components/ItemDetailSheet.tsx`
- `src/app/_components/GetItSheet.tsx`
- `src/app/_components/ProfileSheet.tsx`
- `src/app/_components/ExchangePanel.tsx`
- `src/app/_components/ReportProblemSheet.tsx`

Organized the homepage modular files into structured subfolders under `src/app/_components/home-page/` and relocated loose server action files into `src/app/_actions/`, updating all import edges. Verification checks (`lint`, `tsc`, and full production build) completed with 0 errors. Released paths. Commit `0863c7800a1ae8f82104ee994da743ab7524776c` is pushed locally.


<a id="2026-07-application-modularization-06"></a>

##### Live-app modularization Slice 5 — COMPLETE / RELEASED

Owner: current controller, with one delegated Core / Application Architecture worker.
Exclusive paths:

- `src/app/_components/ReportProblemSheet.tsx`
- `src/app/_components/PresentationHost.tsx`
- new `src/app/_components/report-problem-sheet/ReportProblemSheet.tsx`
- new `src/app/_components/report-problem-sheet/hooks/useReportProblemSheet.ts`
- new `src/app/_components/report-problem-sheet/views/ReportProblemSheetView.tsx`
- new `src/app/_components/report-problem-sheet/styles/ReportProblemSheet.css`
- new `src/app/_components/report-problem-sheet/copy/copy.ts`
- new `src/app/_components/report-problem-sheet/imports/imports.ts`

Continue the established six-file MVC strangulation pattern without redesigning the
surface or changing submission semantics, copy meaning, accessibility, focus behavior,
Server Actions, error handling, or external boundaries. Remove the obsolete root wrapper
only after every live import points at the new controller. No homepage, map, Aboki FX,
database, schema, migration, provider, package, or shared design-system path is in scope.

Implementation commit `c59c7be` completed the exact structural slice and passed focused
type, lint, diff, and modularization-contract checks. The reused existing localhost tab
then exercised the Profile -> Report a problem path, labelled dialog, required-field
disabled submit state, reverse-Tab containment, and native Escape dismissal. The redacted
evidence record is `docs/operations/RC-139-REPORT-PROBLEM-RUNTIME.md`; it does not claim
durable pixel proof or a submission mutation. No Report Problem runtime error appeared.
Release all exact paths. A separate pre-existing CSP nonce hydration warning is recorded
below and does not widen this lane.

No further modularization candidate is active. Audit and record a new exact,
non-overlapping lane only after Slice 7 is committed, independently accepted, and
released.


<a id="2026-07-application-modularization-07"></a>

##### Automated modularization structure verification contract — RELEASED / PATHLESS

Former owner: Antigravity (External Approved Contractor - Product Engineering & UX Department). Former paths:

- new `scripts/modularization-structure-contract.test.ts`
- `LANES.md`

Created an automated static verification contract in `scripts/modularization-structure-contract.test.ts` enforcing that all component subfolders under `src/app/_components/` adhere strictly to the 6-file MVC slice pattern (`hooks/`, `views/`, `styles/`, `copy/`, `imports/`, `Component.tsx`). Standardized `map-presentation` component layout to conform with the contract. All tests passed. Released paths.


<a id="2026-07-application-modularization-08"></a>

##### ProfileSheet component modularization — RELEASED / PATHLESS

Former owner: Antigravity (External Approved Contractor - Product Engineering & UX Department). Former paths:

- `src/app/_components/ProfileSheet.tsx`
- new `src/app/_components/profile-sheet/`
- `LANES.md`

Modularized the 41.8 KB ProfileSheet component into a 6-file MVC subfolder slice under `src/app/_components/profile-sheet/` (`hooks/`, `views/`, `styles/`, `copy/`, `imports/`, `ProfileSheet.tsx`). All typechecks and static contract tests passed cleanly. Released paths.


<a id="2026-07-application-modularization-09"></a>

##### GetItSheet component modularization — RELEASED / PATHLESS

Former owner: Antigravity (External Approved Contractor - Product Engineering & UX Department). Former paths:

- `src/app/_components/GetItSheet.tsx`
- new `src/app/_components/get-it-sheet/`
- `LANES.md`

Modularized the 37.3 KB GetItSheet component into a 6-file MVC subfolder slice under `src/app/_components/get-it-sheet/` (`hooks/`, `views/`, `styles/`, `copy/`, `imports/`, `GetItSheet.tsx`). All typechecks and static contract tests passed cleanly. Released paths.


<a id="2026-07-application-modularization-10"></a>

##### ExchangePanel component modularization — RELEASED / PATHLESS

Former owner: Antigravity (External Approved Contractor - Product Engineering & UX Department). Former paths:

- `src/app/_components/ExchangePanel.tsx`
- new `src/app/_components/exchange-panel/`
- `LANES.md`

Modularized the 30.5 KB ExchangePanel component into a 6-file MVC subfolder slice under `src/app/_components/exchange-panel/` (`hooks/`, `views/`, `styles/`, `copy/`, `imports/`, `ExchangePanel.tsx`). All typechecks and static contract tests passed cleanly. Released paths.


<a id="2026-07-application-modularization-11"></a>

##### ItemDetailSheet component modularization — COMPLETE / PATHS RELEASED

Owner: released. Exclusive paths:

- `src/app/_components/ItemDetailSheet.tsx`
- new `src/app/_components/item-detail-sheet/`
- `LANES.md`

Modularize the 27.8 KB ItemDetailSheet component into a 6-file MVC subfolder slice under `src/app/_components/item-detail-sheet/` (Controller, Hook, View, Style, Copy, Imports) satisfying the modularization structure contract.

Controller takeover on 19 July 2026: Antigravity left only untracked copy/import/style
stubs. Codex completed the compatibility export, thin controller, model/presentation
hooks, focused subviews, copy, imports, and scoped CSS while preserving public exports.
Terra's structural, type, exact-path lint, and diff checks passed; Luna independently
returned NOT_REFUTED with no P1/P2/P3. Production build and localhost transport/render
gates passed. Direct visual pixels remain technically unverified because the reused
Safari capture returned a known off-screen black frame; no application error was
observed.

