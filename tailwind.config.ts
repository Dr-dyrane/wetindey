import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/design-system/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/modules/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--color-background)",
        surface: {
          DEFAULT: "var(--color-surface)",
          elevated: "var(--color-surface-elevated)",
          sunken: "var(--color-surface-sunken)",
        },
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
        monogramInk: "var(--color-monogram-ink)",
        status: {
          confirmed: "var(--color-status-confirmed)",
          "confirmed-bg": "var(--color-status-confirmed-bg)",
          "confirmed-fg": "var(--color-status-confirmed-fg)",
          caution: "var(--color-status-caution)",
          "caution-bg": "var(--color-status-caution-bg)",
          "caution-fg": "var(--color-status-caution-fg)",
          unavailable: "var(--color-status-unavailable)",
          "unavailable-bg": "var(--color-status-unavailable-bg)",
          "unavailable-fg": "var(--color-status-unavailable-fg)",
          info: "var(--color-status-info)",
          "info-bg": "var(--color-status-info-bg)",
          "info-fg": "var(--color-status-info-fg)",
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
        "large-title": ["2.125rem", { lineHeight: "2.5625rem", letterSpacing: "0.023em" }],   /* 34 / 41 */
        "title-1": ["1.75rem", { lineHeight: "2.125rem", letterSpacing: "0.013em" }],         /* 28 / 34 */
        "title-2": ["1.375rem", { lineHeight: "1.75rem", letterSpacing: "0.016em" }],         /* 22 / 28 */
        "title-3": ["1.25rem", { lineHeight: "1.5625rem", letterSpacing: "0.019em" }],        /* 20 / 25 */
        headline: ["1.0625rem", { lineHeight: "1.375rem", letterSpacing: "-0.024em", fontWeight: "600" }], /* 17 / 22 */
        body: ["1.0625rem", { lineHeight: "1.375rem", letterSpacing: "-0.024em" }],           /* 17 / 22 */
        callout: ["1rem", { lineHeight: "1.3125rem", letterSpacing: "-0.02em" }],             /* 16 / 21 */
        subhead: ["0.9375rem", { lineHeight: "1.25rem", letterSpacing: "-0.016em" }],         /* 15 / 20 */
        footnote: ["0.8125rem", { lineHeight: "1.125rem", letterSpacing: "-0.006em" }],       /* 13 / 18 */
        "caption-1": ["0.75rem", { lineHeight: "1rem", letterSpacing: "0em" }],               /* 12 / 16 */
        "caption-2": ["0.6875rem", { lineHeight: "0.8125rem", letterSpacing: "0.006em" }],    /* 11 / 13 */
      },

      spacing: {
        /** HIG: 44x44pt is the default control size. 28 is the a11y floor. */
        tap: "44px",
        /** Root side margin at compact width (community-measured, not published). */
        margin: "16px",
      },

      boxShadow: {
        card: "var(--shadow-card)",
        raised: "var(--shadow-raised)",
        sheet: "var(--shadow-sheet)",
        island: "var(--shadow-island)",
      },

      transitionDuration: {
        instant: "100ms",
        micro: "160ms",
        standard: "230ms",
        sheet: "330ms",
        map: "400ms",
      },
      transitionTimingFunction: {
        decelerate: "cubic-bezier(0, 0, 0.2, 1)",
        accelerate: "cubic-bezier(0.4, 0, 1, 1)",
        /** iOS sheets settle rather than ease — slight overshoot on the tail. */
        spring: "cubic-bezier(0.32, 0.72, 0, 1)",
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
