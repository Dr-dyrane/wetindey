# Motion Implementation Baseline — 2026-07-17

**Scope:** live motion paths controlled by the motion-system implementation lane. This is a baseline audit, not a claim that the application was driven successfully.

## Environment and measurement status

- Local Next.js development server started successfully at `http://localhost:3000`.
- Browser automation could not attach: both available local browser bindings failed before connection with `Cannot redefine property: process`. No browser frame trace, real-device trace, screenshot, or gesture measurement is being represented as captured.
- This baseline therefore records static evidence from the checked-out source. Any before/after frame-time claim remains pending a working browser connection and real-device pass.

## Current token surface

| Category             | Current values                                                                          | Evidence                                                        |
| -------------------- | --------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| Duration             | `100ms`, `160ms`, `230ms`, `330ms`, `400ms`                                             | `tailwind.config.ts`                                            |
| Easing               | decelerate, accelerate, `cubic-bezier(0.32, 0.72, 0, 1)`                                | `tailwind.config.ts`                                            |
| Sheet geometry       | `peek=20vh`, `medium=52vh`, `large=94vh`; `28px` radius                                 | `BottomSheet.tsx`                                               |
| Sheet physics        | `64px` step, `16px` re-arm, `150ms` velocity projection, `0.18` out-of-range resistance | `BottomSheet.tsx`                                               |
| Press scale          | `.97`, `.985`, `.99`, `.90`, `.98` across components                                    | `Button`, `ItemCard`, `SheetPicker`, `page.tsx`, `MapboxCanvas` |
| Reduced motion       | Global `0.01ms` duration override                                                       | `globals.css`                                                   |
| Reduced transparency | Material blur disabled, opaque surface used                                             | `globals.css`                                                   |

## Baseline findings

### P0 — interaction/accessibility defects

1. `SheetPicker` mounts a `ModalSheet` inside another `ModalSheet`. This violates the approved one-presentation-shell contract.
2. Every open `ModalSheet` adds its own `document` Escape listener. Nested sheets receive the same Escape, so the parent can close with the child.
3. `ModalSheet` moves focus but does not trap Tab. Its effect depends on an `onClose` callback that may change on parent render, causing focus to restore and re-enter while a controlled input is being typed.
4. `ModalSheet` unmounts immediately when `open` becomes false: it has entry-only animation and no exit presence.

### P1 — performance and ownership defects

1. `BottomSheet` calls `setDragFraction` for every pointer move. This re-renders the sheet component and reconciles its children on the active drag path.
2. Live drag changes `transform`, backdrop opacity, and bottom radius. The radius is paint-affecting; detent settlement also transitions `left`, `right`, and `bottom`, which are layout-affecting.
3. The sheet uses conditional `will-change: transform` only during drag, which is good; however the current state-driven drag path still owns the render loop.
4. Map padding (`300ms`) and sheet settlement (`330ms`) are related but use private raw values in different files. Map integration is owned by the cartography lane and is not modified here.

### P2 — vocabulary drift

1. The approved token proposal uses `80/120/160/230/320/420ms`; live Tailwind aliases are `100/160/230/330/400ms`.
2. `page.tsx` contains `transition-all` and several ad-hoc press scales, but it is owned by the auth lane.
3. `MapboxAdapter.ts` has raw camera durations and marker transforms, but it is owned by map cartography.
4. Live high-frequency components use independent `active:scale` values instead of a shared semantic press rule.

## Baseline acceptance probes

These are the checks the implementation must make testable or driveable:

- Detent selection, projection, one-detent maximum, cancellation, and scroll handoff.
- No React state update per pointer frame in `BottomSheet`.
- One active Escape/focus owner and Tab containment for a modal.
- A `SheetPicker` child view that pushes within its parent presentation shell.
- Explicit reduced-motion and reduced-transparency behavior for changed components.
- No `transition-all` introduced by this lane; no permanent `will-change` introduced by this lane.

## Lane boundary handoffs

- **auth lane:** `src/app/page.tsx`, `package.json`, `package-lock.json`. Required for global modal history, the lone `transition-all`, and any test-runner configuration.
- **map cartography lane:** `src/integrations/maps/MapboxAdapter.ts`, `src/design-system/components/MapboxCanvas.tsx`. Required for semantic camera tokens, marker adoption, and measured map/sheet synchronization.
- **this lane:** shared token implementation, bottom sheet, modal shell, picker, navigation stack, high-frequency design-system controls, CSS/Tailwind surface, pure TypeScript contract tests, and implementation results.
