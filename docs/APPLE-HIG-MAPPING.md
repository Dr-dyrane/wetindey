# Apple HIG → WetinDey

How this UI maps to Apple's Human Interface Guidelines, and — more importantly —
**which parts of "iOS design" are actually specified and which are folklore.**

That distinction drives the whole file. Most numbers circulating as "the iOS
metric" have no primary source. Where Apple publishes a value, we transcribe it.
Where Apple doesn't, we choose one and say so. We don't dress a guess as a spec.

---

## What Apple actually documents

| Documented | Where it lives here |
|---|---|
| The type ramp (sizes + line heights at Large Dynamic Type) | `tailwind.config.ts` → `fontSize` |
| 44×44pt default control size (28×28 is the a11y floor, **not** a target) | `spacing.tap` |
| Material semantics; Liquid Glass's 35% dimming rule | `globals.css` → `.material-*` |
| Presentation rules (sheet vs menu vs popover vs alert) | see [Presentation](#presentation) |
| Detents: large = full, medium ≈ half; grabber cycles detents | `BottomSheet.tsx` |

## What Apple does *not* document — and we therefore chose

| Not published | Our choice | Why it's not published |
|---|---|---|
| Any corner radius | `.squircle` 16/20px, `-lg` 22/28, `-xl` 28/36 | iOS 26 *derives* radii from container geometry (`containerConcentric`, `ConcentricRectangle`). There was never a constant to publish. |
| Any material blur/saturation | `blur(20px) saturate(180%)` | No Apple material has ever had its blur radius published. |
| Search field height | 36px | The HIG search page contains **zero** numbers. |
| List row heights | content-driven | `UITableView.rowHeight` defaults to `automaticDimension`. |
| Full-bleed image rules | images bleed in `ItemCard` | The Images/Collections pages cover only resolution, format, colour. |

**`blur(20px) saturate(180%)` is web folklore, not an Apple value.** Its origin
post (Esteves, 2015) used `blur(10px)` and no saturate at all; "glassmorphism"
was coined in 2020, independently of Apple. We use it because it looks right,
not because it's correct.

---

## Zero borders

**No element in this UI has a stroke.** Enforced in `globals.css`:

```css
* { border-style: none; }
```

This isn't a stylistic preference — it follows the HIG. Apple's Materials page
specifies that separation comes from **the material and vibrancy themselves**;
there is no instruction anywhere to stroke a material. The ubiquitous
`border: 1px solid rgba(255,255,255,0.25)` on glass is a **web convention**.
(Liquid Glass's specular highlight reads as a bright edge, but that's a rendered
lighting effect, not a border.)

Separation here comes from exactly three things:

1. **Material** — `.material-thin/regular/thick`
2. **Elevation** — `--shadow-card/raised/sheet/island`
3. **Fill** — `--color-fill-primary…quaternary`

There is a live regression guard: a border re-entering the tree can be caught by
asserting that no element has a computed border width (see the verification
snippet in the commit message).

---

## Squircles

Apple's corner is **three Bézier segments per corner** (reverse-engineered by
Figma), **not** a superellipse — so exact parity is unreachable in CSS at any
setting.

`corner-shape` (CSS Borders 4) gets close. Its `squircle` keyword is
`superellipse(2)` → classic exponent **n = 2^2 = 4**, against the *rumoured,
hedged* n≈5 attributed to Apple. Note the trap: the spec writes the exponent as
`2^K`, so CSS `squircle` (K=2) is n=4, not n=2.

| Browser | Status |
|---|---|
| Chrome/Edge | **Shipped 139** (Aug 2025) |
| Safari | **Not shipped.** WebKit position `support`; bug 277912 open, no date |
| Firefox | Mid-implementation behind `layout.css.corner-shape.enabled` |

So it's progressive enhancement — and the irony is that **Safari, the platform
this imitates, is the one that won't draw the squircle**:

```css
.squircle { border-radius: 16px; }              /* everywhere */
@supports (corner-shape: squircle) {
  .squircle { corner-shape: squircle; border-radius: 20px; }
}
```

`corner-shape` is a **no-op without a non-zero `border-radius`**, so both are
always set. The radius opens up under `@supports` because squircle corners read
tighter than a circular arc at the same radius.

---

## Presentation

Apple's rule, verbatim:

> **"Use an action sheet — not a menu — to provide choices related to an action."**
> **"Avoid displaying popovers in compact views."**

**Every phone is a compact view, and a dropdown anchored to its trigger is a
popover.** So this app has **no dropdowns**. `SheetPicker` presents a sheet.
`DropdownMenu` was deleted.

| Need | Component |
|---|---|
| Choose from a list as part of an action | `SheetPicker` → sheet |
| A task over the current context | `ModalSheet` |
| Results over the map | `BottomSheet` (island → docked) |
| Destructive confirmation | alert (not yet needed) |

**Progressive reveal = a new surface, never a swap in place.** Settings and
Report present *over* the results sheet, which stays mounted behind them, so the
context you came from is still visible and dismissal returns you to it.

### Known deviation

HIG says *"Display only one sheet at a time"* and *"if a sheet spawns a sheet,
close the first before showing the second."* `SheetPicker` opened from
`ReportPriceSheet` **stacks a second sheet**. It reads correctly (the picker
fully covers its parent) but it is a deviation. The HIG-correct fix is a
navigation push *within* the parent sheet rather than a second presentation.
Tracked, not hidden.

---

## The sheet

Three detents — peek 20vh / medium 52vh / large 94vh. HIG defines medium as
*"about half of the fully expanded height"*, a ratio, not a pixel value, which
is why these are fractions.

- **Island → docked.** Inset 10px with all corners squircled while it floats;
  flush to the edges with a square bottom once expanded. Driven by *height*, not
  the committed detent, so the island dissolves under your finger rather than
  jumping on release.
- **Glass → opaque.** Material while it floats (it's chrome over the map),
  opaque once docked — because HIG says *"Don't use Liquid Glass in the content
  layer"*, and a docked sheet **is** the content layer.
- **Velocity projection.** A flick skips a detent; release position alone can't
  tell a flick from a slow drag.
- **Scroll coordination.** The list keeps the gesture unless you're pulling down
  from its top.
- Height is expressed in `vh`, not px — px needs `window.innerHeight`, which
  doesn't exist during SSR, and that mismatch is a real hydration bug.

---

## Signal colour

The chrome is **deliberately neutral** (black/white/grey) so the colour budget
is spent entirely on signal: a green price is the only green on screen.

That only works if signal follows the platform exactly. Dark mode is **not** the
same hue dimmed — Apple ships a separate, brighter, less-saturated value:

| Status | Light | Dark |
|---|---|---|
| confirmed | `#34C759` systemGreen | `#30D158` |
| caution | `#FF9500` systemOrange | `#FF9F0A` |
| unavailable | `#FF3B30` systemRed | `#FF453A` |
| info | `#007AFF` systemBlue | `#0A84FF` |

Colour is never the only signal — every status also carries a label, so meaning
survives greyscale and colour-blindness.

---

## Accessibility

- **44×44pt** hit targets (`spacing.tap`), even where the glyph is smaller —
  see the search field's clear button (17px mark, 44px target).
- `prefers-reduced-motion` → transitions collapse.
- `prefers-reduced-transparency` → **materials go opaque**, matching iOS.
- Focus is a ring on `:focus-visible` only. (The one intentional stroke in the
  product — an accessibility affordance, not decoration.)
