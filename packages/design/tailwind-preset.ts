// Tailwind preset for the StreetdocMD design system.
// Every colour, including Tailwind's own palettes, reads a CSS variable from
// tokens.css, so the whole UI switches theme when <html> has the `dark` class.
// Each colour has three roles (see `dark` in tokens.ts): backgrounds and
// gradients use --c-*, text uses --t-*, borders, dividers and rings use --b-*.
import type { Config } from "tailwindcss";
import { PALETTES, SHADES, colors as c, fontSize, fontStack, legacy, radius, spacing } from "./tokens";

export type Role = "c" | "t" | "b";

const v = (role: Role, name: string) => `rgb(var(--${role}-${name}) / <alpha-value>)`;

function palette(role: Role, p: string) {
  return Object.fromEntries(SHADES.map(s => [s, v(role, `${p}-${s}`)]));
}

function build(role: Role) {
  const out: Record<string, any> = {
    inherit: "inherit",
    current: "currentColor",
    transparent: "transparent",
    black: "#000",
    // White stays white (translucent white overlays on dark panels keep working);
    // solid white cards follow the surface through rules in tokens.css
    white: "#fff",
  };
  for (const p of PALETTES) out[p] = palette(role, p);

  const tok = (name: keyof typeof c) => v(role, name);
  const leg = (name: keyof typeof legacy) => v(role, name);

  out.brand = { DEFAULT: tok("blue"), hover: tok("blue-hover"), deep: tok("blue-deep"), pale: tok("blue-pale"), mist: tok("blue-mist") };
  out.navy = {
    DEFAULT: tok("navy"),
    50: leg("navy-50"), 100: leg("navy-100"), 600: leg("navy-600"), 700: leg("navy-700"), 800: leg("navy-800"), 900: leg("navy-900"),
  };
  out.sky = { ...out.sky, DEFAULT: tok("sky"), mid: tok("sky-mid"), deep: tok("sky-deep") };
  out.teal = {
    ...out.teal, DEFAULT: tok("teal"), deep: tok("teal-deep"), hover: tok("teal-hover"), soft: tok("teal-soft"),
    tint: tok("teal-tint"), bright: tok("teal-bright"), brand: leg("teal-brand"), light: leg("teal-light"),
  };
  out.blue = { ...out.blue, brand: leg("blue-brand"), light: leg("blue-light"), mid: leg("blue-mid") };
  out.green = { ...out.green, online: leg("green-online") };
  out.ink = tok("ink");
  out.tint = {
    blue: tok("tint-blue"), mint: tok("tint-mint"), rose: tok("tint-rose"), amber: tok("tint-amber"),
    green: tok("tint-green"), yellow: tok("tint-yellow"), violet: tok("tint-violet"), sky: tok("tint-sky"),
  };
  out.muted = tok("muted");
  out.line = tok("line");
  out.page = tok("bg");
  out.surface = tok("surface");
  out.track = tok("track");
  out.disabled = { DEFAULT: tok("disabled"), fg: tok("disabled-fg") };
  out.success = { DEFAULT: tok("success"), bg: tok("success-bg") };
  out.warn = { DEFAULT: tok("warn"), bg: tok("warn-bg") };
  out.danger = { DEFAULT: tok("danger"), bg: tok("danger-bg") };
  out.pending = { DEFAULT: tok("pending"), bg: tok("pending-bg") };
  // Blue in the patient app and admin, teal under `.theme-provider`
  out.accent = { DEFAULT: v(role, "accent"), hover: v(role, "accent-hover"), soft: v(role, "accent-soft") };
  return out;
}

const headings = new Set(["xl", "2xl", "3xl", "4xl"]);
const border = build("b");

const preset: Partial<Config> = {
  // The theme script in each root layout puts `dark` on <html>
  darkMode: "class",
  theme: {
    colors: build("c"),
    textColor: build("t"),
    placeholderColor: build("t"),
    caretColor: build("t"),
    borderColor: { ...border, DEFAULT: v("b", "gray-200") },
    divideColor: { ...border, DEFAULT: v("b", "gray-200") },
    outlineColor: border,
    ringColor: { ...border, DEFAULT: v("b", "blue-500") },
    ringOffsetColor: build("c"),
    extend: {
      borderRadius: {
        "ds-sm": radius.sm,
        ds: radius.md,
        "ds-lg": radius.lg,
        pill: radius.pill,
      },
      boxShadow: {
        "ds-sm": "var(--shadow-sm)",
        ds: "var(--shadow)",
        seg: "var(--shadow-seg)",
      },
      spacing: { ...spacing },
      fontSize: Object.fromEntries(
        Object.entries(fontSize).map(([k, val]): [string, [string, { lineHeight: string }]] => [
          `ds-${k}`,
          [val, { lineHeight: headings.has(k) ? "1.2" : "1.5" }],
        ]),
      ),
      fontFamily: { sans: fontStack },
      // The one brand motion: the stethoscope cable on the splash screen
      keyframes: {
        swing: { "0%, 100%": { transform: "rotate(-7deg)" }, "50%": { transform: "rotate(7deg)" } },
        load: { from: { transform: "translateX(-100%)" }, to: { transform: "translateX(260%)" } },
      },
      animation: {
        swing: "swing 2.6s ease-in-out infinite",
        load: "load 2.2s ease-in-out forwards",
      },
    },
  },
};

export default preset;
