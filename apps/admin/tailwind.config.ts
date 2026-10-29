import type { Config } from "tailwindcss";
import designPreset from "./src/design/tailwind-preset";

const config: Config = {
  // Design system tokens (packages/design): every colour, including the
  // navy, blue brand and teal brand shades, comes from the preset and follows
  // the light or dark theme
  presets: [designPreset],
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      boxShadow: {
        card: "0 1px 3px 0 rgba(0,0,0,0.06), 0 1px 2px -1px rgba(0,0,0,0.06)",
        "card-md": "0 4px 6px -1px rgba(0,0,0,0.07), 0 2px 4px -2px rgba(0,0,0,0.07)",
      },
    },
  },
  plugins: [],
};

export default config;
