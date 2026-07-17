import React from "react";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { haptics } from "@/lib/haptics";

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
             * AND `transition`, NOT `transition-all`.
             *
             * `transition-all` transitions `outline-color`, `-width` and `-offset`,
             * so the ring FADES IN over `duration-micro` rather than appearing. For
             * those 160ms it sits at its from-value — a 1.5px `currentColor` hairline
             * at offset 0, which on `bg-accent` is white on blue and invisible —
             * before reaching `#007AFF 2px` at 2px offset. It DOES arrive. It is
             * simply animated, and an animated focus indicator is not one; it also
             * ignores `prefers-reduced-motion`.
             *
             * Plain `transition` names an explicit property list that excludes
             * `outline`, so the ring lands instantly. `transform` is in that list, so
             * `active:scale-[0.97]` still animates.
             *
             * RULE: never `transition-all`, nor a bare `duration-*`, on a focusable
             * element — `transition-duration` with no `transition-property` defaults
             * to `all`.
             *
             * Two corrections, kept because the errors are the useful part. An
             * earlier version of this comment said the ring "never arrives"; that was
             * the FIRST FRAME of a 160ms animation, read as a resting state, and a
             * refuter disproved it by forcing the transition to `.finish()` and
             * watching it land on the target. It also resolves the old LANES H18.
             * And before that: `.focus()` does NOT put a button in `:focus-visible` —
             * only a real keyboard interaction does — so every reading taken that way
             * showed no ring whether the bug was present or not.
             *
             * If a hover or active style ever needs to suppress the ring, scope it to
             * that state. Never to the base.
             */
            "inline-flex items-center justify-center font-semibold transition duration-micro ease-decelerate disabled:opacity-50 disabled:pointer-events-none active:scale-[0.97]",
            {
              /**
               * Press is an opacity utility. The old `bg-opacity` / slash-tint
               * classes never worked, and the reason is structural: every colour in
               * `tailwind.config.ts` is a bare `var(--color-*)` string, and Tailwind
               * cannot apply slash-opacity to a bare `var()` — so the `/80` candidate
               * was rejected outright and never compiled, while the hover rule DID
               * compile and set an opacity variable nothing reads. Four variants
               * looked styled and were one.
               *
               * `active:opacity-*` is the house pattern — 16 other controls use it and
               * it emits a real `opacity` rule. Re-tinting the fill instead needs the
               * tokens taught an `<alpha-value>` channel form: a design-system change,
               * not this bug fix. (`--color-accent-pressed` exists and would work, but
               * only `accent` has one — using it would split the press language.)
               *
               * 60 for text-only and non-accent fills, 80 for accent fills: that is
               * what the other 16 do. `ghost` keeps `hover:bg-fillSecondary` — a real
               * background swap, and the one hover here that ever worked.
               *
               * Class names are described, not spelled: Tailwind's scanner reads
               * comments and would re-emit what this deletes.
               */
              "bg-accent text-accent-contrast active:opacity-80": variant === "primary",
              "bg-fillSecondary text-accent active:opacity-60": variant === "secondary",
              "bg-status-unavailable text-onStatus active:opacity-80": variant === "danger",
              "bg-transparent text-accent hover:bg-fillSecondary active:opacity-60": variant === "ghost",

              // Sizes
              "h-10 px-4 text-sm squircle": size === "sm",
              "h-12 px-5 text-base squircle": size === "md",
              "h-14 px-6 text-lg squircle": size === "lg",
            },
            className
          )
        )}
        onPointerDown={(e) => {
          if (props.onPointerDown) props.onPointerDown(e);
          if (e.pointerType === "touch") {
            haptics.impact();
          }
        }}
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
