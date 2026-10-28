// Tailwind preset for the StreetdocMD design system.
// Everything is additive (new names, or DEFAULT keys on existing palettes),
// so classes already used by the apps compile exactly as before.
import type { Config } from "tailwindcss";
import { colors as c, fontSize, fontStack, radius, shadow, spacing } from "./tokens";

const rgbVar = (name: string) => `rgb(var(--${name}-rgb) / <alpha-value>)`;

const headings = new Set(["xl", "2xl", "3xl", "4xl"]);

const preset: Partial<Config> = {
  // Light theme only: `dark:` variants never follow prefers-color-scheme.
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        brand: { DEFAULT: c.blue, hover: c["blue-hover"] },
        navy: { DEFAULT: c.navy },
        sky: { DEFAULT: c.sky },
        teal: { DEFAULT: c.teal, deep: c["teal-deep"], hover: c["teal-hover"], soft: c["teal-soft"], tint: c["teal-tint"], bright: c["teal-bright"] },
        ink: c.ink,
        muted: c.muted,
        line: c.line,
        page: c.bg,
        surface: c.surface,
        track: c.track,
        disabled: { DEFAULT: c.disabled, fg: c["disabled-fg"] },
        success: { DEFAULT: c.success, bg: c["success-bg"] },
        warn: { DEFAULT: c.warn, bg: c["warn-bg"] },
        danger: { DEFAULT: c.danger, bg: c["danger-bg"] },
        pending: { DEFAULT: c.pending, bg: c["pending-bg"] },
        // Blue in the patient app and admin, teal under `.theme-provider`
        accent: { DEFAULT: rgbVar("accent"), hover: rgbVar("accent-hover"), soft: rgbVar("accent-soft") },
      },
      borderRadius: {
        "ds-sm": radius.sm,
        ds: radius.md,
        "ds-lg": radius.lg,
        pill: radius.pill,
      },
      boxShadow: {
        "ds-sm": shadow.sm,
        ds: shadow.md,
        seg: shadow.seg,
      },
      spacing: { ...spacing },
      fontSize: Object.fromEntries(
        Object.entries(fontSize).map(([k, v]): [string, [string, { lineHeight: string }]] => [
          `ds-${k}`,
          [v, { lineHeight: headings.has(k) ? "1.2" : "1.5" }],
        ]),
      ),
      fontFamily: { sans: fontStack },
    },
  },
};

export default preset;
