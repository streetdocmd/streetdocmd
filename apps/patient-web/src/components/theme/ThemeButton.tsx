"use client";
import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { cx, focusRing } from "@/components/ds";

type Mode = "light" | "dark";

// What's showing now. System (still offered in the profile menu) follows the device.
function currentMode(): Mode {
  const saved = localStorage.getItem("sdmd-theme") || "light";
  if (saved === "light" || saved === "dark") return saved;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

// Header button: each tap switches between Light and Dark (see ThemeScript)
export default function ThemeButton({ className }: { className?: string }) {
  const [mode, setMode] = useState<Mode>("light");

  useEffect(() => {
    const read = () => { try { setMode(currentMode()); } catch {} };
    read();
    window.addEventListener("sdmd-theme", read);
    return () => window.removeEventListener("sdmd-theme", read);
  }, []);

  const next: Mode = mode === "dark" ? "light" : "dark";

  function toggle() {
    setMode(next);
    try { localStorage.setItem("sdmd-theme", next); } catch {}
    window.dispatchEvent(new Event("sdmd-theme"));
  }

  const Icon = mode === "dark" ? Moon : Sun;
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={`${mode === "dark" ? "Dark" : "Light"} theme. Switch to ${next} theme`}
      title={`${mode === "dark" ? "Dark" : "Light"} theme (tap to change)`}
      className={cx("grid h-10 w-10 place-items-center rounded-full text-navy transition-colors hover:bg-page", focusRing, className)}
    >
      <Icon size={19} strokeWidth={2} aria-hidden />
    </button>
  );
}
