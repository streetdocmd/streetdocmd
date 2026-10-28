import Link from "next/link";
import type { ButtonHTMLAttributes, ComponentProps, ReactNode } from "react";
import { cx, focusRing } from "./cx";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "success";

// Border colour lives here, not in the base, so the two never compete
const variants: Record<ButtonVariant, string> = {
  primary: "border-transparent bg-accent text-white hover:bg-accent-hover",
  secondary: "border-line bg-surface text-navy hover:border-accent hover:text-accent",
  ghost: "border-transparent bg-transparent text-accent px-3 hover:bg-accent-soft",
  danger: "border-transparent bg-danger text-white hover:opacity-90",
  success: "border-transparent bg-success text-white hover:opacity-90",
};

/** Classes for anything that should look like a button (a link, a label). */
export function buttonClass(variant: ButtonVariant = "primary", block = false, className?: string): string {
  return cx(
    "inline-flex items-center justify-center gap-2 min-h-12 px-6 rounded-pill border-[1.5px]",
    "text-ds-control font-semibold leading-none no-underline cursor-pointer select-none",
    "transition-[background-color,border-color,color,transform] duration-150 active:scale-[0.98]",
    "disabled:bg-disabled disabled:text-disabled-fg disabled:border-transparent disabled:cursor-not-allowed disabled:active:scale-100",
    "aria-disabled:bg-disabled aria-disabled:text-disabled-fg aria-disabled:border-transparent aria-disabled:pointer-events-none",
    focusRing,
    variants[variant],
    block && "w-full",
    className,
  );
}

interface CommonProps {
  variant?: ButtonVariant;
  /** Full width */
  block?: boolean;
  className?: string;
  children: ReactNode;
}

type ButtonAsButton = CommonProps & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className" | "children"> & { href?: undefined };
type ButtonAsLink = CommonProps & Omit<ComponentProps<typeof Link>, "className" | "children"> & { href: string };

/** 48px minimum height. Renders a next/link when `href` is given. */
export function Button(props: ButtonAsButton | ButtonAsLink) {
  if (props.href !== undefined) {
    const { variant, block, className, children, ...rest } = props as ButtonAsLink;
    return (
      <Link {...rest} className={buttonClass(variant, block, className)}>
        {children}
      </Link>
    );
  }
  const { variant, block, className, children, type = "button", ...rest } = props as ButtonAsButton;
  return (
    <button {...rest} type={type} className={buttonClass(variant, block, className)}>
      {children}
    </button>
  );
}
