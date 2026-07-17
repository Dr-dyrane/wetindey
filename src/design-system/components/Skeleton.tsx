import React from "react";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "text" | "rectangular" | "circular";
  textVariant?: "display" | "title1" | "title2" | "title3" | "body" | "footnote" | "caption";
}

export function Skeleton({
  className,
  variant = "rectangular",
  textVariant = "body",
  ...props
}: SkeletonProps) {
  return (
    <div
      className={twMerge(
        clsx(
          /**
           * A SOLID FILL TOKEN, and that it is solid is the whole fix.
           *
           * This bar used to ask for a tenth of an ink colour, plus a dark
           * variant asking for a tenth of a lighter one. Neither ever reached
           * the page. Every colour in `tailwind.config.ts` is a bare
           * `var(--color-*)` string with no `<alpha-value>` channel, so Tailwind
           * rejects the slash-opacity candidate outright and emits **no rule at
           * all** — not a faint bar, not a wrong bar, nothing. The class name
           * sat in the markup looking deliberate and compiled to absent.
           *
           * So every `Skeleton` in the app was a correctly-sized transparent
           * div, and its pulse animated the opacity of nothing. It had been that
           * way since `c73b527`, the initial design-system commit: this never
           * worked once. Same structural cause as the dead press states in
           * `Button.tsx` (LANES H20) — this is that bug's fourth sibling, and
           * `page.tsx:1249` is the fifth and last (LANES H33).
           *
           * It did not fail evenly, which is why it survived so long.
           * `ItemCardSkeleton`'s image well uses a solid token, so it always
           * rendered and always pulsed — that list looked like a working
           * skeleton with oddly empty cards. `OfferCardSkeleton` had no solid
           * token anywhere and rendered literally nothing.
           *
           * The fill tokens are the fix rather than a workaround: they are
           * ALREADY translucent greys, which is precisely what the slash was
           * reaching for, and they already flip with the theme — so the dark
           * variant this replaces is not lost, it is redundant.
           *
           * WHICH rung is the dead code's own intent, because the author did
           * say what they wanted — the request just never compiled. The slash
           * REPLACES a token's alpha rather than multiplying it, so the ask was
           * a flat 10% ink: 1.18:1 against the light card, 1.33:1 against the
           * dark one. The tertiary fill composites to 1.15:1 and 1.31:1 — the
           * closest rung on both, and about three times closer overall than the
           * secondary one, which is near enough in light (1.21:1) but overshoots
           * dark badly (1.44:1). Honouring the intent beats re-deciding it.
           *
           * The tertiary rung is also the one that cannot be mistaken for a
           * control. The secondary fill is what a real secondary Button and
           * every round close button rest at, and these marks are pills — a
           * placeholder should not wear a live control's exact fill.
           *
           * Class names are described, not spelled: Tailwind's scanner reads
           * comments, and a comment naming a class emits it.
           */
          "bg-fillTertiary animate-pulse",
          {
            "rounded-full": variant === "circular",
            squircle: variant === "rectangular" || variant === "text",

            // Map text variant sizes to match typographic system (Section 17.4)
            "h-8 w-3/4 mb-4": variant === "text" && textVariant === "display",
            "h-7 w-2/3 mb-3": variant === "text" && textVariant === "title1",
            "h-6 w-1/2 mb-2": variant === "text" && textVariant === "title2",
            "h-5 w-1/3 mb-2": variant === "text" && textVariant === "title3",
            "h-4 w-full mb-1.5": variant === "text" && textVariant === "body",
            "h-3 w-1/4 mb-1": variant === "text" && textVariant === "footnote",
            "h-2.5 w-16": variant === "text" && textVariant === "caption",
          }
        ),
        className
      )}
      {...props}
    />
  );
}

