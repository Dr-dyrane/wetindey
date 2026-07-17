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
 * The card now wears what the real row wears — same surface and its elevated
 * dark pair, same card radius, same shadow — because a placeholder's whole job
 * is to be the shape that arrives. Matching it is also what picks the colour:
 * a skeleton has no palette of its own to invent.
 *
 * The internals are still an approximation of that row rather than a trace of
 * it: the real one is a horizontal flex with a leading icon, this is a vertical
 * stack. It is the right height, so nothing shoves on arrival, but it is not
 * the same box. `ItemCardSkeleton` below does trace its counterpart properly —
 * that is the standard this should meet. LANES H33.
 *
 * Not exported: `CardListSkeleton` below is the only caller, and a lone card is
 * not a state any list wants — the list is what a caller needs.
 */
function OfferCardSkeleton() {
  return (
    <div className="p-4 squircle-card bg-surface dark:bg-surface-elevated shadow-card space-y-4">
      <div className="flex items-start justify-between">
        <div className="space-y-2 flex-1">
          {/* Place title skeleton */}
          <Skeleton variant="text" textVariant="title2" className="w-1/2" />
          {/* Distance metadata skeleton */}
          <Skeleton variant="text" textVariant="caption" className="w-1/4" />
        </div>
        {/* Freshness status pill skeleton */}
        <Skeleton variant="rectangular" className="h-6 w-20 rounded-full" />
      </div>

      <div className="flex items-baseline justify-between pt-1">
        {/* Price display skeleton */}
        <Skeleton variant="text" textVariant="display" className="w-1/3 h-8" />
        {/* Price type tag skeleton */}
        <Skeleton variant="text" textVariant="caption" className="w-16" />
      </div>

      <div className="pt-2 flex items-center justify-between">
        {/* Confidence scale skeleton */}
        <Skeleton variant="text" textVariant="footnote" className="w-1/4 mb-0" />
        {/* Source tag skeleton */}
        <Skeleton variant="rectangular" className="h-5 w-12" />
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
