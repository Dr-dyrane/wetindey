import React from "react";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: string;
  icon?: React.ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type = "text", error, icon, ...props }, ref) => {
    return (
      <div className="w-full">
        <div className="relative flex items-center">
          {icon && (
            <div className="absolute left-4 text-text-tertiary pointer-events-none">
              {icon}
            </div>
          )}
          <input
            type={type}
            ref={ref}
            className={twMerge(
              clsx(
                "w-full h-12 bg-fillTertiary text-text-primary squircle text-body transition-colors duration-micro placeholder:text-text-tertiary focus:outline-none focus:bg-surface disabled:opacity-50",
                {
                  "pl-12 pr-4": icon,
                  "px-4": !icon,
                  "bg-status-unavailable-bg text-status-unavailable-fg": error,
                }
              ),
              className
            )}
            {...props}
          />
        </div>
        {error && (
          <p className="mt-1 text-xs text-status-unavailable font-medium">{error}</p>
        )}
      </div>
    );
  }
);

Input.displayName = "Input";
