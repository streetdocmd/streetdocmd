import type { Config } from "tailwindcss";
import designPreset from "./src/design/tailwind-preset";

const config: Config = {
  // Design system tokens (packages/design), light theme only
  presets: [designPreset],
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        navy: {
          50:  "#EEF2FF",
          100: "#E0E7FF",
          600: "#1E3A8A",
          700: "#0D2B5E",
          800: "#091F45",
          900: "#050F22",
        },
        blue: {
          brand: "#1E6FD9",
          light: "#EFF6FF",
          mid:   "#BFDBFE",
        },
        teal: {
          brand: "#00B5A3",
        },
      },
      boxShadow: {
        card: "0 1px 3px 0 rgba(0,0,0,0.06), 0 1px 2px -1px rgba(0,0,0,0.06)",
        "card-md": "0 4px 6px -1px rgba(0,0,0,0.07), 0 2px 4px -2px rgba(0,0,0,0.07)",
      },
    },
  },
  plugins: [],
};

export default config;