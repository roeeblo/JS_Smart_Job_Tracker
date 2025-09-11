/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui"],
        mono: ["JetBrains Mono", "ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      colors: {
        primary: {
          50: "#ECFEFF",
          100: "#CFFAFE",
          200: "#A5F3FC",
          300: "#67E8F9",
          400: "#22D3EE",
          500: "#06B6D4",
          600: "#0891B2",
          700: "#0E7490",
          800: "#155E75",
          900: "#164E63",
          DEFAULT: "#06B6D4",
        },
        accent: {
          DEFAULT: "#A855F7",
        },
      },
      boxShadow: {
        glow: "0 0 0 1px rgba(6,182,212,0.3), 0 0 24px rgba(168,85,247,0.25)",
        "glow-soft": "0 0 0 1px rgba(6,182,212,0.2), 0 0 12px rgba(168,85,247,0.15)",
      },
      borderRadius: {
        "2xl": "1rem",
      },
      keyframes: {
        "sheen": {
          "0%": { transform: "translateX(-100%)" },
          "100%": { transform: "translateX(200%)" },
        },
      },
      animation: {
        sheen: "sheen 1.8s linear infinite",
      },
      backgroundImage: {
        "grid-slim":
          "linear-gradient(rgba(148,163,184,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,0.08) 1px, transparent 1px)",
      },
    },
  },
  plugins: [],
};
