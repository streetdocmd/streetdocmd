"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import type { ReactNode } from "react";
import { cx, focusRing } from "./cx";

interface TopBarProps {
  title: ReactNode;
  /** Where Back goes. Without it, Back uses browser history. */
  backHref?: string;
  /** Custom Back behaviour, e.g. returning to the previous step of a form. */
  onBack?: () => void;
  /** Hide the Back button (first screen of a flow). */
  hideBack?: boolean;
  /** Optional action on the right, e.g. an icon button. */
  right?: ReactNode;
  className?: string;
}

export const iconButtonClass = cx(
  "grid place-items-center flex-none w-11 h-11 rounded-[14px] border border-line bg-surface text-navy hover:border-accent",
  focusRing,
);

export function TopBar({ title, backHref, onBack, hideBack, right, className }: TopBarProps) {
  const router = useRouter();
  const icon = <ChevronLeft size={20} aria-hidden />;
  const spacer = <span className="w-11 flex-none" aria-hidden />;

  let back: ReactNode = spacer;
  if (!hideBack) {
    back = backHref && !onBack ? (
      <Link href={backHref} aria-label="Back" className={iconButtonClass}>
        {icon}
      </Link>
    ) : (
      <button type="button" aria-label="Back" className={iconButtonClass} onClick={onBack ?? (() => router.back())}>
        {icon}
      </button>
    );
  }

  return (
    <header className={cx("flex items-center justify-between gap-3 px-5 pt-2 pb-3.5", className)}>
      {back}
      <h2 className="flex-1 text-center text-[17px] font-bold leading-tight text-navy truncate">{title}</h2>
      {right ?? spacer}
    </header>
  );
}
