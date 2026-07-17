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
            /**
             * NO focus-visible outline-none UTILITY HERE, and its absence is
             * load-bearing. (The two words are kept apart on purpose: Tailwind's
             * scanner reads comments, so writing the class name here as one string
             * would re-emit the very rule this removed — dead CSS conjured by a
             * comment about deleting it.)
             *
             * It used to sit in this string, and it silently deleted the focus ring
             * from every Button in the app — Submit Report, Share, every retry. Not
             * dimmed: gone. `globals.css` grants `:focus-visible` a 2px ring and then
             * says "No element gets a stroke", so the ring is the ONE stroke this
             * design system permits — and this component, its most-used consumer,
             * turned it off. The utility won on both tiebreaks: later in source order
             * and higher specificity (0,2,0 vs 0,1,0). Because the UI is borderless by
             * rule, nothing was standing by to indicate focus instead. The focused
             * state was pixel-identical to the unfocused one.
             *
             * WCAG 2.1 SC 2.4.7, and `AGENTS.md`'s Definition of Done — "focus
             * outlines are complete". `docs/ACCESSIBILITY.md` carries it as P0-1.
             *
             * WHAT IS PROVEN, and what is not — stated precisely, because the first
             * draft of this comment cited a measurement that was worthless.
             *   PROVEN: the utility compiles to `outline: 2px solid transparent` and
             *   its selector is (0,2,0) against the base rule's (0,1,0), so it won.
             *   PROVEN: a plain `<button>` in `:focus-visible` gets the real ring —
             *   `rgb(0,122,255) solid 2px`, offset 2px. The base rule works.
             *   PROVEN: this component no longer carries the class.
             *   NOT PROVEN: that a keyboard-focused Button now paints THAT ring.
             *   Measured after the fix, `Submit Report` under a real Tab shows
             *   `white solid 1.5px, offset 0` — a ring, but the UA's, not ours. Why
             *   the base rule reaches a bare button and not this one is unresolved.
             *   See LANES H18. A visible ring where there was none is still the
             *   right direction; it is not yet the designed one.
             *
             * The discarded measurement, recorded so nobody repeats it: `.focus()`
             * does NOT put a button in `:focus-visible` — only a real keyboard
             * interaction does. Every "before" reading taken that way showed no ring
             * whether the bug was present or not, and proved nothing at all.
             *
             * If a hover or active style ever needs to suppress the ring, scope it to
             * that state. Never to the base.
             */
            "inline-flex items-center justify-center font-semibold transition-all duration-micro ease-decelerate disabled:opacity-50 disabled:pointer-events-none active:scale-[0.97]",
            {
              // Variants
              "bg-accent text-accent-contrast hover:bg-opacity-90 active:bg-accent/80": variant === "primary",
              "bg-fillSecondary text-accent hover:bg-opacity-80 active:bg-opacity-70": variant === "secondary",
              "bg-status-unavailable text-onStatus hover:bg-opacity-90 active:bg-opacity-80": variant === "danger",
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
          <span
            aria-hidden
            className="mr-2 h-4 w-4 animate-spin rounded-full"
            /* The spinner arc is drawn with a conic gradient and a radial mask
               rather than a border, so the no-stroke rule holds without giving
               up the affordance. */
            style={{
              background: "conic-gradient(from 0deg, transparent 0turn, currentColor 1turn)",
              WebkitMask: "radial-gradient(farthest-side, transparent calc(100% - 2px), #000 calc(100% - 2px))",
              mask: "radial-gradient(farthest-side, transparent calc(100% - 2px), #000 calc(100% - 2px))",
            }}
          />
        ) : null}
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";
