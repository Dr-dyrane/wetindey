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
                /**
                 * NO focus outline-none HERE. `focus:bg-surface` is the fill lift
                 * and it stays — but it cannot be the only cue: `fillTertiary` is
                 * `rgba(118,118,128,0.12)`, which over `#FFFFFF` composites to
                 * `(239,239,240)`, so the lift to solid white is **1.15:1**. SC
                 * 1.4.11 asks 3:1 of a focus indicator. iOS ships the same lift and
                 * gets away with it by pairing it with a blinking caret and a
                 * keyboard sliding up the screen; the web has neither.
                 *
                 * This is the price field — the app's only write path. A
                 * contributor typing a number could not see where they were.
                 *
                 * Unlike `SearchField`, the ring goes on the input itself: this one
                 * is not inside an `overflow-hidden` box, so nothing clips it.
                 * `transition-colors` (not `-all`) leaves `outline` alone, so the
                 * ring appears rather than fading in — see `Button.tsx`.
                 *
                 * `docs/ACCESSIBILITY.md` P1-1.
                 */
                "w-full h-12 bg-fillTertiary text-text-primary squircle text-body transition-colors duration-micro placeholder:text-text-tertiary focus:bg-surface disabled:opacity-50",
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
