# WetinDey Motion & Interaction System

**Status:** Proposed production specification
**Scope:** Research, design tokens, interaction contracts, and implementation guidance
**Non-goal:** This document does not implement or redesign animations.

## 1. Executive decision

WetinDey should use a small, composable motion language built around four ideas:

1. Direct manipulation follows the pointer or finger without a competing transition.
2. Settling uses one monotonic, spring-like curve unless a real spring is needed for a gesture handoff.
3. Hierarchy is communicated by source, destination, and depth; motion is never decoration.
4. Every meaningful transition has a reduced-motion equivalent and a non-animated state fallback.

The browser implementation should prefer CSS transitions for ordinary state changes, Pointer Events plus `requestAnimationFrame` for direct manipulation, and a single motion adapter for spring physics. Components must consume semantic tokens such as `motion.sheet.present` and `interaction.sheet.snap`, never private millisecond values.

This is a web-first adaptation of platform conventions, not an attempt to imitate undocumented Apple implementation details. Apple publishes the behavior and intent of motion, but not a universal “iOS duration” or “Apple Maps spring” that can be copied.

[ADR-026](../adr/026-liquid-glass-sheet-material-system.md) is the accepted sheet-material
architecture. This document supplies its motion and performance contract; implementation
remains separately evidenced. Opaque sheet slabs are fallback-only, and normal sheets use
one named translucent material with one blur owner.

**Reading status:** “must” and “should” below describe the target system. Section 13 records where current code does not yet meet that target. No current behavior is considered verified merely because a token or rule appears in this document.

## 2. Research basis

Primary sources:

