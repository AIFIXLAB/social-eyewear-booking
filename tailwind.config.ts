import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-noto-thai)", "system-ui", "sans-serif"],
      },
      colors: {
        brand: {
          50: "#eef6f1",
          100: "#d6eadd",
          200: "#acd5bb",
          500: "#2f7a52",
          600: "#1f6141",
          700: "#174d34",
          800: "#123b28",
          900: "#0c2a1c",
        },
        // status colours from the design brief
        avail: { bg: "#e7f5ec", border: "#9fd3b2", text: "#1d6b42" },
      },
      boxShadow: {
        card: "0 1px 2px rgba(16,24,20,.04), 0 4px 16px rgba(16,24,20,.06)",
      },
    },
  },
  plugins: [],
};

export default config;
