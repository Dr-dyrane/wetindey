# ADR-026: Liquid Glass sheet material system

**Date:** 2026-07-19  
**Status:** Accepted — visual architecture only; implementation separately evidenced  
**Owners:** Founder, Human Interface, Motion & Interaction

> This ADR accepts the material architecture and vocabulary. It does not authorize
> source, asset, component, provider, deployment, or runtime completion. The later
> implementation lane must preserve sheet detents, focus, portal/inert, scroll, and map
> WebGL behavior and must return to this ADR for direct evidence.

## Context

WetinDey's map is the spatial reference frame. Opaque sheet slabs erase that context and
make compact controls feel detached from the map. A translucent material can preserve
context, but uncontrolled blur, saturation, nested cards, or animated filters reduce
legibility and performance. The product therefore needs a small named material system,
not a generic “glass” class copied across every surface.

## Decision

Sheet surfaces use restrained translucent materials by default. **Opaque sheet slabs are
prohibited** except as the explicit accessibility fallback for reduced-transparency
preferences or forced-colors/high-contrast modes. An opaque fallback is a safety and
readability mode, not a second visual treatment to animate between. Unsupported backdrop
filtering or a measured performance failure blocks implementation acceptance; it does not
authorize an opaque product variant outside those accessibility preferences.

### Named material tokens

The following tokens are the only sheet-material vocabulary. Values are target ranges for
light and dark calibration; they are not permission to invent per-component variants.

| Token | Intended surface | Fill alpha | Backdrop | Contract |
|---|---|---:|---|---|
| `material.contextIsland` | compact peek/half sheet, floating map/context island | ~58–64% | `backdrop-blur-sm` (~8px) | Preserve map/context; restrained/no saturation; one blur owner |
| `material.denseGlass` | docked sheet, modal, focused decision surface | ~70–82% | `backdrop-blur-sm` (~8px) | Dense readable surface; restrained/no saturation; one blur owner |
| `material.expandedGlass` | expanded edge-to-edge sheet | ~70–82% | `backdrop-blur-sm` (~8px) | Edge-to-edge geometry remains translucent; no opaque slab in normal mode |
| `material.opaqueFallback` | reduced-transparency/forced-colors accessibility fallback | 100% | none | Explicit accessibility/readability fallback; no translucency or blur |

“~8px” means the browser `backdrop-filter` blur radius, not a filter on the sheet's
contents. **Never apply content `filter: blur()`** to text, controls, cards, map tiles, or
the sheet subtree. Do not add saturation, colour-shift, animated noise, grain, or a second
filter to make glass look richer. A material may use a restrained tint needed for light/dark
contrast, but it must not become a status, rating, category, or brand-colour surface.

### Layering and geometry

- There is at most **one blur layer per visible sheet**. The sheet host owns the backdrop
  filter; descendants do not use `backdrop-filter`, `filter: blur`, or nested glass slabs.
- Cards, pills, inputs, badges, and controls inside a sheet are ordinary neutral surfaces
  with contrast and spacing. They do not receive a glass material, a nested blur, or a
  decorative translucent slab by inheritance.
- Compact and docked sheets may be islands over the map. An expanded sheet is edge-to-edge
  in its sheet region but remains `material.expandedGlass` translucent in normal modes.
- Use a subtle inset edge light and the existing elevation rung to separate the sheet from
  the map. Do not draw a decorative hairline, border, gradient outline, or animated edge.
- The map remains mounted and readable; sheet material must not turn it into an unreadable
  texture. Scrim ownership remains singular and follows the existing modal contract.

### Motion

Material appearance is static during a presentation. Animate only `transform` and `opacity`
for sheet entry, dismissal, detent changes, and scrim changes. Do not animate blur radius,
backdrop saturation, fill alpha, edge light, elevation, width, height, or border. A material
fallback change is an immediate state/accessibility change, not a crossfade between blur
and opaque slabs. Existing motion tokens remain authoritative for duration/easing; this ADR
adds the property restriction and one-blur ownership rule.

## Accessibility and environment behavior

### Light and dark

Calibrate each named material independently in light and dark themes. Text, controls,
focus indicators, status labels, map context, and the sheet's edge separation must remain
legible at the minimum alpha in the token range. Do not infer dark values by simply
inverting light values. The material must never carry meaning by colour alone.

### Reduced transparency and forced colors

When `prefers-reduced-transparency: reduce` is available, use
`material.opaqueFallback` immediately and preserve the same geometry, focus, content,
contrast, and dismissal behavior. Forced-colors/high-contrast mode likewise removes blur
and translucency, uses system colors, and retains a visible system focus indicator. If the
browser cannot prove the required glass behavior, the implementation is not accepted;
never emulate glass with content blur or silently widen the opaque exception.

### Reduced motion

Under `prefers-reduced-motion: reduce`, keep the selected material static and remove
travel, scale, parallax, animated depth, and any material/elevation transition. A sheet
may appear or disappear with a short opacity change or immediate state update. All actions
remain available through keyboard, pointer, screen reader, and a visible non-gesture close
path.

## Acceptance and implementation gates

Acceptance of this ADR is architecture-only. A future implementation claim must provide:

1. Reused-tab evidence for compact, docked/modal, and expanded sheets in light/dark mode,
   showing the named alpha ranges, one blur owner, readable map context, and no nested
   glass/card slabs.
2. Forced-colors and reduced-transparency evidence showing the opaque fallback, preserved
   focus/contrast/geometry, and no content blur. Reduced-motion evidence must show only
   transform/opacity or an immediate state change.
3. A static contract proving no `filter: blur`, no animated blur/saturation/alpha/edge,
   no decorative borders, and no second backdrop-filter within a visible sheet subtree.
4. Direct accessibility checks for text contrast, keyboard/focus, screen readers, zoom,
   touch targets, and map readability on representative light/dark devices. Performance
   evidence must cover a mid-range Android and thin connection.
5. Independent Human Interface and accessibility/security review. Any failed readability,
   forced-colors, reduced-transparency, reduced-motion, or performance condition fails
   closed and does not authorize a translucent exception or an opaque variant outside the
   two named accessibility fallbacks.

This ADR supersedes only the provisional sheet-material language that conflicts with these
named tokens, one-blur rule, no-content-blur rule, and accessibility fallbacks. It does
not supersede ADR-016, ADR-018, ADR-023, or any product/fulfilment boundary.
