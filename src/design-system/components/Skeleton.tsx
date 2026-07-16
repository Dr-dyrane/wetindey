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
          "bg-text-tertiary/10 dark:bg-text-secondary/10 animate-pulse border-0",
          {
            "rounded-full": variant === "circular",
            "rounded-[14px]": variant === "rectangular",
            "rounded-[8px]": variant === "text",
            
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
    <div className="p-4 border-0 rounded-[24px] bg-fillSecondary/40 space-y-4">
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

      <div className="pt-2 border-0 flex items-center justify-between">
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
