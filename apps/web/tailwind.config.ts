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
        foreground: "var(--foreground)",
        muted: "var(--muted)",
        brand: "var(--brand)",
        accent: "var(--accent)",
        success: "var(--success)",
        warning: "var(--warning)",
        danger: "var(--danger)",
        border: "var(--border)",
        ring: "var(--ring)",
      },
      boxShadow: {
        panel: "0 8px 24px rgba(28, 30, 22, 0.12)",
      },
      fontFamily: {
        sans: ["Segoe UI", "Roboto", "Helvetica Neue", "Arial", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
