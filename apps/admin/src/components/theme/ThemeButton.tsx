"use client";
import { useEffect, useState } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { cx, focusRing } from "@/components/ds";

type Theme = "system" | "light" | "dark";
const NEXT: Record<Theme, Theme> = { system: "light", light: "dark", dark: "system" };
const LABEL: Record<Theme, string> = { system: "System theme", light: "Light theme", dark: "Dark theme" };

// Header button: each tap moves System → Light → Dark (see ThemeScript)
export default function ThemeButton({ className }: { className?: string }) {
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    const read = () => { try { setTheme((localStorage.getItem("sdmd-theme") as Theme) || "light"); } catch {} };
    read();
    window.addEventListener("sdmd-theme", read);
    return () => window.removeEventListener("sdmd-theme", read);
  }, []);

  function cycle() {
    const next = NEXT[theme];
    setTheme(next);
    try { localStorage.setItem("sdmd-theme", next); } catch {}
    window.dispatchEvent(new Event("sdmd-theme"));
  }

  const Icon = theme === "dark" ? Moon : theme === "light" ? Sun : Monitor;
  return (
    <button
      type="button"
      onClick={cycle}
      aria-label={`${LABEL[theme]}. Switch to ${LABEL[NEXT[theme]].toLowerCase()}`}
      title={`${LABEL[theme]} (tap to change)`}
      className={cx("grid h-10 w-10 place-items-center rounded-full text-navy transition-colors hover:bg-page", focusRing, className)}
    >
      <Icon size={19} strokeWidth={2} aria-hidden />
    </button>
  );
}