- [Apple HIG: Motion](https://developer.apple.com/design/human-interface-guidelines/motion) — purposeful, brief, realistic, cancelable motion; motion should not be the only communication channel.
- [Apple HIG: Sheets](https://developer.apple.com/design/human-interface-guidelines/sheets) — scoped tasks, detents, one sheet at a time, and a clear dismissal path.
- [Apple HIG: Modality](https://developer.apple.com/design/human-interface-guidelines/modality) — use modality for focus, keep tasks simple, avoid stacked modal experiences.
- [Apple HIG: Accessibility](https://developer.apple.com/design/human-interface-guidelines/accessibility) — simple gestures, alternatives to gestures, keyboard and assistive-technology access.
- [Apple Reduced Motion evaluation criteria](https://developer.apple.com/help/app-store-connect/manage-app-accessibility/reduced-motion-evaluation-criteria) — replace scaling, depth, blur, and axis movement with fades or state changes where appropriate.
- [UIKit `UISheetPresentationController`](https://developer.apple.com/documentation/uikit/uisheetpresentationcontroller) — detents, undimmed detents, scroll-to-expand behavior, grabbers, preferred radius, and animated property changes.
- [UIKit spring timing](https://developer.apple.com/documentation/uikit/uiview/animate%28withduration%3Adelay%3Ausingspringwithdamping%3Ainitialspringvelocity%3Aoptions%3Acompletion%3A) and [initial velocity](https://developer.apple.com/documentation/uikit/uispringtimingparameters/initialvelocity) — velocity should carry across a gesture-to-settle handoff.
- [MDN: CSS performance](https://developer.mozilla.org/en-US/docs/Learn_web_development/Extensions/Performance/CSS) and [`prefers-reduced-motion`](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/%40media/prefers-reduced-motion).
- [web.dev: Animations and performance](https://web.dev/articles/animations-and-performance) — prefer compositor-friendly properties and use `will-change` narrowly.
- [Material motion guidance](https://m3.material.io/styles/motion/overview) — a useful cross-platform comparison for duration, easing, and spatial hierarchy; it is not a WetinDey token source.

The comparison below is based on public guidance plus observable product behavior. It does not claim access to private implementation code in Apple Maps, Apple Music, Wallet, Find My, Safari, Shortcuts, Google Maps, Uber, Airbnb, Linear, Arc, Notion, or Raycast.

| Product/system | Useful pattern | Adapt for WetinDey | Do not copy |
|---|---|---|---|
| Apple Maps / Find My | Persistent context, map remains the reference frame, sheet detents, selection-to-detail continuity | Keep the map mounted; move a fixed sheet; synchronize selected place, sheet depth, and map camera | Full-screen camera choreography or unbounded map travel |
| Apple Music / Wallet | Strong object identity, concise confirmation, depth reserved for hierarchy | Preserve card identity between list/detail; use brief success state and clear return path | Decorative celebration on frequent actions |
| Safari / Shortcuts | Contextual navigation, predictable back behavior, progressive disclosure | Push within one navigation stack; use sheets for scoped choices; preserve browser history | Nested modal stacks that hide the route back |
| Google Maps | Gesture-first map, marker selection, bottom-sheet context | Let map pan/zoom remain native to Mapbox; use one arbitration rule for map vs sheet gestures | Simultaneous independent animations fighting for the same gesture |
| Uber / Airbnb | High-signal action surfaces, staged disclosure, task-focused overlays | Reserve motion for search, selection, and decision moments | Long onboarding-style transitions in a utility flow |
| Linear / Arc / Notion / Raycast | Fast keyboard/pointer feedback, restrained opacity and scale, continuity of focus | Give desktop input a fast visual response and preserve focus across updates | Mobile physics applied to every desktop hover |

## 3. Motion philosophy

### Principles

- **Motion should explain.** A sheet rises because a scoped task is entering the current context; a row fades because content changed. If the reason cannot be described, remove the motion.
- **Motion should never surprise.** Enter and exit directions must agree with the relationship between source and destination. A sheet dismissed downward should not appear to leave sideways.
- **Objects preserve identity.** A selected item, place, marker, or card should remain recognizably the same object as it changes scale, position, or container.
- **Elements move toward purpose.** Motion should lead attention to the next decision: result, filter, confirmation, retry, or return.
- **Hierarchy is spatial.** Use containment, depth, scrim, and focus before adding more duration or bounce.
- **Physics is believable, not literal.** A released sheet may carry velocity into its target, but it must settle once, quickly, and without ornamental oscillation.
- **Frequent actions are quiet.** Tap, focus, selection, and list refresh happen often; use color, opacity, and a small press response rather than a full transition.
- **Interruptions are first-class.** A new tap, drag, route change, or data update may interrupt motion. The current visual state becomes the next animation’s origin.
- **The interface is calm under load.** Loading and offline states communicate progress without pulsing the entire screen or moving content unnecessarily.

## 4. Token contract

Tokens are normative names. Values are starting points for calibration, not claims that Apple publishes these numbers.

### Timing and duration tokens

| Token | Value | Use |
|---|---:|---|
| `motion.duration.instant` | `80ms` | Press/focus color response; no travel |
| `motion.duration.ultraFast` | `120ms` | Small icon, badge, or selection change |
| `motion.duration.fast` | `160ms` | Button/card feedback, opacity, hover |
| `motion.duration.standard` | `230ms` | Local reveal, filter, toast, list state |
| `motion.duration.slow` | `320ms` | Modal/sheet opacity and non-gesture entry |
| `motion.duration.deliberate` | `420ms` | Navigation with meaningful hierarchy change |
| `motion.duration.continuous` | `0ms` | Direct manipulation; gesture owns the position |

The current codebase is close but not identical: `duration-instant=100ms`, `duration-micro=160ms`, `duration-standard=230ms`, `duration-sheet=330ms`, and `duration-map=400ms`. These are migration inputs, not aliases with equivalent values. New code should use semantic component tokens; a future migration may preserve these values or adopt the proposed values after device calibration.

### Easing tokens

| Token | CSS value | Use |
|---|---|---|
| `motion.ease.decelerate` | `cubic-bezier(0, 0, 0.2, 1)` | Entering content, settling toward a destination |
| `motion.ease.accelerate` | `cubic-bezier(0.4, 0, 1, 1)` | Exiting content; use sparingly |
| `motion.ease.standard` | `cubic-bezier(0.2, 0, 0, 1)` | Local state changes |
| `motion.ease.emphasized` | `cubic-bezier(0.32, 0.72, 0, 1)` | Sheet and navigation settling; monotonic, no overshoot |
| `motion.ease.inOut` | `cubic-bezier(0.4, 0, 0.2, 1)` | Reversible, symmetric local changes |
| `motion.ease.linear` | `linear` | Progress indicators and continuous interpolation only |

### Spring presets

Use these with a spring-capable adapter; CSS `cubic-bezier` is the default fallback. Values are normalized design parameters, not UIKit values.

| Preset | Stiffness | Damping | Mass | Bounce | Settling target | Use |
|---|---:|---:|---:|---:|---:|---|
| `spring.gentle` | 260 | 30 | 1 | 0 | ≤500ms | Large sheet movement, low urgency |
| `spring.standard` | 420 | 34 | 1 | 0 | ≤380ms | Default snap and navigation |
| `spring.responsive` | 560 | 38 | 1 | 0 | ≤300ms | Small controls and marker selection |
| `spring.snappy` | 700 | 44 | 1 | 0 | ≤240ms | Toggle, selection, compact feedback |
| `spring.heavy` | 360 | 42 | 1.2 | 0 | ≤460ms | Large modal or high-depth surface |

Rules: default `bounce=0`; permit at most `0.04` for a deliberately physical, non-critical control; never bounce a full-screen surface, keyboard-avoiding surface, map camera, or error state. Carry release velocity into the spring; clamp it to a component-specific maximum so a fast flick cannot launch content through several states.

### Visual physics tokens

| Token | Starting value | Contract |
|---|---:|---|
| `motion.scale.press` | `0.985` | Press feedback only; restore on release/cancel |
| `motion.scale.modalStart` | `0.98` | Optional small modal depth cue; replace with fade under reduced motion |
| `motion.opacity.scrim` | `0.28` | Medium-to-large sheet dimming; do not stack alpha-bearing scrims |
| `motion.opacity.disabled` | `0.4` | Disabled state; also use semantic disabled affordance |
| `motion.blur.backdrop` | `8px` | `backdrop-blur-sm` for the single sheet host; the former 12px baseline is superseded by ADR-026 |
| `motion.blur.reduced` | `0px` | Reduced transparency/motion fallback |
| `motion.border.transition` | `none` | WetinDey uses surface contrast and elevation; do not animate hairlines |
| `motion.elevation.card` | `var(--shadow-card)` | Resting card |
| `motion.elevation.raised` | `var(--shadow-raised)` | Focused/selected/floating control |
| `motion.elevation.sheet` | `var(--shadow-sheet)` | Sheet over map |
| `motion.elevation.island` | `var(--shadow-island)` | Floating desktop surface |
| `motion.radius.sheet` | `28px` | Existing sheet radius; interpolate only at rest |
| `motion.radius.control` | `14–16px` | Existing control family |
| `motion.origin.sheet` | `50% 100%` | Bottom entry/dismissal |
| `motion.origin.modal` | `50% 50%` | Centered modal depth cue |
| `motion.resistance.sheet` | `0.35` | Out-of-range drag follows 35% of input |
| `motion.elasticity.sheet` | `0.12` | Maximum visual overshoot as a fraction of viewport |
| `motion.inertia.sheet` | `projected position + clamped release velocity` | A release continues into one snap decision, then settles |
| `motion.overscroll.sheet` | `contain` | Prevent sheet/list gesture leakage into the document |
| `motion.safeArea.bottom` | `max(env(safe-area-inset-bottom), 0px)` | Keep controls and sheet content above the home indicator |
| `motion.velocity.flick` | `900px/s` | Candidate fast-flick threshold; calibrate on device |
| `motion.velocity.max` | `2400px/s` | Clamp handoff velocity |

### Liquid Glass sheet materials (ADR-026)

The sheet host chooses one named material; descendants never add another blur or glass
slab. These are target ranges for light/dark calibration, not per-component inventions:

| Token | Surface | Fill alpha | Material rule |
|---|---|---:|---|
| `material.contextIsland` | Compact peek/half context island | ~58–64% | `backdrop-blur-sm` (~8px), restrained/no saturation |
| `material.denseGlass` | Docked/modal decision surface | ~70–82% | `backdrop-blur-sm` (~8px), restrained/no saturation |
| `material.expandedGlass` | Expanded edge-to-edge sheet | ~70–82% | Remains translucent in normal modes; no opaque slab |
| `material.opaqueFallback` | Reduced-transparency/forced-colors accessibility fallback | 100% | No blur; system/opaque colors |

`backdrop-filter: blur(8px)` belongs to the single visible sheet host and never filters
sheet content. `filter: blur()` on text, controls, cards, map tiles, or the sheet subtree
is prohibited. Do not animate blur, saturation, fill alpha, edge light, elevation, or
borders; sheet entry, dismissal, detents, and scrim animate only `transform` and `opacity`.
Use a subtle inset edge light and an existing elevation rung without a decorative hairline.
Cards, pills, inputs, badges, and controls remain ordinary neutral surfaces, not nested
glass slabs.

When `prefers-reduced-transparency: reduce` or forced colors applies, select
`material.opaqueFallback` immediately. Unsupported backdrop filtering or measured
accessibility/performance failure blocks acceptance rather than widening the opaque
exception. Under reduced motion, keep material static and replace travel/depth with a
short opacity change or immediate state update. Fallback selection is not animated.

## 5. Interaction tokens

### Sheet behavior

WetinDey’s compact shell already has `peek`, `medium`, and `large` detents. Keep that model and formalize it:

| Token | Recommendation |
|---|---|
| `interaction.sheet.detents` | `peek=20vh`, `medium=52vh`, `large=94vh`; preserve content-safe-area padding |
| `interaction.sheet.snapThreshold` | Nearest detent by projected position; a deliberate step is about one row / 64px |
| `interaction.sheet.flickThreshold` | Use velocity only with direction and intent; a calibrated release may skip one detent, never more than one. This is a WetinDey decision, not a documented iOS constant |
| `interaction.sheet.dragResistance` | Linear within range; 35% response beyond the first/last detent |
| `interaction.sheet.dismissThreshold` | Downward displacement ≥ one-third of travel or a fast downward release, subject to unsaved-data confirmation |
| `interaction.sheet.scrollHandoff` | At scroll top, downward drag belongs to the sheet; otherwise content scroll owns it |
| `interaction.sheet.interruption` | Cancel the current transition, sample the rendered transform, then start the next operation from that value and velocity |
| `interaction.sheet.backdrop` | Backdrop dismisses only when the sheet is modal; nonmodal medium/peek surfaces keep map interaction available where safe |
| `interaction.sheet.nested` | Do not nest sheet surfaces. Push a child step inside the same modal shell or dismiss the parent before presenting another |
| `interaction.sheet.stacked` | One visible modal sheet; alerts may temporarily sit above it, one at a time |
| `interaction.sheet.keyboard` | Move/resize the sheet to keep the focused field and submit action visible; never animate the map to compensate |
| `interaction.sheet.mapSync` | Map remains mounted; selected place and sheet detent share state; map camera movement is independently interruptible |

Apple’s published model supports detents, scroll-to-expand, grabbers, undimmed detents, and animated changes. The perceived smoothness of Apple Maps is an inference from observable continuity and published platform behavior, not a claim about private implementation. WetinDey should test velocity matching, compositor-friendly movement, synchronized map padding, and restrained visual change on real devices rather than treating any one as proven.

### Modal behavior

- Present from the bottom for a sheet relationship; use a centered surface only for a short, blocking confirmation or compact desktop dialog. The 768px responsive breakpoint is WetinDey design judgment, not an Apple HIG constant.
- Entry: `opacity 0→1` plus `translateY(8px)→0` for a sheet; optional `scale(.98)→1` for a centered modal.
- Exit: reverse the entry, usually 160–230ms. Do not make dismissal slower than presentation.
- Backdrop: animate opacity separately from panel movement; use one scrim owner and one focus trap.
- Click-away, Escape, close button, and swipe-down must all call the same dismissal path.
- Preserve form data on accidental interruption; confirm only when dismissal risks data loss.
- Target behavior is one visible modal shell: for a child choice, update that shell with a contextual push. The current `SheetPicker` can render a nested `ModalSheet`; this is an identified implementation gap, not evidence that the target contract is already live.

### Navigation behavior

| Action | Motion | State/history rule |
|---|---|---|
| Push detail | Content enters from logical forward direction, 230–320ms | Target: push a browser-history entry; preserve source scroll and selection |
| Back | Reverse push, 160–230ms | Target: `popstate` and visible back control share one state machine; current `NavigationStack` is local React presence |
| Replace/filter | Crossfade or short content dissolve, 120–230ms | Do not imply a new place in history for an in-place filter |
| Search focus | Field expands or gains surface contrast; 120–160ms | Keep keyboard focus; do not move the whole map unexpectedly |
| Category/filter sheet | Present as a scoped sheet; selection updates parent on commit | Cancel restores prior selection; apply is explicit when multi-select exists |
| Deep link | No theatrical route animation on first load | Hydrate directly into the destination state |

### Component interaction contracts

| Component | Rest | Press/focus | State change |
|---|---|---|---|
| Button | Stable fill and label | `opacity` or `scale.press`, 80–160ms; visible keyboard ring | Loading replaces label without changing width; success/error uses icon + text, not color alone |
| Card | No lift on touch devices | Desktop hover may raise one elevation rung; press uses small scale/opacity | Selection changes fill/elevation; avoid layout shift |
| Search | Stable field geometry | Focus changes surface and ring; suggestions appear below, not over the caret | Clear is instant; results crossfade only when the query changes materially |
| Marker | Stable position | Selected marker raises/changes scale within 120–230ms | Do not animate all markers on every query; cluster changes may dissolve |
| FAB/recenter | Resting island | Press scale/opacity; icon may rotate only when it communicates mode | Follow/recenter state uses icon + label/state, not spin decoration |
| Tabs/segmented control | One selected segment | Selection indicator translates or crossfades, 120–160ms | Preserve content position when possible |
| List insertion/deletion | Existing rows stay anchored | New row enters from list direction; deletion offers Undo | Never animate a whole list because one row changed |
| Toast/banner | Appears near the action, 230ms | No hover dependency | Persistent errors remain until acted on; success can dismiss after a generous interval |
| Skeleton/loading | Stable geometry, low-contrast pulse only where useful | No shimmer on large map surfaces by default | Replace in place; reserve height to prevent jumps |
| Offline/stale | Quiet banner or badge | Retry is an explicit action | Online recovery updates content in place and announces status |

### Background and depth tokens

Background atmosphere is a hierarchy, not a special effect. Use the existing WetinDey surfaces in this order: map canvas → page background → sheet material → card/control surface → raised island → modal scrim. ADR-026 permits one restrained/no-saturation `backdrop-blur-sm` (~8px) layer on the visible sheet host to preserve context; it must not turn the map into an unreadable texture. Do not add animated noise, film grain, decorative texture, nested blur, or content `filter: blur()`; the product’s map and data already provide sufficient visual information. Elevation transitions change only when hierarchy changes and should use the existing shadow rungs, never a new shadow per component.

### Gestures

- Tap: primary action; must have a keyboard and assistive-technology equivalent.
- Long press: only for discoverable secondary actions; never required for core food discovery.
- Drag: direct manipulation, `touch-action` scoped to the owning surface.
- Swipe-to-dismiss: only for sheets/cards with a visible alternate close action.
- Pinch/zoom/pan: Mapbox owns the map gesture; the sheet must not steal it while the map is active.
- Pull-to-refresh: require a meaningful travel threshold, show progress tied to displacement, and avoid competing with sheet collapse.
- Cancellation: pointer cancel, focus change, route change, or loss of capture ends the gesture safely and snaps from the current visual state.

## 6. State transitions

Use these semantic transitions consistently:

| From → to | Default treatment | Reduced-motion treatment |
|---|---|---|
| Loading → loaded | Replace in place; fade only changed region | Instant replace |
| Empty → populated | Stagger at most two groups, 120ms apart | Instant replace |
| Offline → online | Banner/status color change plus concise announcement | Color/text change |
| Stale → refreshed | Update values in place; highlight changed value briefly | Text/status change |
| Collapsed → expanded | Sheet detent spring/curve | Snap/fade |
| Inactive → active | Fill, opacity, or focus ring | Same visual state without movement |
| Error → recovered | Inline status exits after recovery; content stays anchored | Instant status replacement |
| Optimistic → confirmed | Keep object identity; replace pending affordance with confirmation | Same |
| Optimistic → failed | Preserve user input; show retry/undo | Same |

## 7. CSS variables and Tailwind mapping

The following is the recommended design-token surface for a future implementation. It is intentionally shown here as documentation; this task does not add it to `globals.css` or `tailwind.config.ts`.

```css
:root {
  --motion-duration-instant: 80ms;
  --motion-duration-ultra-fast: 120ms;
  --motion-duration-fast: 160ms;
  --motion-duration-standard: 230ms;
  --motion-duration-slow: 320ms;
  --motion-duration-deliberate: 420ms;
  --motion-ease-decelerate: cubic-bezier(0, 0, 0.2, 1);
  --motion-ease-accelerate: cubic-bezier(0.4, 0, 1, 1);
  --motion-ease-standard: cubic-bezier(0.2, 0, 0, 1);
  --motion-ease-emphasized: cubic-bezier(0.32, 0.72, 0, 1);
  --motion-scrim-opacity: 0.28;
  --motion-sheet-resistance: 0.35;
  --motion-sheet-radius: 28px;
  --motion-press-scale: 0.985;
}

@media (prefers-reduced-motion: reduce) {
  :root {
    --motion-duration-instant: 1ms;
    --motion-duration-ultra-fast: 1ms;
    --motion-duration-fast: 1ms;
    --motion-duration-standard: 1ms;
    --motion-duration-slow: 1ms;
    --motion-duration-deliberate: 1ms;
    --motion-press-scale: 1;
  }
}
```

Tailwind semantic names:

```ts
transitionDuration: {
  instant: "var(--motion-duration-instant)",
  ultraFast: "var(--motion-duration-ultra-fast)",
  fast: "var(--motion-duration-fast)",
  standard: "var(--motion-duration-standard)",
  slow: "var(--motion-duration-slow)",
  deliberate: "var(--motion-duration-deliberate)",
  continuous: "0ms",
},
transitionTimingFunction: {
  decelerate: "var(--motion-ease-decelerate)",
  accelerate: "var(--motion-ease-accelerate)",
  standard: "var(--motion-ease-standard)",
  emphasized: "var(--motion-ease-emphasized)",
},
```

Do not use `transition-all`. Name the properties being transitioned. Do not create a Tailwind utility for every component; semantic component recipes should map to these primitives.

## 8. Framer Motion recommendation

Framer Motion is not currently a repository dependency and should not be added for this documentation pass. If a future feature adopts it, use a single adapter and the following mapping:

```ts
const motionTokens = {
  transition: {
    instant: { duration: 0.08, ease: "easeOut" },
    fast: { duration: 0.16, ease: [0.2, 0, 0, 1] },
    standard: { duration: 0.23, ease: [0.2, 0, 0, 1] },
    sheet: { duration: 0.32, ease: [0.32, 0.72, 0, 1] },
  },
  spring: {
    standard: { type: "spring", stiffness: 420, damping: 34, mass: 1 },
    snappy: { type: "spring", stiffness: 700, damping: 44, mass: 1 },
  },
};
```

Every `motion` component must accept a reduced-motion policy, use `useReducedMotion()`, and keep layout animations opt-in. Never combine a library spring with a CSS transition on the same property. For the map and sheet drag, one owner must write the transform; Framer Motion must not compete with Mapbox or Pointer Events.

## 9. Accessibility and reduced motion

- Detect `prefers-reduced-motion: reduce` automatically; do not make users maintain a duplicate preference.
- Replace travel, scale, parallax, animated depth, animated blur, and large camera movement with a dissolve, highlight, color change, or immediate state update.
- Keep direct manipulation trackable, but reduce or remove post-release bounce.
- Never convey status only through motion, color, or a transient toast. Use text, ARIA live regions where appropriate, and persistent error/retry controls.
- Keep focus on the initiating control after a dismiss or on the first meaningful control after a presentation. Trap focus only inside a true modal.
- Support Escape, Enter/Space, browser Back, visible close controls, keyboard focus, screen-reader labels, and a non-gesture dismissal path.
- Respect `prefers-reduced-transparency` by removing backdrop blur and using an opaque surface.
- Do not auto-dismiss critical errors or destructive confirmations on a timer.
- Test touch, trackpad, mouse, keyboard, VoiceOver, TalkBack, zoom/text enlargement, high-contrast modes, and 120Hz displays.

## 10. Performance budget

Motion is successful only if it remains responsive on a mid-range Android device over a thin connection.

- Animate `transform` and `opacity` by default. Treat `height`, `width`, `top`, `left`, `padding`, font metrics, and content insertion as layout work requiring justification.
- The sheet should remain a fixed large-height surface and move with `transform` during live drag. The current implementation is mostly transform-driven during drag, but it also transitions `left`, `right`, `bottom`, and `border-radius` at rest; those layout/paint costs must be measured and are not described as purely composited.
- Use `will-change: transform, opacity` only shortly before a known interaction and remove it afterward. Do not apply it globally to every card or marker.
- Keep pointer handlers lightweight: read geometry once, write visual state once per animation frame, and avoid synchronous layout reads after writes.
- Do not animate blur, large box shadows, or thousands of markers continuously. Prefer a static material and a single scrim opacity transition.
- Avoid rerendering list contents on every sheet drag. Keep sheet position in a composited style path and keep data state separate.
- Budget one dominant motion per frame. Sheet movement and map-padding/camera movement are an approved synchronized exception when they express one relationship; they must share a tested timing contract and never compete for gesture ownership.
- Use `content-visibility: auto` or virtualization only after measuring; do not hide content needed by assistive technology.
- Prefer CSS animations/transitions for simple visual states; use JavaScript only when gesture position, interruption, or velocity is part of the behavior.
- Measure with Chrome DevTools Performance, Safari Web Inspector, and a real low-end Android. Verify no long task overlaps the gesture and that frames remain within the display budget (about 16.7ms at 60Hz and 8.3ms at 120Hz).
- Avoid continuous animation when the tab is hidden, the device is battery constrained, or the content is not visible.

## 11. Transition token recipes

These recipes are the public animation-token API engineers should choose before composing a new transition:

| Token | Properties | Duration/curve | Meaning |
|---|---|---|---|
| `transition.press` | `opacity`, optional `transform` | `instant / standard` | The user is currently pressing |
| `transition.focus` | `background-color`, `opacity`, focus ring | `fast / standard` | Input ownership changed |
| `transition.reveal` | `opacity`, small `translateY` | `standard / decelerate` | Secondary content became relevant |
| `transition.presentSheet` | `transform`, scrim `opacity` | `slow / emphasized` | A scoped surface entered context |
| `transition.dismissSheet` | `transform`, scrim `opacity` | `fast / accelerate` | The scoped surface left context |
| `transition.snapSheet` | `transform` only; radius/shadow may change instantaneously at rest and are not animated | `spring.standard` or `slow / emphasized` | A direct drag reached a detent |
| `transition.push` | `transform` (optional opacity) | `standard / emphasized` | Contextual navigation moved forward; opacity is optional and must match the source/destination design |
| `transition.replace` | `opacity` or content highlight | `ultraFast / standard` | In-place data changed |
| `transition.feedback` | `opacity`, color, icon swap | `fast / standard` | A local action was accepted or rejected |

Do not use `transition.presentSheet` for a list row, or `transition.replace` for a route change. The token name is part of the review contract.

## 12. Native PWA recommendations

The PWA should feel at home on iOS without pretending to be a native app:

- Use `viewport-fit=cover`, `env(safe-area-inset-*)`, and `overscroll-behavior` deliberately; never hardcode a home-indicator offset into a motion value.
- Keep the map mounted across shell and sheet changes so WebGL does not reset and the user’s spatial reference does not disappear.
- Use standalone display and correct status-bar/theme metadata, but preserve browser history, share, refresh, and deep-link behavior.
- Treat network transitions as state changes: show stale data honestly, queue supported writes, and make retry/recovery explicit. Do not animate a fake “native” loading state indefinitely.
- Avoid intercepting browser Back for a gesture that has not been committed. A sheet close, navigation pop, and browser history entry must agree.
- Support iOS Safari, Android Chrome, desktop Safari/Chrome/Firefox, touch, trackpad, mouse, keyboard, and installed/regular browser contexts.
- Use platform conventions where they help: swipe-down for sheet dismissal on touch, Escape for desktop dismissal, visible close/back affordances, and system reduced-motion/transparency preferences.
- Keep the app usable when install prompts, browser chrome, keyboard, orientation, split view, or viewport height changes occur mid-transition.
- Prefer static assets and CSS transitions for first paint; do not delay meaningful content behind a motion sequence.

## 13. Repository audit and recommended follow-up

The current implementation has a sound foundation but an inconsistent vocabulary:

- `BottomSheet.tsx` already uses transform-based dragging, detents, velocity projection, scroll handoff, resistance, `overscroll-contain`, and a shared `ease-spring`. Preserve this architecture.
- `ModalSheet.tsx` uses sheet entry classes and a shared sheet duration, but the behavior should be documented as one presentation contract with one dismissal path.
- The target contract requires exit-presence and swipe-down dismissal; the current `ModalSheet` returns `null` when closed and has no swipe-dismiss implementation. Treat this as a follow-up gap, not current support.
- The target contract requires a real focus trap and one Escape owner. The current modal moves focus on entry/restoration but does not fully trap Tab, and nested document listeners can close more than one surface. This is a P1 accessibility/interaction follow-up.
- The target contract forbids stacked modal sheets. `SheetPicker` currently renders a nested `ModalSheet`; migrate it to one presentation host before claiming the target behavior is live.
- `NavigationStack.tsx` shares the sheet curve, which is good for continuity, but push/pop, modal entry, and local content changes should be separate semantic tokens.
- The target navigation contract includes browser history and `popstate`; the current `NavigationStack` uses local React presence only. Do not describe current push/pop as history-integrated.
- `globals.css` already has reduced-motion and reduced-transparency fallbacks. Future work should make component-level fallbacks explicit rather than relying only on a global 1ms override.
- `Button.tsx`, `ItemCard.tsx`, `SearchField.tsx`, and several sheets use different press scales, transition properties, and timing aliases. Normalize them through the token names above when those components are next edited.
- `page.tsx` contains `transition-all` in a filter pill and scattered one-off scales. Replace only as part of a focused component change; this research task does not edit it.
- `MapboxAdapter.ts` has marker hover/active transforms and a reduced-motion map check. Marker animation must remain subordinate to map camera and sheet state.
- `animate-in` recipes appear in several data states. Audit them for layout shift, stale-row flashes, and reduced-motion behavior before adding more.

The main reasons the product can feel non-native are not a missing animation library. They are competing owners, mixed semantic durations, layout-affecting properties in interaction paths, content that changes height during a transition, and transitions that do not explicitly define interruption and reduced-motion behavior.

## 14. Adoption checklist for future features

Before shipping a motion-bearing component, the engineer must record:

1. What state or hierarchy change does the motion explain?
2. Which semantic duration, easing, spring, and interaction tokens are used?
3. What owns the gesture and what happens on interruption/cancel?
4. What is the reduced-motion and reduced-transparency behavior?
5. Does the animation avoid layout/repaint work on the hot path?
6. Is the same action available by keyboard and assistive technology?
7. Was it driven on iOS Safari, Android Chrome, desktop pointer/keyboard, and a low-end device?
8. Does the feature preserve content identity and avoid stale or wrong-context flashes?

The design-system maintainers should eventually expose a typed token module, a sheet state machine, a modal/presentation host contract, a reduced-motion hook, and a motion-debug overlay. Those additions belong in a separate implementation change and must be wired to live call sites in the same change.

## 15. Recommendation summary

Adopt the token names and behavior contracts in this document as the WetinDey motion vocabulary. Keep motion short, composited, interruptible, and subordinate to the map-and-sheet information hierarchy. Use iOS-like detents and direct manipulation where they help the PWA’s core task; use web-native history, keyboard, pointer, and accessibility behavior everywhere else. Calibrate values on real devices after the contract is adopted, and treat measured frame performance and reduced-motion behavior as release criteria.
