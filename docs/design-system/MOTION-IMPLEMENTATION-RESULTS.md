# Motion Implementation Results — 2026-07-17

**Status:** implemented within the Motion System Implementation lane; not yet device-performance certified.

This document records what was changed, what was actually verified, and what remains outside the lane. It does not infer a native feel from static inspection or a successful compiler run.

## 1. Baseline audit

The pre-change static audit is in [MOTION-IMPLEMENTATION-BASELINE.md](./MOTION-IMPLEMENTATION-BASELINE.md). It identified per-pointer React updates, layout-affecting sheet settlement, nested modal sheets, competing Escape owners, missing Tab containment, and token drift.

Browser automation could not attach in this environment: both available bindings failed before connection with `Cannot redefine property: process`. No frame trace, forced-layout trace, real-device recording, or before/after frame timing was captured. The baseline and results distinguish source evidence from measured evidence for that reason.

## 2. Files changed

| Area                      | Files                                                                      | Result                                                                                                                                     |
| ------------------------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Shared token source       | `src/design-system/motion.ts`, `src/app/globals.css`, `tailwind.config.ts` | Typed durations, curves, springs, physics, visual/depth tokens, CSS variables, Tailwind mappings, and semantic transition recipes          |
| Direct-manipulation sheet | `src/design-system/components/BottomSheet.tsx`                             | Three-detent state machine, RAF-owned drag writes, bounded snap selection, interruption recovery, scroll handoff, viewport resize handling |
| Presentation host         | `src/design-system/components/ModalSheet.tsx`, `SheetPicker.tsx`           | One active keyboard/focus owner, presence exit, contextual child push instead of a nested modal                                            |
| High-frequency adoption   | `NavigationStack.tsx`, `Button.tsx`, `ItemCard.tsx`, `SearchField.tsx`     | Shared `transition.*` recipes instead of private transition declarations/press scales                                                      |
| Contract checks           | `scripts/motion-contracts.test.ts`                                         | Pure physics tests plus source-contract safeguards                                                                                         |

## 3. Token implementation

`motion.ts` is the typed source for `motion.duration`, `motion.ease`, `motion.spring`, `motion.sheet`, `motion.opacity`, `motion.scale`, `motion.blur`, `motion.elevation`, `motion.radius`, `motion.border`, and `motion.origin`.

Components now consume the semantic vocabulary `transition.press`, `transition.focus`, `transition.reveal`, `transition.presentSheet`, `transition.dismissSheet`, `transition.snapSheet`, `transition.push`, `transition.replace`, `transition.feedback`, and `transition.directManipulation`. The CSS surface supplies the matching `--motion-*` variables, including reduced-motion and reduced-transparency overrides. Tailwind duration/easing utilities resolve through those variables rather than literal milliseconds.

No compatibility alias was retained: live lane components consume `transition` directly, so new motion work has one semantic vocabulary.

## 4. Bottom-sheet state machine

The sheet has one committed detent (`peek`, `medium`, or `large`) and one temporary direct-manipulation state:

1. Pointer movement crosses a small claim threshold; scrolling content keeps ownership unless it is at its top boundary.
2. The sheet samples its _computed_ transform, freezes that composited position, and writes transform/backdrop opacity once per `requestAnimationFrame`. It does not call React state setters for pointer frames.
3. Release projects the normalized velocity, clamps it, decays any stale sample, requires the shared 900px/s flick threshold before carrying it forward, selects the closest destination, and restricts movement to one detent from the gesture start. Cancellation uses displacement only.
4. The next animation frame restores the snap transition and writes the final transform, including when the selected detent equals the previous prop. This prevents both a stuck inline transform and an interruption jump to a prior transition endpoint.

The hot drag path changes only compositor-friendly transform and opacity. The sheet retains one 10px island geometry and corner radius at every detent, so transform owns the entire visible settle rather than an abrupt `left`/`right`/`bottom` geometry change. It does not transition dimensions, blur, or shadows. `will-change: transform` is active only while a drag is claimed.

Viewport measurement uses `visualViewport.height` when available, so virtual-keyboard and browser-chrome resizing recalculates the transform distance. The map synchronization and camera side of this contract belongs to the active map-cartography lane and was not changed.

## 5. Presentation host and contextual child navigation

`ModalSheet` portals one surface with one backdrop, uses a presentation stack to determine the sole active keyboard/focus owner, holds itself through exit, traps Tab, and restores focus on close. It owns a contextual child screen API.

