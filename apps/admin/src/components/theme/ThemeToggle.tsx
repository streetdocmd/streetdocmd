"use client";
import { useEffect, useState } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { cx, focusRing } from "@/components/ds";

type Theme = "system" | "light" | "dark";
const OPTIONS: { value: Theme; label: string; icon: typeof Sun }[] = [
  { value: "system", label: "System", icon: Monitor },
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
];

// System, light or dark, saved on this device (see ThemeScript)
export default function ThemeToggle({ className }: { className?: string }) {
  const [theme, setTheme] = useState<Theme>("system");

  useEffect(() => {
    try { setTheme((localStorage.getItem("sdmd-theme") as Theme) || "system"); } catch {}
  }, []);

  function choose(t: Theme) {
    setTheme(t);
    try { localStorage.setItem("sdmd-theme", t); } catch {}
    window.dispatchEvent(new Event("sdmd-theme"));
  }

  return (
    <div role="radiogroup" aria-label="Appearance" className={cx("grid grid-cols-3 gap-1 rounded-ds bg-track p-1", className)}>
      {OPTIONS.map(({ value, label, icon: Icon }) => (
        <button
          key={value}
          type="button"
          role="radio"
          aria-checked={theme === value}
          onClick={() => choose(value)}
          className={cx(
            "flex min-h-9 items-center justify-center gap-1.5 rounded-xl px-2 text-ds-xs font-bold transition-colors",
            theme === value ? "bg-surface text-navy shadow-seg" : "text-muted hover:text-navy",
            focusRing,
          )}
        >
          <Icon size={14} aria-hidden /> {label}
        </button>
      ))}
    </div>
  );
}
