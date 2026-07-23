import React from "react";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: string;
  icon?: React.ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type = "text", error, icon, ...props }, ref) => {
    /**
     * The error paragraph is invisible to assistive tech unless the input
     * points at it: colour alone fails SC 3.3.1, and this is the price field,
     * the app's only write path. `aria-describedby` merges with anything the
     * caller passed rather than replacing it.
     */
    const errorId = React.useId();
    const describedBy =
      [error ? errorId : undefined, props["aria-describedby"]].filter(Boolean).join(" ") ||
      undefined;
    return (
      <div className="w-full">
        <div className="relative flex items-center">
          {icon && (
            <div className="pointer-events-none absolute left-4 text-text-tertiary">{icon}</div>
          )}
          <input
            type={type}
            ref={ref}
            className={twMerge(
              clsx(
                /**
                 * NO focus outline-none HERE. `focus:bg-surface-card` is the fill lift
                 * and it stays — but it cannot be the only cue: control fill is
                 * deliberately close to a surface, so the lift alone is below SC
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
                "squircle h-12 w-full bg-controlFill text-body text-text-primary transition-colors duration-micro placeholder:text-text-tertiary focus:bg-surface-card disabled:opacity-50",
                {
                  "pl-12 pr-4": icon,
                  "px-4": !icon,
                  "bg-status-unavailable-bg text-status-unavailable-fg": error,
                }
              ),
              className
            )}
            {...props}
            /* After the spread: the merged description must win over the raw
               consumer value it already includes, and the invalid state must
               not be spread away. */
            aria-invalid={error ? true : props["aria-invalid"]}
            aria-describedby={describedBy}
          />
        </div>
        {error && (
          <p id={errorId} role="alert" className="mt-1 text-xs font-medium text-status-unavailable">
            {error}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = "Input";