/**
 * Placeholder for the offer row in `ItemDetailSheet` — the "where can I buy
 * this" list, which is the last screen of the core loop.
 *
 * It used to render **literally nothing**. Its wrapper asked for a fraction of
 * a fill token, which emits no rule (see `Skeleton`), and every bar inside it
 * was transparent for the same reason. Three of these stack at
 * `ItemDetailSheet`'s loading branch, so tapping an item showed an empty sheet
 * until the offers arrived — indistinguishable from "nothing near you", which
 * is a real state this app has and renders three lines below.
 *
 * The card wears what the real row wears — same surface and its elevated dark
 * pair, same card radius, same shadow — because a placeholder's whole job is to
 * be the shape that arrives. Matching it is also what picks the colour: a
 * skeleton has no palette of its own to invent.
 *
 * And now it TRACES that row rather than approximating it, the way
 * `ItemCardSkeleton` below traces its own. The real row (`ItemDetailSheet.tsx`,
 * the offer list) is a three-column horizontal flex, not a vertical stack:
 *
 *   [dot]  [ name / freshness / distance · confidence ]      [ price / per-unit ]
 *   ↑ leading    ↑ min-w-0 flex-1 text column              ↑ shrink-0, right-aligned
 *
 * This used to be a `space-y-4` stack with the price in the middle, so every
 * element slid to a new position when the three offers landed. The old card was
 * 186px with its price bar on the left at center-x ~68px; this one is 98px with
 * the price bar right-aligned, its right edge landing on the real price's right
 * edge to the pixel. That ~223px sideways and ~88px vertical jump is gone.
 *
 * Heights are the type ramp's own line-heights in rem, never px, for the reason
 * `ItemCardSkeleton` gives: when a reader scales their browser font the
 * placeholder grows exactly as much as the text that replaces it. The line
 * boxes below are `headline` 1.375rem (name), `footnote` 1.125rem (freshness,
 * distance), `caption-1` 1rem (per-unit), `title-3` 1.5625rem (price). The
 * middle column is the tallest, so it sets the card height, and it matches the
 * real row to the pixel (98px both) at a typical phone width and the default
 * font. The ink bars are shorter than their line boxes because real glyphs do
 * not fill a line box either.
 *
 * WHAT IT DOES NOT DO, because I claimed it did and a refuter disproved it: the
 * height is NOT fixed against every input. The real row's third middle line is
 * distance plus `confidence.label` ("12 reports · 4 sources"), and unlike the
 * name and freshness above it, that line is NOT truncated
 * (`ItemDetailSheet.tsx`, the offer row). So under a narrow viewport (card
 * below ~320px) or large-text / browser zoom it wraps, the real row grows to
 * ~116px and beyond, and this fixed skeleton undershoots and the row shoves down
 * on arrival. The residual is far smaller than the old skeleton's, and its cause
 * is the un-truncated line in the real row, not here; a fixed-height skeleton
 * cannot predict a wrap. Truncating that line at the source removes it and is
 * filed for the auth lane. Matching the wrapped height instead would overshoot
 * the common case, which is the wrong trade.
 *
 * Not exported: `CardListSkeleton` below is the only caller, and a lone card is
 * not a state any list wants — the list is what a caller needs.
 */
function OfferCardSkeleton() {
  return (
    <div className="flex w-full items-start gap-3 bg-surface dark:bg-surface-elevated p-4 shadow-card squircle-card">
      {/* Leading status dot — StatusDot is h-2 w-2 at the same mt-[7px] offset. */}
      <span className="mt-[7px] h-2 w-2 shrink-0 animate-pulse rounded-full bg-fillTertiary" />

      {/* Text column — name, freshness, then distance + confidence. */}
      <div className="min-w-0 flex-1">
        {/* Name — headline line box */}
        <div className="flex h-[1.375rem] items-center">
          <Skeleton className="h-[0.875rem] w-1/2" />
        </div>
        {/* Freshness label — footnote line box */}
        <div className="mt-0.5 flex h-[1.125rem] items-center">
          <Skeleton className="h-[0.6875rem] w-1/3" />
        </div>
        {/* Distance + confidence — footnote line box, two marks as in the row */}
        <div className="mt-1.5 flex h-[1.125rem] items-center gap-2">
          <Skeleton className="h-[0.6875rem] w-12" />
          <Skeleton className="h-[0.6875rem] w-14" />
        </div>
      </div>

      {/* Price column — right-aligned, price over per-unit. */}
      <div className="flex shrink-0 flex-col items-end">
        {/* Price — title-3 line box, the loudest mark, so the widest bar */}
        <div className="flex h-[1.5625rem] items-center">
          <Skeleton className="h-[1.125rem] w-16" />
        </div>
        {/* per unit — caption-1 line box */}
        <div className="mt-0.5 flex h-[1rem] items-center">
          <Skeleton className="h-[0.625rem] w-10" />
        </div>
      </div>
    </div>
  );
}

