import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  /**
   * `src/integrations` is here because MapboxAdapter builds its marker elements
   * with `el.className = "..."`, and a class Tailwind never scans is a class
   * Tailwind never emits. It was missing, so the place markers' `shadow-md`,
   * `hover:scale-105` and `active:scale-95` resolved to nothing: every pin on
   * the map has been flat and unresponsive to press since it was written, with
   * no error anywhere. Their `h-9` / `bg-status-confirmed` only ever worked by
   * coincidence — some scanned file happened to use the same class — and would
   * have broken silently the day that unrelated usage was deleted.
   *
   * The rule this encodes: any directory that names a Tailwind class in a string
   * belongs in this list, not just the ones that look like UI.
   */
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/design-system/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/modules/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/integrations/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        page: "var(--color-page)",
        background: "var(--color-background)",
        surface: {
          DEFAULT: "var(--color-surface)",
          persistent: "var(--color-surface-persistent)",
          modal: "var(--color-surface-modal)",
          pushed: "var(--color-surface-pushed)",
          card: "var(--color-surface-card)",
          elevated: "var(--color-surface-elevated)",
          sunken: "var(--color-surface-sunken)",
        },
        controlFill: "var(--color-control-fill)",
        island: "var(--color-island)",
        text: {
          primary: "var(--color-text-primary)",
          secondary: "var(--color-text-secondary)",
          tertiary: "var(--color-text-tertiary)",
          quaternary: "var(--color-text-quaternary)",
        },
        accent: {
          DEFAULT: "var(--color-accent)",
          pressed: "var(--color-accent-pressed)",
          contrast: "var(--color-accent-contrast)",
        },
        onStatus: "var(--color-on-status)",
        scrim: "var(--color-scrim)",
        dim: "var(--color-dim)",
        iconOrb: {
          DEFAULT: "var(--color-icon-orb)",
          ink: "var(--color-icon-orb-ink)",
        },
        domain: {
          food: "var(--color-domain-food)",
          "food-bg": "var(--color-domain-food-bg)",
          "food-orb": "var(--color-domain-food-orb)",
          "food-orb-ink": "var(--color-domain-food-orb-ink)",
          money: "var(--color-domain-money)",
          "money-bg": "var(--color-domain-money-bg)",
          "money-orb": "var(--color-domain-money-orb)",
          "money-orb-ink": "var(--color-domain-money-orb-ink)",
        },
        rating: {
          DEFAULT: "var(--color-rating)",
          bg: "var(--color-rating-bg)",
          muted: "var(--color-rating-muted)",
          orb: "var(--color-rating-orb)",
          "orb-ink": "var(--color-rating-orb-ink)",
        },
        status: {
          confirmed: "var(--color-status-confirmed)",
          "confirmed-bg": "var(--color-status-confirmed-bg)",
          "confirmed-fg": "var(--color-status-confirmed-fg)",
          "confirmed-orb": "var(--color-status-confirmed-orb)",
          "confirmed-orb-ink": "var(--color-status-confirmed-orb-ink)",
          caution: "var(--color-status-caution)",
          "caution-bg": "var(--color-status-caution-bg)",
          "caution-fg": "var(--color-status-caution-fg)",
          "caution-orb": "var(--color-status-caution-orb)",
          "caution-orb-ink": "var(--color-status-caution-orb-ink)",
          unavailable: "var(--color-status-unavailable)",
          "unavailable-bg": "var(--color-status-unavailable-bg)",
          "unavailable-fg": "var(--color-status-unavailable-fg)",
          "unavailable-orb": "var(--color-status-unavailable-orb)",
          "unavailable-orb-ink": "var(--color-status-unavailable-orb-ink)",
          info: "var(--color-status-info)",
          "info-bg": "var(--color-status-info-bg)",
          "info-fg": "var(--color-status-info-fg)",
          "info-orb": "var(--color-status-info-orb)",
          "info-orb-ink": "var(--color-status-info-orb-ink)",
        },
        focusRing: "var(--color-focus-ring)",
        fillPrimary: "var(--color-fill-primary)",
        fillSecondary: "var(--color-fill-secondary)",
        fillTertiary: "var(--color-fill-tertiary)",
        fillQuaternary: "var(--color-fill-quaternary)",
      },

      /**
       * The iOS type ramp at Large (default) Dynamic Type, verbatim from HIG.
       * This is one of the few parts of iOS Apple documents numerically, so it
       * is transcribed rather than invented. Headline is the only semibold.
       * https://developer.apple.com/design/human-interface-guidelines/typography
       */
      /**
       * The iOS type ramp at Large (default) Dynamic Type, from HIG — one of the
       * few parts of iOS Apple documents numerically, so transcribed rather than
       * invented. Headline is the only semibold in the ramp.
       *
       * Expressed in rem, NOT px. This is the web's Dynamic Type: rem scales
       * with the reader's browser font-size setting, px ignores it outright. A
       * px ramp means someone who has enlarged their system font gets no change
       * at all — the accessibility setting silently does nothing. Divide by 16
       * to read these as points: 1.0625rem = 17pt.
       *
       * https://developer.apple.com/design/human-interface-guidelines/typography
       */
      fontSize: {
        "large-title": [
          "2.125rem",
          { lineHeight: "2.5625rem", letterSpacing: "0.023em" },
        ] /* 34 / 41 */,
        "title-1": ["1.75rem", { lineHeight: "2.125rem", letterSpacing: "0.013em" }] /* 28 / 34 */,
        "title-2": ["1.375rem", { lineHeight: "1.75rem", letterSpacing: "0.016em" }] /* 22 / 28 */,
        "title-3": ["1.25rem", { lineHeight: "1.5625rem", letterSpacing: "0.019em" }] /* 20 / 25 */,
        headline: [
          "1.0625rem",
          { lineHeight: "1.375rem", letterSpacing: "-0.024em", fontWeight: "600" },
        ] /* 17 / 22 */,
        body: ["1.0625rem", { lineHeight: "1.375rem", letterSpacing: "-0.024em" }] /* 17 / 22 */,
        callout: ["1rem", { lineHeight: "1.3125rem", letterSpacing: "-0.02em" }] /* 16 / 21 */,
        subhead: ["0.9375rem", { lineHeight: "1.25rem", letterSpacing: "-0.016em" }] /* 15 / 20 */,
        footnote: [
          "0.8125rem",
          { lineHeight: "1.125rem", letterSpacing: "-0.006em" },
        ] /* 13 / 18 */,
        "caption-1": ["0.75rem", { lineHeight: "1rem", letterSpacing: "0em" }] /* 12 / 16 */,
        "caption-2": [
          "0.6875rem",
          { lineHeight: "0.8125rem", letterSpacing: "0.006em" },
        ] /* 11 / 13 */,
      },

      spacing: {
        /** HIG: 44x44pt is the default control size. 28 is the a11y floor. */
        tap: "44px",
        /** Root side margin at compact width (community-measured, not published). */
        margin: "16px",
        /** ADR-018 glyph sizes. The containing control, never the glyph, owns
         * the 44px interaction target. */
        "icon-compact": "16px",
        "icon-standard": "18px",
        "icon-prominent": "24px",
      },

      boxShadow: {
        card: "var(--shadow-card)",
        raised: "var(--shadow-raised)",
        sheet: "var(--shadow-sheet)",
        island: "var(--shadow-island)",
      },

      transitionDuration: {
        /* Legacy aliases stay until their callers migrate; all resolve through
           the shared CSS token surface rather than private literal values. */
        instant: "var(--motion-duration-instant)",
        micro: "var(--motion-duration-fast)",
        standard: "var(--motion-duration-standard)",
        sheet: "var(--motion-duration-slow)",
        map: "var(--motion-duration-deliberate)",
        "ultra-fast": "var(--motion-duration-ultra-fast)",
        fast: "var(--motion-duration-fast)",
        slow: "var(--motion-duration-slow)",
        deliberate: "var(--motion-duration-deliberate)",
        continuous: "var(--motion-duration-continuous)",
      },
      transitionTimingFunction: {
        decelerate: "var(--motion-ease-decelerate)",
        accelerate: "var(--motion-ease-accelerate)",
        standard: "var(--motion-ease-standard)",
        /**
         * Apple's sheet curve. It does NOT overshoot, despite the name: both y
         * control points (0.72, 1.0) sit inside [0,1], so it is monotonic and
         * settles from below. It reads as a spring because it leaves fast and
         * arrives slowly, not because it bounces.
         *
         * Do not "fix" it to actually overshoot. BottomSheet transitions
         * border-radius on this curve, and a y > 1 control point drives the
         * interpolated value past its endpoint mid-settle.
         */
        spring: "var(--motion-ease-emphasized)",
      },
      fontFamily: {
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          '"SF Pro Text"',
          '"Segoe UI"',
          "Roboto",
          '"Helvetica Neue"',
          "Arial",
          "sans-serif",
        ],
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
