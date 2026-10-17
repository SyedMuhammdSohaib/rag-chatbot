import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      // Colours come from CSS variables (see globals.css) so the light and
      // dark themes can swap them; written as RGB channels so opacity
      // modifiers like bg-panel/40 keep working.
      colors: {
        ink: {
          DEFAULT: "rgb(var(--ink) / <alpha-value>)", // text on brass buttons
          soft: "rgb(var(--ink-soft) / <alpha-value>)",
        },
        panel: "rgb(var(--panel) / <alpha-value>)", // sidebar / app background
        surface: "rgb(var(--surface) / <alpha-value>)", // chat surface
        parchment: "rgb(var(--parchment) / <alpha-value>)", // primary text
        parchmentDim: "rgb(var(--parchment-dim) / <alpha-value>)",
        brass: "rgb(var(--brass) / <alpha-value>)", // single accent: aged brass/gilding
        brassSoft: "rgb(var(--brass-soft) / <alpha-value>)",
        line: "rgb(var(--line) / <alpha-value>)",
        error: "rgb(var(--error) / <alpha-value>)",
      },
      fontFamily: {
        serif: ["'Source Serif 4'", "Georgia", "serif"],
        sans: ["'IBM Plex Sans'", "system-ui", "sans-serif"],
      },
      maxWidth: {
        prose: "68ch",
      },
    },
  },
  plugins: [],
};

export default config;
