# Accessibility audit — WetinDey

Read-only audit against **WCAG 2.1 Level AA** and Apple's accessibility guidance.
Nothing in this pass modified application code.

Method: contrast ratios are computed from the token values in `src/app/globals.css`
using the WCAG 2.x relative-luminance formula, with alpha composited onto the real
backing surface each token is actually used over. The script is reproducible — every
number below is the output of that composite, not an eyeball. Cascade claims
(`:focus-visible`, `prefers-reduced-transparency`) were verified against the **compiled**
stylesheet (`npx tailwindcss -i src/app/globals.css -o out.css`), not the source,
because Tailwind reorders layers and that reordering is where two of the findings live.

**Verdict: the app fails WCAG 2.1 AA.** Not marginally — there are three defects
(P0-1, P0-2, ~~P0-3~~ — **P0-3 fixed 2026-07-17**) that independently make core flows unusable, and one of them
(P0-2) means a keyboard user cannot submit a price at all, which is the app's only
write path.

---

## Summary

| # | Finding | SC | Severity |
|---|---|---|---|
| P0-1 | ~~`focus-visible:outline-none` deletes the focus ring from every `Button`~~ | 2.4.7 | **FIXED 2026-07-17.** Two causes, not one: the utility, **and** `transition-all` animating the ring in over 160ms — invisible while it faded. Verified with real keys: `rgb(0,122,255) solid 2px, offset 2px`. |
| P0-2 | `ModalSheet` steals focus on every parent re-render — price cannot be typed | 2.1.1, 2.4.3 | Fails A |
| P0-3 | ~~`userScalable: false` blocks pinch-zoom~~ | 1.4.4 | **FIXED 2026-07-17** |
| P0-4 | Map markers are unfocusable, unnamed `<div>`s | 2.1.1, 4.1.2 | Fails A |
| P0-5 | `text-secondary` is 3.30:1 in light — the app's second-most-used text colour | 1.4.3 | Fails AA |
| P0-6 | ~~`status-confirmed-fg` is 3.55:1 on its own tint~~ | 1.4.3 | **FIXED 2026-07-17**, light AND dark. Retuned against the worse backing: light 4.59–5.43, dark 5.24–8.80. All 16 combinations pass. |
| P0-7 | `text-onStatus` (white) is 2.22:1 on `status-confirmed` | 1.4.3 | Fails AA |
| P0-8 | `page.tsx:840-843` puts the pure hue on a 10% tint — 2.03:1 | 1.4.3 | Fails AA |
| P1-1 | ~~Input/SearchField `focus:outline-none`~~ | 2.4.7, 1.4.11 | **FIXED 2026-07-17.** Ring restored on both; the 1.15:1 fill lift stays as the second cue. `SearchField`'s ring had to move to the wrapper — `overflow-hidden` would have clipped it on the input. Code-verified; browser check owed (LANES H24). |
| P1-2 | Two close buttons have no accessible name | 4.1.2 | Fails A |
| P1-3 | `<html lang="en">` while rendering Yoruba and Pidgin | 3.1.1, 3.1.2 | Fails A/AA |
| P1-4 | 14 controls under 44×44 | HIG | Apple guidance |
| P1-5 | No `<main>`, no `<h1>`, no skip link; whole app inside `role="dialog"` | 1.3.1, 2.4.1 | Fails A |
| P1-6 | `text-tertiary` is 1.71:1 and carries real text | 1.4.3 | Fails AA |
| P1-7 | 16 `text-[Npx]` labels ignore Dynamic Type entirely | 1.4.4 (Apple) | Fails AA |
| P1-8 | `SheetPicker`'s field label is not in the accessible name | 4.1.2, 3.3.2 | Fails A |
| P1-9 | `data-autofocus` never fires — dead code in three sheets | 2.4.3 | Could be nicer |
| P2-1 | `SettingsSheet` segmented control mis-uses `role="tab"` | 4.1.2 | Fails A |
| P2-2 | No live region for search results or marker selection | 4.1.3 | Fails AA |
| P2-3 | `<h3>` inside `<button>` in `ItemCard` | 1.3.1 | Could be nicer |

**What is already right** — and is genuinely well done, so do not "fix" it:
`prefers-reduced-motion` and `prefers-reduced-transparency` both work (verified in the
compiled CSS); `MapboxAdapter` honours reduced-motion in JS deliberately and correctly;
`AsyncList` has proper `role="status"` / `aria-busy` / `sr-only`; `ListRow`, `SheetPicker`,
`LocationSheet`, `AreaPickerSheet`, `ConfirmVisitSheet` and `ItemDetailSheet` all use
`min-h-tap` correctly; `StatusBadge` does pair colour with a label.

---

## 1. Focus

`src/app/globals.css:192-195` establishes the one intentional stroke in the UI:

```css
:focus-visible {
  outline: 2px solid var(--color-focus-ring);
  outline-offset: 2px;
}
```

The ring's own contrast is fine: `#007AFF` on `#F2F2F7` = **3.60:1**, on `#FFFFFF` =
**4.02:1**; `#0A84FF` on `#000000` = **5.76:1**, on `#1C1C1E` = **4.66:1**. All clear the
3:1 that SC 1.4.11 asks of a focus indicator. `* { border-style: none }` at
`globals.css:198` does not touch it, because an outline is not a border.

