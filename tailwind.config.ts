import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        cm: {
          yellow:    "#FFCC00",
          "yellow-soft": "#FFF8D6",
          "yellow-dark": "#CC9900",
          black:     "#141414",
          carbon:    "#1C1D1A",
          ink:       "#2B2D29",
          muted:     "#656860",
          line:      "#D8D7CF",
          paper:     "#FBFAF4",
          green:     "#27AE60",
          red:       "#C0392B",
          blue:      "#2980B9",
          orange:    "#E67E22",
        },
      },
      fontFamily: {
        sans: ["Inter", "Segoe UI", "Arial", "sans-serif"],
      },
      borderRadius: {
        DEFAULT: "8px",
      },
      animation: {
        "fade-in": "fadeIn 0.2s ease-in-out",
        "slide-in": "slideIn 0.2s ease-out",
        pulse: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
      },
      keyframes: {
        fadeIn: { "0%": { opacity: "0" }, "100%": { opacity: "1" } },
        slideIn: { "0%": { transform: "translateX(-8px)", opacity: "0" }, "100%": { transform: "translateX(0)", opacity: "1" } },
      },
    },
  },
  plugins: [],
};
export default config;
