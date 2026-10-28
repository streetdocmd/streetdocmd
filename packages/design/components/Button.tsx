import Link from "next/link";
import type { ButtonHTMLAttributes, ComponentProps, ReactNode } from "react";
import { cx, focusRing } from "./cx";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "danger-outline" | "success";
export type ButtonSize = "xs" | "sm" | "md" | "lg";

// Colours only. Border colour lives here, not in the base, so the two never compete.
const variants: Record<ButtonVariant, string> = {
  primary: "border-transparent bg-accent text-white hover:bg-accent-hover",
  secondary: "border-line bg-surface text-navy hover:border-accent hover:text-accent",
  ghost: "border-transparent bg-transparent text-accent hover:bg-accent-soft",
  danger: "border-transparent bg-danger text-white hover:opacity-90",
  "danger-outline": "border-line bg-surface text-danger hover:border-danger",
  success: "border-transparent bg-success text-white hover:opacity-90",
};

// Height, padding, text size and radius. Use a size rather than overriding these
// with className: Tailwind orders utilities by CSS, not by class order, so an
// override like "px-4" cannot reliably beat the base "px-6".
const sizes: Record<ButtonSize, string> = {
  xs: "min-h-9 px-3 rounded-xl text-[13px]", // list row actions
  sm: "min-h-10 px-4 rounded-pill text-ds-sm",
  md: "min-h-12 px-6 rounded-pill text-ds-control", // 48px minimum
  lg: "min-h-[52px] px-6 rounded-pill text-ds-control", // primary actions in the apps
};

/** Classes for anything that should look like a button (a link, a label). */
export function buttonClass(variant: ButtonVariant = "primary", block = false, className?: string, size: ButtonSize = "md"): string {
  return cx(
    "inline-flex items-center justify-center gap-2 border-[1.5px]",
    "font-semibold leading-none no-underline cursor-pointer select-none",
    "transition-[background-color,border-color,color,transform] duration-150 active:scale-[0.98]",
    "disabled:bg-disabled disabled:text-disabled-fg disabled:border-transparent disabled:cursor-not-allowed disabled:active:scale-100",
    "aria-disabled:bg-disabled aria-disabled:text-disabled-fg aria-disabled:border-transparent aria-disabled:pointer-events-none",
    focusRing,
    sizes[size],
    variants[variant],
    block && "w-full",
    className,
  );
}

interface CommonProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Full width */
  block?: boolean;
  /** Layout only (margins, flex, width). Use `size` for height and padding. */
  className?: string;
  children: ReactNode;
}

type ButtonAsButton = CommonProps & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className" | "children"> & { href?: undefined };
type ButtonAsLink = CommonProps & Omit<ComponentProps<typeof Link>, "className" | "children"> & { href: string };

/** 48px minimum height by default. Renders a next/link when `href` is given. */
export function Button(props: ButtonAsButton | ButtonAsLink) {
  if (props.href !== undefined) {
    const { variant, size, block, className, children, ...rest } = props as ButtonAsLink;
    return (
      <Link {...rest} className={buttonClass(variant, block, className, size)}>
        {children}
      </Link>
    );
  }
  const { variant, size, block, className, children, type = "button", ...rest } = props as ButtonAsButton;
  return (
    <button {...rest} type={type} className={buttonClass(variant, block, className, size)}>
      {children}
    </button>
  );
}
