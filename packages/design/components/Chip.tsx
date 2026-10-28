"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cx, focusRing } from "./cx";

interface ChipProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className" | "children"> {
  selected?: boolean;
  /**
   * Multi-select chips (allergies, conditions) use a lighter selected style,
   * so several can be on at once without the row turning solid navy.
   */
  multi?: boolean;
  className?: string;
  children: ReactNode;
}

/** Filter or choice chip. Selection is announced with aria-pressed. */
export function Chip({ selected = false, multi = false, type = "button", className, children, ...rest }: ChipProps) {
  return (
    <button
      {...rest}
      type={type}
      aria-pressed={selected}
      className={cx(
        "flex-none inline-flex items-center gap-1.5 min-h-[38px] px-3.5 rounded-pill border-[1.5px] text-[13px] font-bold whitespace-nowrap transition-colors",
        !selected && "bg-surface border-line text-ink hover:border-accent",
        selected && !multi && "bg-navy border-navy text-white",
        selected && multi && "bg-accent-soft border-accent text-navy",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        focusRing,
        className,
      )}
    >
      {children}
    </button>
  );
}
