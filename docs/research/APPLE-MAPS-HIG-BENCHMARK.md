# Apple Maps and Human Interface benchmark

**Retrieved:** 2026-07-21
**Scope:** WetinDey map, sheet, marker, control, and place-detail acceptance criteria.

WetinDey adopts Apple interaction principles where they improve clarity, reachability, and
accessibility. It does **not** copy Apple assets, proprietary components, visual trade
dress, or product-specific styling.

## Founder acceptance correction (docs-only governance)

This benchmark is a behavior, layout, and accessibility reference. Apple HIG supplies the
interaction and spatial rules; Shop is used only as a communication-density and hierarchy
reference. Neither source authorizes copying assets, trade dress, proprietary components,
or visual styling.

The accepted experience must prove all of the following in direct pixels and assistive
semantics:

- Compact place surfaces are floating peek/half sheets that preserve map context; the
  expanded state is an edge-to-edge docked sheet rather than a second floating card.
- Visible chrome may be slimmer, but every interactive hit region remains at least
  44×44 CSS px. Controls expose real press/release feedback and honor reduced-motion settings.
- Unnecessary nested surface/card/pill containment is flattened. Semantically distinct
  cards, pills, and status badges remain when ADR-018 gives them meaning. Separation comes
  from restrained semantic material and elevation depth, not borders or sharp contrast.
- Licensed imagery may bleed to the card edge and blend with its surrounding surface;
  a fixed image frame alone is not source proof of an edge-bleed defect. Blending remains a
  direct-pixel runtime acceptance question.
- Solid glyphs are optically balanced inside semantic orbs, paired with labels or another
  non-color distinction, and remain truthful in light, dark, grayscale, and forced-colors
  modes where those modes are observable.

## Adaptation matrix

| Official principle | WetinDey adaptation | Acceptance evidence |
|---|---|---|
| Preserve map context when presenting place information. | Keep the selected location visible while a place card or sheet is shown. Compact cards must avoid repeating facts already expressed by the map or adjacent controls. | Reused-tab compact and regular evidence shows the selected marker and relevant map context remain visible through open, selection, push, pop, and reopen. |
| Sheets, controls, and content respect layout guides and safe areas. | Position recenter/current-location and other map controls from the **live sheet inset**, not a guessed detent. Controls float above the map with sufficient contrast and elevation. | Exercise every live detent and safe-area configuration. The control remains visible, unobscured, and reachable without covering essential map content. |
| User location is a distinct, customizable annotation. | Render self identity as an uploaded avatar or local fallback. Render location accuracy separately as a bounded halo/overlay; never blur identity into an accuracy treatment. Guest identity remains local and is never published to peers. | Signed-in, fallback, guest, precise, and approximate states are independently visible and truthfully labelled. No external avatar-generator request or peer publication occurs. |
| Location controls are map-scoped and independently operable. | Treat recenter/current-location as a standalone map control that remains available at every sheet detent. | At compact and regular sizes, each detent preserves a visible control, truthful accessible name, press feedback, and successful activation. |
| Interactive controls need adequate size, feedback, and separation. | Provide at least a 44×44 CSS px hit region, a perceivable press state, and enough separation to prevent accidental activation. | Pointer edge-hit and keyboard/focus checks confirm the full target, visible feedback, focus indication, and nonoverlap. |
| Color and icons communicate consistent meaning without relying on color alone. | Combine stable icons with semantic families: confirmed/available, unavailable, caution/stale, and genuinely unknown. Preserve explicit text or another noncolor signal. | Light, dark, grayscale, and forced-colors evidence keeps types and states distinguishable; accessible names remain truthful. |
| Place cards and lists stay compact and scannable. | Let imagery carry hierarchy, keep item/variant and price/unit concise, retain essential availability/freshness/provenance, and remove redundant explanatory copy. | Compact and regular evidence shows readable facts, no collisions, 44×44 CSS px actions, logical accessibility order, and working attribution/source links. |
| Responsive layouts preserve behavior rather than merely fitting pixels. | Compact and regular layouts may redistribute space, but must preserve selection context, control reachability, information order, and interaction semantics. | Use one reused tab across compact/regular and light/dark transitions. Verify grayscale, detent changes, push/pop/reopen, loading/empty/error states where represented, and absence of stale state or document-scroll escape. |
| Compact sheets communicate hierarchy through progressive disclosure. | Use a floating peek/half sheet over visible map context, then dock the expanded sheet edge-to-edge; do not stack redundant cards or leave an unexplained dead region. | Direct pixels at each live detent show map context, the selected place, and the sheet boundary; AX order matches the visible hierarchy. |
| Controls need feedback without consuming visual mass. | Keep visible chrome slender while retaining ≥44×44 CSS px hit geometry, real press/release states, and reduced-motion-safe transitions. | Pointer edge hits, keyboard focus, visible press/release, and reduced-motion evidence where tooling supports it. |
| Material depth should clarify, not fragment. | Flatten only unnecessary nested containment; preserve semantically distinct cards, pills, and status badges per ADR-018. Use restrained semantic material/elevation with no borders or sharp contrast jumps. | Light/dark/grayscale screenshots show one coherent surface hierarchy without unnecessary seams or border dependence. |
| Imagery can carry hierarchy. | Let licensed imagery bleed/blend to the edge of its containing surface when pixels support it; a fixed frame is not by itself a defect. | Narrow and regular offer/place pixels must directly prove edge alignment, blending, readable attribution, and no image collision or overflow. |
| Icons communicate intent beyond color. | Use solid, optically balanced glyphs in named semantic orbs, with labels or another non-color distinction. | AX names plus light/dark/grayscale/forced-colors screenshots distinguish states without hue alone. |

