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
        material: {
          thick: "var(--color-material-thick)",
          regular: "var(--color-material-regular)",
        },
        text: {
          primary: "var(--color-text-primary)",
          secondary: "var(--color-text-secondary)",
          tertiary: "var(--color-text-tertiary)",
          quaternary: "var(--color-text-quaternary)",
        },
        separator: {
          DEFAULT: "var(--color-separator)",
          opaque: "var(--color-separator-opaque)",
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
      },
      boxShadow: {
        card: "var(--shadow-card)",
        raised: "var(--shadow-raised)",
        sheet: "var(--shadow-sheet)",
        island: "var(--shadow-island)",
      },
      // Tailwind's stock default ring is blue-500. These tokens bake their own
      // alpha (they hold Apple's spec values verbatim), so an opacity modifier
      // like `ring-separator/60` emits invalid CSS and silently falls back to
      // that blue. Defaulting to the separator keeps any such slip neutral.
      ringColor: {
        DEFAULT: "var(--color-separator)",
      },
      ringOffsetColor: {
        DEFAULT: "var(--color-background)",
      },
      borderRadius: {
        control: "10px",
        input: "12px",
        button: "12px",
        card: "16px",
        sheet: "24px",
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
      },
      fontFamily: {
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          '"Segoe UI"',
          "Roboto",
          "Helvetica",
          "Arial",
          "sans-serif",
        ],
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