/**
 * Announces itself, unlike its sibling — and the asymmetry is deliberate.
 *
 * `ItemCardListSkeleton` is only ever reached through `AsyncList`, which already
 * wraps it in a `role="status"` live region carrying the "Loading" label, so it
 * marks itself hidden to avoid speaking twice. This one is rendered directly by
 * `ItemDetailSheet`'s loading branch with no such wrapper, so if it also went
 * hidden the sheet would say nothing at all while the offers load. It carries
 * the live region itself instead.
 *
 * If this is ever passed to `AsyncList` as its `skeleton`, drop the wrapper here
 * — two nested live regions announce twice.
 */
export function CardListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div role="status" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading</span>
      {/* Gap matches the real offer list's, so rows do not jump when they land. */}
      <div aria-hidden className="space-y-2">
        {Array.from({ length: count }).map((_, i) => (
          <OfferCardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}

/**
 * Placeholder for ItemCard — the row that fills the sheet.
 *
 * This traces ItemCard's box model rather than approximating it: same
 * `items-stretch gap-3`, same 88px bleeding image well on surface-sunken, same
 * `py-2 pr-3` content column, same two subhead line boxes, same `mt-1` badge
 * row. A skeleton that is a different height than the thing it stands in for
 * shoves the list on arrival, which is a worse artefact than showing nothing.
 *
 * Heights are in rem, never px, for the same reason the type ramp is: the line
 * boxes below are the ramp's own line-heights (subhead 1.25rem, caption-1 1rem),
 * so when a reader scales their browser font the placeholder grows exactly as
 * much as the text that replaces it. A px skeleton would desync at any setting
 * but the default.
 *
 * The ink bars are deliberately shorter than their line boxes — real glyphs do
 * not fill a line box either, and a bar that does reads as a filled input.
 *
 * Not exported, for the same reason as OfferCardSkeleton: `ItemCardListSkeleton`
 * is the only caller.
 */
function ItemCardSkeleton() {
  return (
    <div
      aria-hidden
      className="flex w-full items-stretch gap-3 overflow-hidden bg-surface shadow-card squircle"
    >
      {/* Image well. Bleeds to three edges exactly as ItemCard's does, so it is
          the card that clips it — no inset, no gap, nothing to draw an edge with. */}
      <div className="w-[88px] shrink-0 self-stretch animate-pulse bg-surface-sunken" />

      <div className="min-w-0 flex-1 py-2 pr-3">
        {/* Name — subhead line box */}
        <div className="flex h-[1.25rem] items-center">
          <Skeleton className="h-[0.8125rem] w-2/5" />
        </div>
        {/* Price — subhead line box, same tier as the name in ItemCard */}
        <div className="flex h-[1.25rem] items-center">
          <Skeleton className="h-[0.8125rem] w-1/3" />
        </div>
        {/* Status badge + place count */}
        <div className="mt-1 flex items-center gap-1.5">
          {/* Solid fill token, not a fraction of an ink colour — see `Skeleton`
              above for why the fraction compiled to nothing, and why this rung.
              Same wash as the bars: one placeholder weight, not a palette. */}
          <span className="inline-flex animate-pulse items-center rounded-full bg-fillTertiary px-2 py-0.5 text-caption-2">
            {/* Sized by an invisible stand-in for the real label rather than a
                guessed width, so the pill cannot drift from StatusBadge. */}
            <span className="invisible">Confirmed</span>
          </span>
          <div className="flex h-[1rem] items-center">
            <Skeleton className="h-[0.6875rem] w-12" />
          </div>
        </div>
      </div>
    </div>
  );
}

export function ItemCardListSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div aria-hidden className="grid grid-cols-1 gap-2">
      {Array.from({ length: count }).map((_, i) => (
        <ItemCardSkeleton key={i} />
      ))}
    </div>
  );
}

/* `ListRowSkeleton` lived here — "a placeholder for a ListRow-height row (search
   suggestions, area pickers)". It had no caller anywhere, and its docstring says
   why: the area picker it was built for is AreaPickerSheet, which was deleted in
   a84efa7. LocationSheet.tsx:493-495 hand-rolls the same three `h-tap w-full`
   bars rather than importing this, so it was not even the only copy of itself.
   Deleted. If LocationSheet ever wants to stop hand-rolling them, this is four
   lines and it comes back with the import. */
