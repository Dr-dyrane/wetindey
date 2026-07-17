import React from "react";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "flat" | "elevated";
  hoverable?: boolean;
}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant = "flat", hoverable = false, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={twMerge(
          clsx(
            "text-text-primary squircle-card transition-all duration-standard overflow-hidden",
            {
              // Each variant states its own background. twMerge resolves a conflict only
              // within one modifier, so a `dark:bg-*` hoisted to the base would survive
              // `flat`'s unprefixed fill and repaint it in dark.
              "shadow-none bg-fillSecondary/65": variant === "flat",
              "shadow-card hover:shadow-raised bg-surface dark:bg-surface-elevated":
                variant === "elevated" || hoverable,
              "cursor-pointer hover:scale-[1.01] active:scale-[0.99]": hoverable,
            }
          ),
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);

Card.displayName = "Card";