### P0-1 — `focus-visible:outline-none` deletes it from every Button — SC 2.4.7, fails AA

`src/design-system/components/Button.tsx:18`:

```
"inline-flex items-center justify-center font-semibold ... focus-visible:outline-none ..."
```

Tailwind's `outline-none` does not remove the outline; it emits
`outline: 2px solid transparent`. Verified in the compiled sheet:

```
byte  5096  :focus-visible{outline:2px solid var(--color-focus-ring);outline-offset:2px}
byte 27270  .focus-visible\:outline-none:focus-visible{outline:2px solid transparent;...}
```

The utility is later in source order **and** higher specificity (0,2,0 vs 0,1,0). It wins
in both tiebreaks. Every `Button` in the app — Directions, Share, the primary submit, the
retry affordances — receives a **transparent** 2px ring on keyboard focus. And because
this is a zero-ring UI, there is no ring, no border and no shadow standing in for it: the
focused state is pixel-identical to the unfocused state. There is no fallback because the
house rules forbid the fallback.

This is worth naming plainly: the design system's stated position is that
`:focus-visible` is the only stroke it permits, and the base button component turns that
stroke off. The rule and its most-used consumer disagree, and the consumer wins.

### P0-2 — `ModalSheet` steals focus on every parent re-render — SC 2.1.1 / 2.4.3, fails A

`src/design-system/components/ModalSheet.tsx:39-63`. The dependency chain:

```ts
const onKeyDown = useCallback((e) => { ... onClose(); }, [onClose]);   // :39-47

useEffect(() => {
  if (!open) return;
  lastFocused.current = document.activeElement;                        // :51
  ...
  return () => {
    ...
    (lastFocused.current as HTMLElement | null)?.focus?.();            // :61
  };
}, [open, onKeyDown]);                                                 // :63
```

`onKeyDown` is memoised on `onClose`. `page.tsx:992` passes an inline arrow:

```tsx
<ReportPriceSheet open={isReportOpen} onClose={() => setIsReportOpen(false)} ... />
```

That closure has a new identity on every render of `page.tsx`. `ReportPriceSheet.tsx:66`
forwards it straight through (`onClose={p.onClose}`). So `onKeyDown` is new every render,
so the effect's dep array changes every render, so the effect **re-runs every render** —
which means the cleanup at `:61` runs every render and calls
`lastFocused.current.focus()`, moving focus back to the trigger behind the sheet. The new
effect then schedules `:55-57` and, 60ms later, focuses the first control in the panel.

Now trace the price field. It is controlled from `page.tsx` (`price={formPrice}` at
`page.tsx:1002`, `onPrice={setFormPrice}` at `page.tsx:1008`), and
`ReportPriceSheet.tsx:127` does `onChange={(e) => p.onPrice(e.target.value)}`.

1. User focuses the price input, types `5`.
2. `setFormPrice` re-renders `page.tsx`.
3. New `onClose` → new `onKeyDown` → effect re-runs.
4. Cleanup fires: focus jumps to the `+` button behind the scrim.
5. 60ms later: focus jumps to the sheet's Close button.
6. The user types `0`. It goes nowhere — the input no longer has focus.

**A keyboard user cannot enter a price.** Reporting a price is the only thing this app
lets a user write. `ConfirmVisitSheet.tsx:523-528` has an identical controlled price
input and the same defect.

This is not a theoretical focus-order nit; it is the contribution flow being closed to
keyboard and switch-control users. Rank it accordingly.

### P0-2b — no focus trap, and the background is not inert — SC 2.4.3

`ModalSheet` sets `aria-modal="true"` (`:89`), which is enough for NVDA/JAWS/VoiceOver to
ignore the content behind. Screen readers are covered. Keyboard-only sighted users are
not: nothing traps Tab, and the content behind is neither `inert` nor `aria-hidden`.
Tabbing past the last control in the sheet leaves the dialog and lands on the theme
toggle, the search field and the item cards — all sitting behind a 35% scrim, all
invisible as focus targets because of P0-1. The user is typing into a page they cannot
see.

The component's own docstring (`:26-31`) claims the sheet "hands back exactly where you
were on dismiss". The restore call exists at `:61`, but P0-2 fires it constantly while
open, so the intended behaviour is drowned by the bug.

### P1-9 — `data-autofocus` is dead code — SC 2.4.3

`ModalSheet.tsx:56`:

```ts
panelRef.current?.querySelector<HTMLElement>("[data-autofocus], button, input, select, textarea")?.focus();
```

`querySelector` with a selector list returns the first element in **document order** that
matches *any* branch — not the first branch that matches something. The Close button
(`:128-135`) is the first `button` inside `panelRef`, always. So focus always lands on
Close, and the `data-autofocus` attributes at `AreaPickerSheet.tsx:232`,
`ConfirmVisitSheet.tsx:528` and `LocationSheet.tsx:418` have never once taken effect. The
intent — put the user on the price field, not on the exit — is correct and worth keeping;
the selector needs to try `[data-autofocus]` first and fall back only if it misses.

### P1-1 — text inputs remove focus, and the replacement is invisible — SC 2.4.7 / 1.4.11

- `src/design-system/components/Input.tsx:25` — `focus:outline-none focus:bg-surface`
- `src/design-system/components/SearchField.tsx:50` — `focus:outline-none`, with
  `focus-within:bg-surface` on the wrapper at `:38-39`

