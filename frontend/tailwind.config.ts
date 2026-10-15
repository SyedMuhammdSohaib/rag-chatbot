import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          DEFAULT: "#171B1F", // near-black, used sparingly
          soft: "#1F262C",
        },
        panel: "#12161A", // sidebar / app background
        surface: "#181D22", // chat surface
        parchment: "#E9E3D0", // primary text on dark
        parchmentDim: "#A9A290",
        brass: "#B08D57", // single accent: aged brass/gilding
        brassSoft: "#8C6F43",
        line: "#2A2F35",
        error: "#C0604A",
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
