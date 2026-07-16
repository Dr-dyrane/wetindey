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
            "bg-surface text-text-primary rounded-card border border-separator transition-all duration-standard overflow-hidden",
            {
              "shadow-none": variant === "flat",
              "shadow-sm hover:shadow-md": variant === "elevated",
              "hover:border-text-tertiary cursor-pointer": hoverable,
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