`SearchField`'s docstring at `:26-27` states the intent: "Focus is signalled by the fill
lifting from tertiary to a solid surface, which is how iOS does it." The intent is right.
The values do not deliver it. `fillTertiary` is `rgba(118,118,128,0.12)`, which over
`#FFFFFF` composites to `(238,238,240)`. Against the `#FFFFFF` it lifts to:

> **1.15:1**

SC 1.4.11 wants 3:1 for a focus indicator. 1.15:1 is not a state change a sighted user
will see; it is not a state change most *monitors* will render distinctly. iOS gets away
with this because it pairs the fill lift with a blinking caret and a keyboard sliding up
— neither of which is a focus indicator on the web.

---

## 2. Contrast

All ratios computed from `globals.css` tokens, alpha composited onto the real backing.

### Labels — light theme

| Token | Composite | on `#F2F2F7` | on `#FFFFFF` | on `#E9E9EF` |
|---|---|---|---|---|
| `text-primary` `#000` | — | 18.82 | 21.00 | 17.37 |
| `text-secondary` `rgba(60,60,67,.60)` | `(138,138,142)` | **3.30** | **3.44** | **3.19** |
| `text-tertiary` `rgba(60,60,67,.30)` | `(197,197,199)` | **1.71** | **1.73** | **1.69** |
| `text-quaternary` `rgba(60,60,67,.18)` | `(218,218,219)` | **1.36** | **1.37** | **1.35** |

### Labels — dark theme

| Token | on `#000` | on `#1C1C1E` | on `#2C2C2E` |
|---|---|---|---|
| `text-primary` `#FFF` | 21.00 | 17.01 | 13.94 |
| `text-secondary` `rgba(235,235,245,.60)` | 6.36 | 5.95 | 5.27 |
| `text-tertiary` `rgba(235,235,245,.30)` | **2.25** | **2.48** | **2.41** |
| `text-quaternary` `rgba(235,235,245,.16)` | **1.38** | **1.58** | **1.59** |

### P0-5 — `text-secondary` fails AA in light — SC 1.4.3

**3.30:1** on `background`, **3.44:1** on `surface`. AA requires 4.5:1 for text under
18pt/14pt-bold. Nothing in this app renders `text-secondary` at 18pt. It is the app's
second-most-used text colour and it carries real content: `page.tsx:707-709` ("N locations
found"), `page.tsx:730-733` (distance and address), `page.tsx:836/854/861` (the labels on
every stat in the detail panel), `ItemCard.tsx:141` (the unit — which that file's own
comment at `:138-140` argues is load-bearing, not decoration), `ListRow.tsx:46` and `:67`,
`SheetPicker.tsx:61`.

This is inherited honestly: it is Apple's `secondaryLabel`, and Apple's own token fails
WCAG in light mode. That is a real fact about Apple, not an excuse. On iOS the OS ships
Increase Contrast, which swaps the token system-wide; the web has no such switch, so a
faithful transcription of Apple's palette ships Apple's failure with none of Apple's
remedy. **Dark mode passes comfortably (6.36 / 5.95 / 5.27) — the defect is light-only.**

Raising the alpha from `.60` to `.72` puts it at **4.53:1** on `#FFFFFF` and **4.34:1** on
`#F2F2F7` — still short on the grouped background. `rgba(60,60,67,0.75)` gives **4.86** /
**4.65**: passes on every surface in the app, and is a small enough shift that the
hierarchy against `text-primary` survives. That is a product decision about fidelity vs.
compliance, not mine to take.

### P1-6 — `text-tertiary` at 1.71:1 carries real text — SC 1.4.3

At **1.71:1** light / **2.25:1** dark this is below even the 3:1 non-text floor. For
genuinely decorative use it would be defensible. It is not only decorative:

- `SheetPicker.tsx:74` — the **placeholder that is the picker's current value display**.
  When nothing is selected, "Choose unit" is the only text in the control, at 1.73:1.
- `SheetPicker.tsx:84` — `"Nothing available"`, the empty state's entire message.
- `Input.tsx:25`, `SearchField.tsx:50` — `placeholder:text-text-tertiary`. Placeholders
  are exempt from 1.4.3 only when they duplicate a visible label. `SearchField` has no
  visible label (`aria-label` at `:47` is not visible), so its placeholder — "Search for
  jollof rice…" — is the field's only visible affordance, at 1.73:1.
- `ItemDetailSheet.tsx:516/523` — `text-text-tertiary line-through` on **sold-out
  prices**. Struck-through *and* at 1.73:1 is double-encoded illegibility on the exact
  data point the user came for.
- `ItemCard.tsx:166` — the photo credit. That file's own comment at `:158-160` says this
  is a CC BY licence obligation. A licence obligation rendered at 1.71:1 is arguably not
  discharged.
- `page.tsx:929` — `text-[9px] text-text-tertiary` for the unit. Nine pixels at 1.71:1 is
  the worst pair in the codebase.

The grabber (`BottomSheet.tsx:241`, `ModalSheet.tsx:120`) uses `bg-text-tertiary` at
**1.71:1** against `background`. As the sole visual cue for "this sheet drags", it is a
non-text UI component and wants 3:1 under SC 1.4.11.

