import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        surface: "var(--surface)",
        secondary: "var(--surface-secondary)",
        field: "var(--field)",
        foreground: "var(--foreground)",
        muted: "var(--muted)",
        dim: "var(--dim)",
        brand: "var(--brand)",
        primary: "var(--primary)",
        accent: "var(--accent)",
        success: "var(--success)",
        warning: "var(--warning)",
        danger: "var(--danger)",
        border: "var(--border)",
        ring: "var(--ring)",
      },
      // The iktva look uses tight, squared corners everywhere.
      borderRadius: {
        DEFAULT: "4px",
        md: "4px",
        lg: "6px",
        xl: "6px",
        "2xl": "8px",
      },
      boxShadow: {
        panel: "var(--shadow-panel)",
      },
      fontFamily: {
        sans: ["Montserrat", "sans-serif"],
        mono: ["Montserrat", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