## Read-only current-code reconciliation (2026-07-21)

This is a source-and-evidence inventory, not implementation authority. The live tree is
modular: `src/app/page.tsx` is only the `HomePage` wrapper. Source-complete means the
current code expresses the intended boundary; it does not make pixels, AX, or every state
accepted. Runtime-unverified items stay unverified. The path proposals below are
sequenced future claims; PM must allocate fresh exact locks before any proposal is called
disjoint or implementation-ready.

| Acceptance area | Source-complete evidence | Remaining violation or runtime residual |
|---|---|---|
| Compact/expanded density and layering | `BottomSheet.tsx` has floating context/expanded material states; `CompactShell.tsx`, `RegularShell.tsx`, and `AdaptiveShell.tsx` share one NavigationStack. Large uses the named expanded glass surface and context detents use the island material. | Direct compact peek/half and expanded edge-to-edge pixels, no dead strip, AX order, light/dark/grayscale and settled Safari compositor behavior remain runtime gates. |
| Hit region versus visible control | `BottomSheet.tsx` keeps the handle target at `SHEET_HANDLE_TARGET_PX` with `minHeight` and `min-h-11`; the grabber is only `h-[5px] w-9`. Profile and close/recenter use tap-sized targets. | `HomePageView.tsx` Add/category chrome and `MapPresentationView.tsx` theme control render `h-9`/`h-9 w-9` controls without an explicit `min-h-tap`; these are concrete sub-44 CSS px outer-target risks even though the visible icon is intentionally smaller. Edge hits, keyboard focus, press/release, and reduced-motion behavior must be measured, not inferred. The handle’s source guard is not runtime proof. |
| Map context and CTA occlusion | `AdaptiveShell.tsx` publishes live leading/bottom insets; `MapPresentationView.tsx` positions recenter from the shell inset. `HomePageView.tsx` renders one `Visit market`/`Visit shop` CTA adjacent to the Prices scroller. | Reused-tab pixels must prove selected marker/map context and recenter reachability at every detent, and that the CTA remains available without covering first/last rows or attribution. The regular panel’s settled Safari black render remains a separate compositor residual. |
| Liquid/translucent material | `BottomSheet.tsx` cross-fades two elevation layers and uses named, borderless materials; `RegularShell.tsx` uses the thick island material and the shared shell publishes geometry. | Direct light/dark/grayscale pixels, safe-area rails, and transition-settled visibility remain unverified. No source claim proves a compositor issue is fixed. |
| Status non-color semantics | `StatusBadge.tsx` provides confirmed/caution/unavailable/info icon-text families; `PlaceOfferRow.tsx` carries explicit unknown and Sample/provenance signals, while adopted semantic-orb paths supply named contextual glyphs. | Direct grayscale/forced-colors evidence for each state and truthful AX names is incomplete; `StatusBadge` remains semantically distinct under ADR-018 and is not a blanket flattening target. |
| Market two-column/card hierarchy | `HomePageView.tsx` uses `AsyncList` `grid-cols-2` only for regular and leaves compact as one media-led column; the CTA is a single action and attribution remains in `PlaceOfferRow.tsx`. | Narrow-regular fallback, compact spacing/image edge blend, concise identity→price/unit→availability scan line, final row/full attribution, CTA persistence, and no horizontal overflow require direct pixels/AX. |
| Self/location marker acceptance | `useLocationIdentity.ts` separates uploaded-avatar/initials/guest identity from device-derived browsing; `MapPresentationView.tsx` passes `sharedUsers={[]}` and `MapboxCanvas` keeps the self marker/accuracy treatment separate. | Uploaded avatar versus initials, guest fallback, precise versus approximate halo, non-color selected marker, recenter reachability at every detent, marker interaction, and truthful AX names remain runtime-unverified. |
| Regular-panel diagnosis | DOM markers/chrome were present while immediate and settled JPEGs were byte-identical ~10 seconds apart with black Mapbox/panel pixels. | This is classified as a settled Safari render/compositor failure, not a transition-frame artifact; it is pathless evidence and not permission to edit Maps/Adapter paths. |
| Reduced motion / forced colors | `globals.css` and `motion.ts` expose hooks. | Modes were not exercised in this docs lane; record as unverified until direct evidence exists. |