### P0-6 — the `-fg` on `-bg` claim is false — SC 1.4.3

The brief said to verify the claim at `globals.css:101` ("Darkened for small text on a
tint") rather than take it. **It does not hold.** `StatusBadge.tsx:48` renders at
`text-[11px] font-semibold` — nowhere near the 18pt/14pt-bold large-text threshold — so
every cell below needs **4.5:1**.

| Pair | over `surface` | over `background` | |
|---|---|---|---|
| `confirmed-fg #248A3D` on `confirmed-bg` | **3.92** | **3.55** | fails both |
| `caution-fg #B25000` on `caution-bg` | 4.64 | **4.21** | fails on `background` |
| `unavailable-fg #C1271B` on `unavailable-bg` | 4.87 | **4.40** | fails on `background` |
| `info-fg #0058D0` on `info-bg` | 5.44 | 4.91 | passes |

Dark theme, where `-fg` is set equal to the pure hue (`globals.css:166-169`):

| Pair | over `#1C1C1E` | over `#000` | |
|---|---|---|---|
| `confirmed-fg #30D158` | 5.94 | 8.05 | passes |
| `caution-fg #FF9F0A` | 5.83 | 7.93 | passes |
| `unavailable-fg #FF453A` | **4.05** | 5.25 | fails on `surface` |
| `info-fg #0A84FF` | **3.65** | 4.79 | fails on `surface` |

~~Six of sixteen combinations fail.~~ **FIXED 2026-07-17 — all sixteen pass.** The pattern was *partly* diagnostic: **the `-fg` values were
tuned against one backing and then used over two** — but that does not explain `confirmed`, which failed at **4.40 on bare `#FFFFFF` with the tint removed entirely**. Backing was never its variable; only a darker ink was. The retune darkens light ink and *lightens* dark ink, because the polarity flips between themes. `confirmed` fails everywhere in
light; `caution` and `unavailable` pass on `surface` and fail on `background`; in dark the
polarity flips and `unavailable`/`info` fail on `surface` while passing on `background`.
The tokens are not wrong so much as under-specified — a `-fg` token cannot be correct
until the surface it sits on is part of its definition.

`confirmed` is the one that matters most: it is the badge that says a price is trustworthy,
and at **3.55:1** it is the least readable of the four.

### P0-7 — `text-onStatus` is white on saturated mid-tones — SC 1.4.3

`globals.css:76-77` asserts white "stays white in both themes because the status hues are
saturated mid-tones in both". Saturated, yes. Mid-tone, no — Apple's system greens and
oranges are *light*:

| | white on hue |
|---|---|
| `status-confirmed #34C759` | **2.22** |
| `status-caution #FF9500` | **2.20** |
| `status-unavailable #FF3B30` | **3.55** |
| `status-info #007AFF` | 4.02 |
| dark `#30D158` | **2.02** |
| dark `#FF9F0A` | **2.06** |

Consumers:

- `Button.tsx:23` — `variant="danger"` is `bg-status-unavailable text-onStatus` =
  **3.55:1**. A destructive button's label below AA.
- `MapboxAdapter.ts:279-285` — every map marker is `bg-status-{kind} text-onStatus`. The
  white pin glyph on a green marker is **2.22:1** — the single most-repeated element in
  the product.

The token's comment reasons correctly *from a false premise*. Black ink gives **9.47:1**
on `#34C759` and **9.55:1** on `#FF9500`, but **4.55:1** on `#FF3B30` and **5.22:1** on
`#007AFF` — so a single theme-invariant ink cannot serve all four. `on-status` has to
become per-hue, or the hues have to darken.

### P0-8 — `page.tsx:840-843` puts the pure hue on a 10% tint — SC 1.4.3

```tsx
selectedOffer.detail.confidenceLevel === "confirmed"
  ? "bg-status-confirmed/10 text-status-confirmed"
  : selectedOffer.detail.confidenceLevel === "caution"
  ? "bg-status-caution/10 text-status-caution"
  : "bg-status-unavailable/10 text-status-unavailable"
```

This is the `-fg`/`-bg` pair hand-rolled with the wrong tokens: the **pure hue** as text
on a 10% wash of itself.

| | light | dark |
|---|---|---|
| confirmed | **2.05** | 7.05 |
| caution | **2.03** | 6.93 |
| unavailable | **3.10** | 4.50 |

At `text-xs` (`:835`), 2.03:1 in light. This is the Freshness row of the desktop detail
panel — the trust signal, rendered illegibly. The correct tokens exist and are used
correctly six lines away in `ConfirmVisitSheet.tsx:270-272` and
`ReportPriceSheet.tsx:49-51`. `page.tsx` also hand-rolls the badge shape
(`px-2 py-0.5 rounded-full`) instead of using `StatusBadge`, which is why it drifted.
This is the same "two versions of itself" pattern the brief describes, in miniature.

### Not verifiable statically

`page.tsx:557` and `:565` place `text-text-primary` on `material-thick` over the live
Mapbox basemap. The composite depends on whatever tile is under it. Light `material-thick`
is `rgba(255,255,255,0.72)` at `brightness(1.06)`, so black text stays above ~11:1 even
over a mid-dark road; dark `rgba(28,28,30,0.76)` at `0.86` keeps white text safe over a
dark basemap. Both are almost certainly fine, but "almost certainly" is the honest answer
— confirming it needs a screenshot pass over real tiles at both themes. Flagged, not
claimed.

---

## 3. Touch targets

`tailwind.config.ts:90-95` defines `spacing.tap: "44px"` and documents it correctly:
44×44pt is the default control size; 28 is the accessibility floor, not a target. Most of
the newer surfaces honour it — `ListRow.tsx:34`, `SheetPicker.tsx:69`/`:99`,
`MapboxCanvas.tsx:366` (`min-h-tap min-w-tap`), `SearchField.tsx:57`, and every button in
`LocationSheet`, `AreaPickerSheet`, `ItemDetailSheet` and `ConfirmVisitSheet`.

Fourteen do not. WCAG 2.1 AA has no target-size criterion (2.5.5 is AAA; 2.5.8 is 2.2), so
these are **Apple guidance failures, not AA failures** — but the 44pt rule is a house rule
and `MapboxAdapter.ts:275` is a genuine usability defect regardless.

| File:line | Control | Size |
|---|---|---|
| `MapboxAdapter.ts:275` | **every map marker** | 36×36 |
| `Button.tsx:27` | `size="sm"` | 40 |
| `ModalSheet.tsx:131` | Close | **28×28** |
| `page.tsx:807-812` | detail-panel close | **28×28** |
| `page.tsx:898-903` | place-panel close | **28×28** |
| `page.tsx:611` | "Clear search" | **28** |
| `page.tsx:591` | report `+` | 32×32 |
| `page.tsx:598-605` | profile avatar | 32×32 |
| `page.tsx:565` | theme toggle | 36×36 |
| `page.tsx:757`, `:765` | Directions / Share | 36 |
| `SearchField.tsx:38` | the input | 36 |
| `SettingsSheet.tsx:48-56` | segmented control | ~30 |
| `ReportPriceSheet.tsx:145-150` | availability segments | ~33 |
| `AsyncList.tsx:214` | Retry | 32 |
| `BottomSheet.tsx:235-242` | grabber | ~21 tall |

`MapboxAdapter.ts:275` is the worst of these, and by some distance. A 36px marker is the
*primary* interaction of a map-first app, it is placed on a surface the user is also
panning, and markers cluster — at Festac density, adjacent 36px targets with no spacing
mean a mis-tap opens the wrong place's prices. Apple's 44pt is not a courtesy here.

The `ModalSheet` close button at 28×28 is worth calling out separately: `globals.css:13`
explicitly warns that "28x28 is the accessibility floor, not a target". The design system
documents the floor and then builds its dismiss control exactly on it.

---

## 4. Screen readers and the map

**The direct answer to the brief's question: a blind user gets nothing from the map, and
almost everything from the sheet.** The non-visual path exists and is genuinely good. The
map itself is a dead zone.

### P0-4 — markers are unfocusable, unnamed divs — SC 2.1.1 / 4.1.2

`src/integrations/maps/MapboxAdapter.ts:273-305`:

```ts
const el = document.createElement("div");
el.className = `h-9 w-9 rounded-full shadow-md flex items-center justify-center cursor-pointer ...`;
...
el.innerHTML = `<svg ... ><path d="M20 10c0 6-8 12-8 12..."/><circle cx="12" cy="10" r="3"/></svg>`;
if (options.onClick) {
  el.addEventListener("click", () => { options.onClick?.(); });
}
```

No `role`. No `tabindex`. No accessible name. No `keydown` handler. Mapbox GL adds nothing
to a custom marker element. The result:

- **Not keyboard reachable at all** (SC 2.1.1). Every place on the map is unreachable
  without a pointer.
- **No accessible name** (SC 4.1.2). Even reached, it announces as an unlabelled group.
- The inner `<svg>` is not `aria-hidden`, so it leaks into the accessibility tree as an
  unnamed graphic.
- Status is encoded **only** as `bg-status-{kind}` — colour alone (see §7).

### What does work

`page.tsx:703-783` renders the same offers the map renders, as a real list, with place
name, formatted price, unit, distance and address as text. `ItemDetailSheet.tsx:472`
builds a composed `aria-label` per offer. `AsyncList.tsx:142/166/176/204` uses
`role="alert"` / `role="status"` / `aria-busy` / `sr-only` correctly.
`MapLoader.tsx:55` names its own loading state. This is the text equivalent the brief
asked about, and it is not a token gesture — it is the actual answer to "what does jollof
cost near me", in text. Credit where due.

So the map's inaccessibility is a **parity** failure, not a total one. It is still a
failure: markers are interactive controls, and SC 2.1.1 does not have an "there's a list
elsewhere" exception.

### P1-5 — no landmarks, no `<h1>`, whole app inside a dialog — SC 1.3.1 / 2.4.1

There is no `<main>` anywhere in `src/`. There is no `<h1>` on the primary page — the only
one in the codebase is `error.tsx:70`. There is no skip link.

`BottomSheet.tsx:201-204`:

```tsx
<div ref={sheetRef} role="dialog" aria-label="Results" ... >
```

This element is **always rendered** and is not modal — it holds the search field, popular
items, results, and the item cards. So the app's entire content sits inside a control that
announces as "Results, dialog" and has no `aria-modal`. Combined with the absent `<main>`,
there is **no document landmark in the app at all**: a screen-reader user pressing D or
landmark-cycling finds nothing, and cannot orient. `aria-label="Results"` is also static
while the sheet's content switches between "Popular items", search results and a place
list.

`role="dialog"` is the wrong role for persistent content. A `<section aria-label>`, or
`<main>` with the drag affordance kept, gives the same visual sheet without lying about
what it is.

### P1-2 — unnamed close buttons — SC 4.1.2

`page.tsx:807-812` and `page.tsx:898-903`:

```tsx
<button onClick={() => setActiveMarkerId(null)}
        className="p-1.5 rounded-full bg-fillSecondary text-text-secondary ...">
  <X className="h-4 w-4" />
</button>
```

No `aria-label`. Lucide renders a bare `<svg>` with no `<title>`. Accessible name is the
empty string — announced as "button". These are the only way to dismiss the desktop detail
panel. Every other icon button in the app is labelled correctly (`page.tsx:564`, `:593`,
`:602`, `ModalSheet.tsx:130`, `MapboxCanvas.tsx:364`), which makes these two look like an
oversight rather than a policy.

### P1-8 — `SheetPicker`'s label is orphaned — SC 4.1.2 / 3.3.2

`SheetPicker.tsx:61`:

```tsx
<label className="mb-1.5 block text-footnote font-medium text-text-secondary">{label}</label>
```

No `htmlFor`, and `<label>` cannot associate with a `<button>` in any case. The button's
accessible name (`:73-76`) is its own content — the selected value, or the placeholder. So
`ReportPriceSheet.tsx:110-116` announces as *"Choose unit, button"* with no indication
that this is the **Unit** field. Three such pickers stack in the report form (item,
variant, unit) and all three announce interchangeably. `aria-labelledby` pointing at the
label's id fixes it without touching the visual.

### P2-1 — `SettingsSheet` mis-uses the tab pattern — SC 4.1.2

`SettingsSheet.tsx:44-56` sets `role="tablist"` and `role="tab"` on a **segmented
control**. There are no `tabpanel`s, no `aria-controls`, and no roving-tabindex arrow-key
handling. ARIA APG requires all three. A screen reader announces "tab, selected" and the
user reaches for arrow keys that do nothing. `aria-pressed` on plain buttons is the right
pattern — and it is exactly what `ReportPriceSheet.tsx:148`, `ConfirmVisitSheet.tsx:317`
and `ItemDetailSheet.tsx:433` already do for the same control shape. Three files got it
right; this one didn't.

### P2-2 — no live regions on the main surface — SC 4.1.3

`page.tsx` has no `aria-live` anywhere. Search results replace silently
(`:681-697`); `matchingOffers.length` at `:707-709` changes with no announcement; clicking
a marker swaps the whole detail panel (`:791-957`) with nothing announced and no focus
move. `AsyncList` has the right machinery and `page.tsx` does not import it. Another
instance of the two-codebases pattern.

### P2-3 — heading inside a button — SC 1.3.1

`ItemCard.tsx:145` puts `<h3>` inside the `<button>` opened at `:90`. Headings inside
interactive content are flattened by AT and lost from the heading map — and since there
are no other headings on the page (P1-5), the item list is the one place headings could
have provided structure.

---

## 5. Reduced motion and reduced transparency

**Both work.** Verified in the compiled stylesheet, not assumed.

`globals.css:303-312` — the `prefers-reduced-motion` block is unlayered and uses
`!important` on `animation-duration`, `animation-iteration-count`, `transition-duration`
and `scroll-behavior`. Nothing in Tailwind's output outranks `!important` at that
specificity. It neutralises `animate-ping` (`StatusBadge.tsx:29`), `animate-spin`
(`Button.tsx:39`, `MapboxCanvas.tsx:373`), every `tailwindcss-animate` entrance, and the
`BottomSheet` detent transition (`BottomSheet.tsx:228`).

`globals.css:315-324` — `prefers-reduced-transparency`. The source order looks wrong
(`@layer components` at `:225` appears before this block), but Tailwind v3's `@layer` is a
build-time directive, not a CSS cascade layer, so the components rules are hoisted to the
`@tailwind components` position at line 2 while this block stays at the end. Compiled
offsets confirm it:

```
byte  6139  .material-thick{background-color:var(--material-thick)}
byte 25411  @media (prefers-reduced-transparency:reduce){.material-regular,.material-thick,
            .material-thin,.material-ultrathin{backdrop-filter:none;background-color:var(--color-surface)}}
```

Later, same specificity → wins. All eight `material-*` consumers collapse to opaque
`--color-surface`. As a bonus, this *improves* contrast: `text-primary` on the map chip
goes from a composite-over-tiles unknown to a flat 21:1.

The `-webkit-backdrop-filter` in both blocks is stripped by autoprefixer under this
project's browserslist — **symmetrically**, from the components rule and the reset alike.
So there is no Safari leak. The comment at `globals.css:271` is stale but harmless.

`MapboxAdapter.ts:68-75` deserves specific credit. CSS media queries cannot reach
Mapbox's JS-driven camera, and the adapter handles it explicitly:

```ts
// Note we do NOT drop `essential: true`. Mapbox's own reduced-motion handling
// only fires for non-essential moves and it is all-or-nothing; keeping the move
// essential and setting duration 0 gives the same result deterministically,
```

That is the correct analysis and the correct fix. It is the only reduced-motion handling
in the app that a CSS-only audit would have missed, and it is right.

**Gap:** neither query is honoured by every engine — Firefox does not implement
`prefers-reduced-transparency`. Nothing to do in this codebase; noted so nobody claims
universal coverage.

---

## 6. Dynamic Type

`tailwind.config.ts:63-88` makes the correct argument — a `px` ramp means the reader's
font-size setting silently does nothing — and the ramp is `rem` throughout. Good. The
argument is then undercut in three ways.

### P0-3 — `userScalable: false` — SC 1.4.4, fails AA

`src/app/layout.tsx:18-23`:

```ts
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
```

`maximumScale: 1` plus `userScalable: false` disables pinch-zoom. SC 1.4.4 (Resize Text,
AA) requires text to scale to 200% without assistive technology. This is the single most
cited AA failure in mobile web, and it is unambiguous — no interpretation, no edge case.

It also lands hardest on this app's actual users. A price map read one-handed in a Lagos
market in daylight is exactly the situation pinch-zoom exists for, and `text-[9px]` at
`page.tsx:929` is exactly the text it would be used on. iOS 10+ ignores `user-scalable=no`
in Safari; Android Chrome honours it. So this defect is, in practice, Android-only — which
is most of the pilot's audience.

The usual justification is preventing double-tap zoom on a map. Mapbox handles its own
gestures with `touch-action`; it does not need the whole document's zoom disabled.
Removing `maximumScale` and `userScalable` is the fix. **This is a product decision** —
someone chose this — so I am flagging it rather than assuming.

### P1-7 — sixteen labels ignore the ramp entirely — SC 1.4.4

`text-[Npx]` is `px`, so it does not respond to the root font-size at all. This is the
exact failure `tailwind.config.ts:66-72` warns against, in the same codebase:

| File:line | Size |
|---|---|
| `page.tsx:929` | `text-[9px]` |
| `page.tsx:925` | `text-[10px]` |
| `StatusBadge.tsx:48` | `text-[11px]` |
| `SettingsSheet.tsx:119` | `text-[11px]` |
| `page.tsx:639`, `:649`, `:656`, `:693` | `text-[12px]` |
| `page.tsx:635`, `SettingsSheet.tsx:54`, `ReportPriceSheet.tsx:54`, `:150` | `text-[13px]` |
| `page.tsx:648`, `:655` | `text-[14px]` |
| `SettingsSheet.tsx:107`, `:108` | `text-[15px]` |

`StatusBadge.tsx:48` is the important one: it is the trust signal, it is 11px, it is the
**only** component in the design system that does this, and it is rendered on every item
card. A user who has enlarged their font gets a badge that stays at 11px, at 3.55:1
(P0-6). Small *and* faint, and it is the thing telling them whether to believe the price.

### Root at 24px: what actually breaks

The brief asked for this specifically. Setting the browser root to 24px (1.5×):

1. **Nothing clips in the buttons.** `Button.tsx:27-29` uses fixed `h-10`/`h-12`/`h-14`
   with `rem` text: `text-lg` at 1.5× is 27px with a 42px line box inside `h-14` (56px).
   Tight, but it holds. `Input.tsx:25` (`h-12`, `text-body` → 33px line box in 48px) holds.
2. **`SearchField` clips at ~26px root, not 24.** `SearchField.tsx:38` is `h-9` (36px) with
   `overflow-hidden`; `text-body` (`1.0625rem`) at 24px root is 25.5px with a ~33px line
   box. It survives 24px and fails around 26px. Reporting the real threshold rather than
   the alarming one.
3. **Truncation is the actual break.** `ItemCard.tsx:145` and `:147` (`truncate` on the
   item name and the price), `ListRow.tsx:45`, `SheetPicker.tsx:74` and `:102`. At 1.5×
   these ellipsise. SC 1.4.4 requires no loss of content on resize — an ellipsised price
   is loss of exactly the content the app exists to deliver. `ItemCard`'s comment at
   `:130-136` claims the row "stays compact when Dynamic Type scales it up"; it stays
   compact by discarding the text.
4. **The peek detent hides the search field.** `BottomSheet.tsx:15` sets
   `peek: 0.20` — 133px on a 667px viewport. The sheet header (`page.tsx:579-626`: logo
   row + optional clear-search row + `SearchField`) is ~110px at 1× and ~150px+ at 1.5×.
   At 24px root the search field is below the peek fold. Recoverable by dragging, but the
   app's opening state no longer shows its primary control.
5. **The sixteen `text-[Npx]` labels do not move at all** — P1-7. The setting appears
   broken rather than partial: some text grows, some doesn't, and the layout tears at the
   seam between them.

Note that **page zoom** (Ctrl+`+`) scales `px` too, so 1.4.4 is satisfiable on desktop
despite P1-7. On mobile, P0-3 removed the equivalent — **fixed 2026-07-17, so this compounding no longer holds**; P1-7 stands alone. The two defects compounded: the `px`
labels can only be enlarged by zoom, and zoom is disabled.

---

## 7. Colour as the sole signal — SC 1.4.1

`StatusBadge.tsx:36-54` is correct, and its docstring's claim holds:

```tsx
<span className={`inline-flex items-center gap-1.5 ... ${s.bg} ${s.fg}`}>
  <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
  {children}
</span>
```

Every badge carries a text label. `ItemCard.tsx:151` passes `STATUS_LABEL[status]`.
`ReportPriceSheet.tsx:145-160` and `ConfirmVisitSheet.tsx:314-330` pair each dot with a
label *and* `aria-pressed`. The claim survives greyscale. Two places break it.

### Map markers — colour only

`MapboxAdapter.ts:277-287`. Confirmed / caution / unavailable / neutral differ **only** by
`bg-status-{kind}`. The `<svg>` pin at `:290-295` is identical in all four branches. So:

- A deuteranope cannot distinguish the confirmed marker from the caution marker — Apple's
  systemGreen `#34C759` and systemRed `#FF3B30` are a textbook confusable pair.
- The colours are also close in **luminance** (relative luminance 0.457 green vs 0.213 red
  vs 0.483 orange), so greyscale does not separate them either.
- A screen reader gets nothing at all (P0-4).

The status of a price is the entire point of the product. On the map surface it is encoded
in hue alone. Shape, glyph, or a numeric badge would carry it — as `StatusBadge` already
does everywhere else.

### `StatusDot` standalone

`StatusBadge.tsx:25-34` exports `StatusDot` with no label. `page.tsx:558` uses it bare:

```tsx
<StatusDot kind="confirmed" pulse />
<span className="text-footnote font-medium text-text-primary">Showing {selectedAreaName}</span>
```

The adjacent text is the area name, not the status. `page.tsx:647` is the same shape. Not
a 1.4.1 failure in the strict sense — the dot doesn't clearly convey information beyond
decoration here — but it is the labelled component being used unlabelled, which is how the
invariant erodes. `StatusDot` also has no `aria-hidden`, so it leaks into the tree.

---

## 8. Recommended order

1. **P0-2** — `ModalSheet` focus thrash. The contribution flow is closed to keyboard.
   One-line fix at `ModalSheet.tsx:63` (drop `onKeyDown` from the deps and read `onClose`
   through a ref), plus `data-autofocus` at `:56` while you're there.
2. **P0-1** — delete `focus-visible:outline-none` from `Button.tsx:18`. One word.
3. ~~**P0-3**~~ — **DONE 2026-07-17.** `maximumScale`/`userScalable` deleted from `layout.tsx`. **It was not a product call.** `git log -S userScalable` puts the line in the INITIAL COMMIT, and it was the only non-obvious line in that file with no justifying comment. Nobody chose it.
   **The remediation as written was also incomplete, and would have shipped a no-op.** Deleting the viewport lock buys nothing on its own: `touch-action` overrides it. The map canvas is `touch-action: none` from Mapbox's own v3.1.2 stylesheet, and `BottomSheet` was `pan-y` — which excludes `pinch-zoom` (`manipulation` is *defined* as `pan-x pan-y pinch-zoom`; the definition would be redundant otherwise). Between them: the whole viewport. The real fix is `BottomSheet.tsx` → `pan-y pinch-zoom`, done in the same change. Verified in-browser: the "E sure" badge's touch-action chain now reads `pan-y pinch-zoom`.
4. **P0-4** — markers get `role="button"`, `tabindex="0"`, `aria-label`, a `keydown`
   handler, `aria-hidden` on the svg, and 44×44. Same edit fixes P0-7's marker case and
   the colour-only encoding.
5. **P0-8** — replace `page.tsx:837-851` with `StatusBadge`. Deletes a hand-rolled copy.
6. **P0-6 / P0-7** — retune `-fg` per backing surface; make `on-status` per-hue.
7. **P0-5** — raise `text-secondary` alpha. `0.75` clears every surface in light.
8. **P1-1** — remove `focus:outline-none` from `Input.tsx:25` / `SearchField.tsx:50`.
9. **P1-2**, **P1-8**, **P1-3**, **P1-5** — naming and structure. Cheap, mechanical.
10. **P1-6 / P1-7 / P1-4** — tertiary contrast, the `px` labels, the 44pt sweep.

---

## Blockers — things I could not decide or verify

- **`userScalable: false` is a product decision.** Someone chose it, presumably to stop
  double-tap zoom fighting the map. Removing it is the only way to pass 1.4.4, and Mapbox
  does not need it. Not mine to take.
- **Apple fidelity vs. WCAG on `text-secondary`.** `rgba(60,60,67,0.60)` *is*
  `secondaryLabel`. Fixing 1.4.3 means deviating from the palette the whole design system
  is built to transcribe. That is a values call.
- **`text-onStatus` cannot be one value.** Black passes on green/orange (9.47/9.55) and
  fails the spirit on red/blue (4.55/5.22 — technically passing, but a jarring pair).
  Per-hue ink or darker hues; either changes the visual language.
- **Text over live map material is unverified.** `page.tsx:557`/`:565`. The maths says it
  is fine; confirming needs a screenshot pass over real Festac tiles in both themes.
- **No AT testing was performed.** Every screen-reader claim here is derived from the
  markup, not from VoiceOver/NVDA/TalkBack. The DOM-level facts (no name, no role, no
  tabindex) are certain; the announced-string predictions are inference.
- **Contrast of the Mapbox basemap itself** (street labels, road fills) is Mapbox's
  `streets-v12` / `dark-v11` and outside this codebase.
