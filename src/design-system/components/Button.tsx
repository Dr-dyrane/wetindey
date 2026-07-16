import React from "react";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "danger" | "ghost";
  size?: "sm" | "md" | "lg";
  isLoading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", isLoading, children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={twMerge(
          clsx(
            "inline-flex items-center justify-center font-medium transition-colors duration-micro ease-decelerate rounded-button focus-visible:outline-none disabled:opacity-50 disabled:pointer-events-none active:scale-[0.98]",
            {
              // Variants
              "bg-accent hover:bg-accent/90 active:bg-accent-pressed text-white shadow-sm": variant === "primary",
              "bg-surface border border-separator text-text-primary hover:bg-background": variant === "secondary",
              "bg-status-unavailable text-white hover:bg-status-unavailable/90": variant === "danger",
              "bg-transparent text-text-secondary hover:text-text-primary hover:bg-background": variant === "ghost",

              // Sizes
              "h-9 px-3 text-sm": size === "sm",
              "h-11 px-4 text-base": size === "md",
              "h-12 px-6 text-lg": size === "lg",
            },
            className
          )
        )}
        {...props}
      >
        {isLoading ? (
          <span className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
        ) : null}
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";