### Sequenced future claims (not current edits)

Each row has one proposed owner and non-overlapping exact paths. These are not active
claims, and none is disjoint until PM records a fresh lock after current locks release.

| Sequence | One proposed owner | Exact future paths | Bounded acceptance |
|---|---|---|---|
| 1 | Frameworks / sheet hierarchy | `src/design-system/components/BottomSheet.tsx`, `src/design-system/components/CompactShell.tsx`, `src/design-system/components/RegularShell.tsx`, `src/design-system/components/AdaptiveShell.tsx` | Compact peek/half map context, expanded docked edge-to-edge, ≥44×44 CSS px handle with slim visual, press/release/reduced-motion, no nested surface/dead tail, AX/pixel proof. Requires PM lock. |
| 2 | Market Details / offer hierarchy | `src/design-system/components/PlaceOfferRow.tsx`, `src/design-system/components/StatusBadge.tsx` | Regular two-column only when supported, compact one column, edge-blended imagery, concise scan line, non-color status, attribution/focusability, final-row/CTA proof. One atomic owner; no blanket badge rewrite. Requires PM lock. |
| 3 | Profile identity presentation | `src/app/_components/profile-sheet/ProfileSheetView.tsx` | Uploaded image/initials/guest semantics and truthful AX without changing presence/privacy wiring. Requires PM lock. |
| 4 | Pathless Maps/HI evidence | *(no source path)* | Compact/regular detents, selected marker, recenter inset, map occlusion, grayscale/forced-colors/reduced-motion and settled Safari evidence only; no source claim. |

Current `LANES.md` release rows remain authoritative: released Market, Maps, iconography,
Presence, and Frameworks paths are not silently reopened by this document. Any future
implementation proposal requires a fresh PM lock after the relevant released or active
path is explicitly reclaimed. In particular, `src/app/page.tsx`, `MapboxCanvas.tsx`, and
`MapboxAdapter.ts` are evidence references, not HI implementation claims here.

## Required runtime evidence

A Maps or Human Interface lane is not visually complete from static inspection alone.
Record reused-tab evidence for:

- compact and regular layouts;
- light, dark, and grayscale presentation;
- forced-colors behavior where tooling supports it;
- every live sheet detent and safe-area inset;
- selected place visibility and map-control reachability;
- self identity, fallback, and separate accuracy states;
- 44×44 CSS px targets, press state, keyboard/focus behavior, and accessible names;
- loading, empty, error, stale, and offline states that the surface represents.

Tooling gaps must be stated as **unverified**, not converted into a pass.

## Official sources

- [Human Interface Guidelines: Maps](https://developer.apple.com/design/human-interface-guidelines/maps/)
- [Human Interface Guidelines: Sheets](https://developer.apple.com/design/human-interface-guidelines/sheets/)
- [Human Interface Guidelines: Layout](https://developer.apple.com/design/human-interface-guidelines/layout)
- [Human Interface Guidelines: Color](https://developer.apple.com/design/human-interface-guidelines/color)
- [Human Interface Guidelines: Icons](https://developer.apple.com/design/human-interface-guidelines/icons)
- [Human Interface Guidelines: Buttons](https://developer.apple.com/design/human-interface-guidelines/buttons)
- [Human Interface Guidelines: Accessibility](https://developer.apple.com/design/human-interface-guidelines/accessibility)
- [MapKit: UserAnnotation](https://developer.apple.com/documentation/mapkit/userannotation)
- [MapKit: MapUserLocationButton](https://developer.apple.com/documentation/mapkit/mapuserlocationbutton)
