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
            "bg-surface text-text-primary rounded-[24px] border-0 transition-all duration-standard overflow-hidden",
            {
              "shadow-none bg-fillSecondary/65": variant === "flat",
              "shadow-sm hover:shadow-md bg-surface/90 backdrop-blur-sm": variant === "elevated" || hoverable,
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
