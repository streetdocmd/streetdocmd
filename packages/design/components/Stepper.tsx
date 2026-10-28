"use client";

import { Minus, Plus } from "lucide-react";
import { cx, focusRing } from "./cx";

interface StepperProps {
  value: number;
  onChange: (value: number) => void;
  /** Accessible name, e.g. "Free beds, Maternity". */
  label: string;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  /** "sm" fits inside a list row (36px buttons) */
  size?: "md" | "sm";
  className?: string;
}

export function Stepper({ value, onChange, label, min = 0, max = Infinity, step = 1, disabled, size = "md", className }: StepperProps) {
  const sm = size === "sm";
  const btn = cx(
    "grid place-items-center border-[1.5px] border-line bg-surface text-navy",
    sm ? "w-9 h-9 rounded-xl" : "w-11 h-11 rounded-[14px]",
    "hover:border-accent disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:border-line",
    focusRing,
  );
  return (
    <div role="group" aria-label={label} className={cx("flex items-center", sm ? "gap-1.5" : "gap-2.5", className)}>
      <button
        type="button"
        className={btn}
        aria-label={`Decrease ${label}`}
        disabled={disabled || value - step < min}
        onClick={() => onChange(Math.max(min, value - step))}
      >
        <Minus size={sm ? 15 : 18} strokeWidth={2.4} aria-hidden />
      </button>
      <output aria-live="polite" className={cx("text-center font-bold text-navy tabular-nums", sm ? "min-w-6 text-ds-sm" : "min-w-[42px] text-ds-lg")}>
        {value}
      </output>
      <button
        type="button"
        className={btn}
        aria-label={`Increase ${label}`}
        disabled={disabled || value + step > max}
        onClick={() => onChange(Math.min(max, value + step))}
      >
        <Plus size={sm ? 15 : 18} strokeWidth={2.4} aria-hidden />
      </button>
    </div>
  );
}
