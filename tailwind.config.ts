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
      fontSize: {
        "large-title": ["34px", { lineHeight: "41px", letterSpacing: "0.374px" }],
        "title-1": ["28px", { lineHeight: "34px", letterSpacing: "0.364px" }],
        "title-2": ["22px", { lineHeight: "28px", letterSpacing: "0.352px" }],
        "title-3": ["20px", { lineHeight: "25px", letterSpacing: "0.38px" }],
        headline: ["17px", { lineHeight: "22px", letterSpacing: "-0.408px", fontWeight: "600" }],
        body: ["17px", { lineHeight: "22px", letterSpacing: "-0.408px" }],
        callout: ["16px", { lineHeight: "21px", letterSpacing: "-0.32px" }],
        subhead: ["15px", { lineHeight: "20px", letterSpacing: "-0.24px" }],
        footnote: ["13px", { lineHeight: "18px", letterSpacing: "-0.078px" }],
        "caption-1": ["12px", { lineHeight: "16px", letterSpacing: "0px" }],
        "caption-2": ["11px", { lineHeight: "13px", letterSpacing: "0.066px" }],
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