`SheetPicker` uses that API when inside a modal: it pushes its choices within the existing shell instead of mounting a second `ModalSheet`. Visible Back, Escape, and backdrop dismissal all return from a child screen before asking the parent modal to close. A child history entry is added for browser Back and removed for visible Back, selection, direct parent close, and external root close.

The host supports child-step browser history only. Root-modal history, page navigation/deep-link hydration, selection/category/filter persistence, and generic unsaved-form confirmation need the auth/page lane because their live state is owned by `src/app/page.tsx` and its profile surfaces.

## 6. Accessibility results

- Modal focus starts at `[data-autofocus]` when supplied, otherwise at the first focusable control; Tab and Shift+Tab remain inside the active modal.
- Only the top presentation registers the document Escape handler; non-top surfaces do not respond to Escape.
- Close controls have accessible labels and retain at least the existing tap-target sizing.
- The parent modal content becomes inert while a contextual child screen is visible.
- Reduced motion removes press scaling, removes modal translation/scale, shortens semantic durations, and ignores fling velocity when resolving a sheet release.
- Reduced transparency collapses the motion backdrop blur to an opaque-material path.

These are source-level checks. Screen-reader and keyboard behavior still require manual Safari/Chrome and assistive-technology verification.

## 7. Performance evidence

### Verified from source and contract checks

- There is no `setDragFraction` or other per-pointer React drag state update in `BottomSheet`.
- A single RAF loop owns direct sheet transform/backdrop writes.
- The direct-manipulation recipe disables competing CSS transitions.
- No permanent `will-change` was introduced.
- The lane does not animate layout properties during an active drag.

### Not measured

No real-device or browser performance trace could be collected because browser automation failed before it attached. Consequently, there are no claims for FPS, 120 Hz cadence, long tasks, forced layouts, paint cost, low-end Android behavior, or battery impact. These must be measured in a follow-up pass with a working browser/device connection.

## 8. Tests and checks run

- `npx tsx scripts/motion-contracts.test.ts` — detents, projection, one-detent cap, cancellation, rendered-position interruption model, resistance, semantic recipe mapping, single Escape owner, contextual picker routing, drag RAF contract, scroll/viewport contract, reduced motion, and reduced transparency.
- `npm run typecheck` — TypeScript check.
- `npm run lint` — exits successfully but reports pre-existing warnings in auth-owned files outside this lane.
- `npm run build` — compiles production routes; this is compilation evidence only, not interaction evidence.
- `npm run audit:tokens` — remains blocked by pre-existing auth-owned token violations in `ManageProfileSheet.tsx`; they were not changed here.
- A local development server returned `200` for `/`; no browser interaction was inferred from that response.

## 9. Remaining risks and intentionally unimplemented scope

1. No device/frame trace exists yet, so gesture feel and performance thresholds are unverified.
2. Root modal/navigation history, deep-link hydration, and persistent page state must be integrated where that state is actually owned; this lane only adds child-step history within a modal.
3. Modal swipe-to-dismiss and generic unsaved-data confirmation are not wired because no live owner supplies an unsaved-state contract in this lane.
4. Map camera/marker motion and map/sheet synchronization remain with map cartography; the map was deliberately not edited.
5. `page.tsx` still contains unrelated private motion declarations and owns category/filter/search state; it requires its owner to adopt the shared vocabulary.
6. The contract script is intentionally dependency-free and cannot substitute for DOM, assistive-technology, or touch-device integration tests.
7. Keeping the large detent in the same 10px island chrome eliminates a layout jump, but this visual decision needs product acceptance on real devices; it intentionally avoids silently reintroducing layout animation.

## 10. Recommended follow-up lanes

1. **Auth/page integration:** connect root modal and navigation history, deep-link hydration, unsaved-form protection, category/filter state preservation, and remaining page-level motion declarations.
2. **Map cartography:** map `motion` tokens into Mapbox camera/marker transitions, then measure map/sheet synchronization under touch.
3. **Device verification:** record Safari iOS PWA, Chrome Android PWA, desktop trackpad/mouse, keyboard, reduced-motion, and reduced-transparency traces; set calibrated flick/settling values from evidence.
4. **Integration testing:** add a repository-approved DOM/browser test runner and cover focus restoration, browser Back, keyboard resize, scroll handoff, modal dismissal protection, and state preservation end to end.
