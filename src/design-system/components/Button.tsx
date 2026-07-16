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
            "inline-flex items-center justify-center font-semibold transition-all duration-micro ease-decelerate focus-visible:outline-none disabled:opacity-50 disabled:pointer-events-none active:scale-[0.97]",
            {
              // Variants
              "bg-accent text-white hover:bg-opacity-90 active:bg-accent/80": variant === "primary",
              "bg-fillSecondary text-accent hover:bg-opacity-80 active:bg-opacity-70": variant === "secondary",
              "bg-status-unavailable text-white hover:bg-opacity-90 active:bg-opacity-80": variant === "danger",
              "bg-transparent text-accent hover:bg-fillSecondary active:bg-opacity-80": variant === "ghost",

              // Sizes
              "h-10 px-4 text-sm squircle": size === "sm",
              "h-12 px-5 text-base squircle": size === "md",
              "h-14 px-6 text-lg squircle": size === "lg",
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
