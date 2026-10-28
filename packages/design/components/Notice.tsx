import { CircleAlert, CircleCheck, Info, TriangleAlert, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cx } from "./cx";

export type NoticeTone = "warn" | "info" | "danger" | "success";

const tones: Record<NoticeTone, { box: string; icon: string; Icon: LucideIcon }> = {
  warn: { box: "bg-warn-bg", icon: "text-warn", Icon: TriangleAlert },
  info: { box: "bg-accent-soft", icon: "text-accent", Icon: Info },
  danger: { box: "bg-danger-bg", icon: "text-danger", Icon: CircleAlert },
  success: { box: "bg-success-bg", icon: "text-success", Icon: CircleCheck },
};

interface NoticeProps {
  tone?: NoticeTone;
  /** Bold lead-in, e.g. "Not for emergencies." */
  title?: ReactNode;
  icon?: LucideIcon;
  className?: string;
  children?: ReactNode;
}

export function Notice({ tone = "warn", title, icon, className, children }: NoticeProps) {
  const t = tones[tone];
  const Icon = icon ?? t.Icon;
  return (
    <div
      role={tone === "danger" ? "alert" : "note"}
      className={cx("flex items-start gap-3 p-4 rounded-ds-sm text-ds-sm text-ink", t.box, className)}
    >
      <Icon size={20} className={cx("mt-px flex-none", t.icon)} aria-hidden />
      <div>
        {title && <strong className="font-bold text-ink">{title}</strong>} {children}
      </div>
    </div>
  );
}

/** Shown wherever booking starts. Copy from the design, unchanged. */
export function EmergencyNotice({ className }: { className?: string }) {
  return (
    <Notice tone="warn" title="Not for emergencies." className={className}>
      In an emergency, call 112 or go to the nearest emergency room.
    </Notice>
  );
}
