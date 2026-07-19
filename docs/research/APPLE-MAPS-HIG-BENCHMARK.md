# Apple Maps and Human Interface benchmark

**Retrieved:** 2026-07-18  
**Scope:** WetinDey map, sheet, marker, control, and place-detail acceptance criteria.

WetinDey adopts Apple interaction principles where they improve clarity, reachability, and
accessibility. It does **not** copy Apple assets, proprietary components, visual trade
dress, or product-specific styling.

## Adaptation matrix

| Official principle | WetinDey adaptation | Acceptance evidence |
|---|---|---|
| Preserve map context when presenting place information. | Keep the selected location visible while a place card or sheet is shown. Compact cards must avoid repeating facts already expressed by the map or adjacent controls. | Reused-tab compact and regular evidence shows the selected marker and relevant map context remain visible through open, selection, push, pop, and reopen. |
| Sheets, controls, and content respect layout guides and safe areas. | Position recenter/current-location and other map controls from the **live sheet inset**, not a guessed detent. Controls float above the map with sufficient contrast and elevation. | Exercise every live detent and safe-area configuration. The control remains visible, unobscured, and reachable without covering essential map content. |
| User location is a distinct, customizable annotation. | Render self identity as an uploaded avatar or local fallback. Render location accuracy separately as a bounded halo/overlay; never blur identity into an accuracy treatment. Guest identity remains local and is never published to peers. | Signed-in, fallback, guest, precise, and approximate states are independently visible and truthfully labelled. No external avatar-generator request or peer publication occurs. |
| Location controls are map-scoped and independently operable. | Treat recenter/current-location as a standalone map control that remains available at every sheet detent. | At compact and regular sizes, each detent preserves a visible control, truthful accessible name, press feedback, and successful activation. |
| Interactive controls need adequate size, feedback, and separation. | Provide at least a 44×44 pt hit region, a perceivable press state, and enough separation to prevent accidental activation. | Pointer edge-hit and keyboard/focus checks confirm the full target, visible feedback, focus indication, and nonoverlap. |
| Color and icons communicate consistent meaning without relying on color alone. | Combine stable icons with semantic families: confirmed/available, unavailable, caution/stale, and genuinely unknown. Preserve explicit text or another noncolor signal. | Light, dark, grayscale, and forced-colors evidence keeps types and states distinguishable; accessible names remain truthful. |
| Place cards and lists stay compact and scannable. | Let imagery carry hierarchy, keep item/variant and price/unit concise, retain essential availability/freshness/provenance, and remove redundant explanatory copy. | Compact and regular evidence shows readable facts, no collisions, 44×44 actions, logical accessibility order, and working attribution/source links. |
| Responsive layouts preserve behavior rather than merely fitting pixels. | Compact and regular layouts may redistribute space, but must preserve selection context, control reachability, information order, and interaction semantics. | Use one reused tab across compact/regular and light/dark transitions. Verify grayscale, detent changes, push/pop/reopen, loading/empty/error states where represented, and absence of stale state or document-scroll escape. |

## Required runtime evidence

A Maps or Human Interface lane is not visually complete from static inspection alone.
Record reused-tab evidence for:

- compact and regular layouts;
- light, dark, and grayscale presentation;
- forced-colors behavior where tooling supports it;
- every live sheet detent and safe-area inset;
- selected place visibility and map-control reachability;
- self identity, fallback, and separate accuracy states;
- 44×44 targets, press state, keyboard/focus behavior, and accessible names;
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
