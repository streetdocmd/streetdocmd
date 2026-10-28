import { BadgeCheck } from "lucide-react";
import type { ReactNode } from "react";
import { cx } from "./cx";

interface VerifiedBadgeProps {
  /** Regulator that verified the provider, e.g. "MDCN". */
  by?: string;
  className?: string;
  children?: ReactNode;
}

/** Trust element shown next to a provider's name. Always visible, never colour alone. */
export function VerifiedBadge({ by, className, children }: VerifiedBadgeProps) {
  return (
    <span className={cx("inline-flex items-center gap-[5px] text-teal-deep text-ds-xs font-bold", className)}>
      <BadgeCheck size={15} strokeWidth={2.4} aria-hidden />
      {children ?? (by ? `Verified by ${by}` : "Verified")}
    </span>
  );
}
