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
          "bg-text-tertiary/10 dark:bg-text-secondary/10 animate-pulse",
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

// Custom Hi-fi Card Skeleton representing a resolved location/offer
export function OfferCardSkeleton() {
  return (
    <div className="p-4 squircle-lg bg-fillSecondary/40 space-y-4">
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

export function CardListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <OfferCardSkeleton key={i} />
      ))}
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
 */
export function ItemCardSkeleton() {
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
          <span className="inline-flex animate-pulse items-center rounded-full bg-text-tertiary/10 px-2 py-0.5 text-caption-2 dark:bg-text-secondary/10">
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

/**
 * Placeholder for a ListRow-height row (search suggestions, area pickers).
 * A tap target's worth of surface, nothing more — these rows carry one line.
 */
export function ListRowSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div aria-hidden className="space-y-2">
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} className="h-tap w-full" />
      ))}
    </div>
  );
}
