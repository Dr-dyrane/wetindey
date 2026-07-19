# Apple Maps and Human Interface benchmark

**Retrieved:** 2026-07-18  
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

## Read-only current-code violation inventory (2026-07-18)

This is an evidence inventory, not an active implementation claim. Findings are based on
current source inspection and the paired reused-tab runtime; future ownership is sequenced
below and remains unallocated until PM records exact locks.

| Finding | Current evidence | Smallest future lane and acceptance evidence |
|---|---|---|
| Compact/regular surface behavior is split across a page-local tree and shared shell geometry. | `src/app/page.tsx:1058-1148` owns the sheet header, hit regions, and level-0 scroller; `src/design-system/components/BottomSheet.tsx:1107-1152` owns transformed detents and rounded floating/docked presentation; `src/design-system/components/RegularShell.tsx:91-108` owns the regular island. | **Sheet hierarchy evidence gate:** no implementation path is claimed. `page.tsx`, `BottomSheet.tsx`, `RegularShell.tsx`, `CompactShell.tsx`, and `AdaptiveShell.tsx` remain read-only evidence while their retained Maps/Frameworks/Market Details ownership locks are active; prove peek/half map context, edge-to-edge large docking, no duplicate surfaces, and AX/pixel order only after an explicit handoff. |
| Outer targets are 44px while visible chrome is 32px; press feedback is utility-class based and not independently evidenced for every control. | `page.tsx:1066-1077`, `1084-1108`; `MapboxCanvas.tsx:512-529`. | **Interaction evidence gate:** no implementation path is claimed. Prove edge hits, keyboard focus, visible press/release, and reduced-motion behavior against the single Sheet hierarchy lane without creating a second owner for `page.tsx`. |
| The BottomSheet detent handle is a real hit-region defect, not an evidence gap. | `src/design-system/components/BottomSheet.tsx:1142-1148` renders a button with `pt-2.5 pb-1.5` around a `h-[5px]` bar (about 21px tall) and no `min-h-tap`; this is below the 44×44 CSS px contract. | **Sequenced future Sheet owner:** the retained Frameworks owner must receive an exact PM handoff before implementation. Acceptance must measure a ≥44×44 CSS px drag/keyboard target while the visible bar remains slim. |
| Unnecessary nested containment may remain in offer/list surfaces; semantically distinct status badges are not blanket rewrite targets, and imagery edge bleed/blending is runtime-unverified. | `src/design-system/components/PlaceOfferRow.tsx:69-116` uses a fixed `w-[88px]`, `min-h-[104px]`, `object-cover` frame; `:152-213` nests an article, artwork frame, and status badge; `StatusBadge.tsx:67-69` emits a semantically distinct pill; attribution is separate at `PlaceOfferRow.tsx:210-213`. The fixed frame alone does not prove an edge-bleed defect. | **Sequenced future Offer hierarchy + imagery owner:** one combined owner for `PlaceOfferRow.tsx` and `StatusBadge.tsx` only after PM handoff. Prove which containment is unnecessary while preserving ADR-018 status meaning; directly verify edge bleed/blending, readable attribution, source-link focusability, and no narrow collision. No blanket `StatusBadge` rewrite. |
| Avatar semantics distinguish image, initials, and anonymous silhouette in source, but the uploaded image is hidden from AX. | `src/app/page.tsx:1097-1108` renders a 44px Profile target with `Avatar` size 32; `src/app/_components/ProfileSheet.tsx:779-809` falls from image to initials to silhouette, while the visual span at `:789` is `aria-hidden`. | **Identity evidence gate:** no implementation path is claimed. `ProfileSheet.tsx`, its page callsite, and the retained Maps self-marker are read-only evidence while current Profile/Maps ownership and wiring locks remain active. Prove signed-in uploaded avatar, missing/failed-image initials, guest fallback, separate precision/halo, truthful AX names, and no peer publication after an explicit handoff. |
| Recenter placement consumes the live shell inset in source, but full drag/detent proof remains a paired Maps+HI gate. | `page.tsx:1031-1054` positions the control from `--shell-bottom-inset`; `AdaptiveShell.tsx:104-142` publishes shell geometry; `MapboxCanvas.tsx:151-184` retains camera-padding approximations. | **Maps runtime evidence gate:** no new implementation path is claimed here. `page.tsx` remains retained Maps ownership and `MapboxCanvas.tsx`/`MapboxAdapter.ts` remain the separate dark-style recovery claim in `LANES.md`; prove visibility/reachability through drag, peek, half, and large detents, marker selection, safe area, and AX names before any fresh path claim. |
| The regular-panel blank is a separate settled Safari/material diagnosis, not a transition-frame assumption. | In the paired reused-tab run, immediate and settled JPEGs were byte-identical about 10 seconds apart: DOM markers/chrome remained present while Mapbox pixels and the regular panel were black. | **Regular-panel diagnosis lane:** pathless HI/Frameworks evidence only, as reserved in `LANES.md`. Classify this as a settled Safari render/compositor failure rather than a transient capture; do not edit Maps dark-style paths or claim a UI fix from this artifact alone. |
| Reduced-motion and forced-colors hooks exist, but this run did not exercise those modes. | `src/app/globals.css:769-813` and `src/design-system/motion.ts:224-247` define reduced-motion/transparency and forced-colors behavior. | **Accessibility evidence lane:** no implementation path is implied. Capture direct reduced-motion, grayscale, and forced-colors evidence when tooling supports it; otherwise record each as unverified. |

The claims below are sequenced future proposals, not active implementation claims. PM must
allocate exact locks before any proposal is called disjoint or implementation-ready; each
path has one proposed owner in that sequence. The pathless regular-panel diagnosis cannot
be used to bypass active Presence, Contribution, migration, Frameworks, Market Details, or
retained Maps ownership locks.

| Sequence | One proposed owner | Exact future paths | Release condition |
|---|---|---|---|
| 1 | Frameworks / Sheet hierarchy | `src/design-system/components/BottomSheet.tsx`, `RegularShell.tsx`, `CompactShell.tsx`, `AdaptiveShell.tsx` | PM records a fresh exact lock; current and committed LANES ownership remains authoritative until then. |
| 2 | Market Details / Offer hierarchy + imagery | `src/design-system/components/PlaceOfferRow.tsx`, `src/design-system/components/StatusBadge.tsx` | One atomic handoff after the retained Market Details claim releases; no split imagery/status claim. |
| 3 | Identity | `src/app/_components/ProfileSheet.tsx` | PM allocates an exact identity handoff after current profile wiring locks clear. |
| 4 | Maps retained owner | `src/app/page.tsx` | No HI claim; Maps/Market Details retains this path until an explicit controller release. |
| 5 | Maps dark-style recovery | `src/design-system/components/MapboxCanvas.tsx`, `src/integrations/maps/MapboxAdapter.ts` | Existing LANES dark-style claim remains separate; no HI edits. |
| 6 | HI/Frameworks diagnosis | *(pathless)* | Direct reused-tab evidence only; no source ownership. |

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
