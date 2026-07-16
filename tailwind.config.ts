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
        },
        text: {
          primary: "var(--color-text-primary)",
          secondary: "var(--color-text-secondary)",
          tertiary: "var(--color-text-tertiary)",
        },
        separator: "var(--color-separator)",
        accent: {
          DEFAULT: "var(--color-accent)",
          pressed: "var(--color-accent-pressed)",
        },
        status: {
          confirmed: "var(--color-status-confirmed)",
          caution: "var(--color-status-caution)",
          unavailable: "var(--color-status-unavailable)",
          info: "var(--color-status-info)",
        },
        focusRing: "var(--color-focus-ring)",
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
  plugins: [],
};

export default config;
