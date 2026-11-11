import type { Config } from "tailwindcss";

// Colours are CSS variables (see src/app/globals.css) so the material lens can
// re-theme the whole site by changing data-material on <html>.
const rgb = (v: string) => `rgb(var(${v}) / <alpha-value>)`;

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    container: { center: true, padding: "24px", screens: { "2xl": "1280px" } },
    extend: {
      colors: {
        ivory: rgb("--ivory-rgb"),
        sand: rgb("--sand-rgb"),
        line: rgb("--line-rgb"),
        ink: rgb("--ink-rgb"),
        muted: rgb("--muted-rgb"),
        accent: { DEFAULT: rgb("--accent-rgb"), light: rgb("--accent-light-rgb") },
        gold: { DEFAULT: "#8A6528", light: "#D9B36C" },
        silver: { DEFAULT: "#4F5862", light: "#C9CED4" },
        diamond: { DEFAULT: "#2D5873", light: "#9CC3DD" },
      },
      fontFamily: {
        display: ["var(--font-display)", "Georgia", "serif"],
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
      },
      maxWidth: { site: "1280px" },
      fontSize: {
        eyebrow: ["12.5px", { lineHeight: "1.4", letterSpacing: "0.2em" }],
        body: ["16px", { lineHeight: "1.7" }],
        lede: ["18px", { lineHeight: "1.65" }],
      },
      letterSpacing: { display: "-0.02em" },
      spacing: { section: "96px", "section-sm": "64px" },
      transitionTimingFunction: { lux: "cubic-bezier(0.22, 1, 0.36, 1)" },
      keyframes: {
        marquee: { from: { transform: "translateX(0)" }, to: { transform: "translateX(-50%)" } },
      },
      animation: { marquee: "marquee 40s linear infinite" },
    },
  },
  plugins: [],
};

export default config;
