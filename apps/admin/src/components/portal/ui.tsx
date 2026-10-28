// Shared visual primitives for the partner portals. Classes are spelled out
// here (not borrowed from globals.css) so the portals render the same
// regardless of the admin console's own utility classes.
import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft, type LucideIcon } from "lucide-react";

export const ui = {
  card: "bg-surface rounded-ds-lg border border-line shadow-ds-sm",
  input:
    "w-full min-h-[48px] rounded-[14px] border-[1.5px] border-line bg-surface px-3.5 text-ds-control text-ink placeholder:text-muted " +
    "focus:outline-none focus:border-accent focus:ring-4 focus:ring-accent-soft transition-colors " +
    "disabled:bg-page disabled:text-muted",
  label: "block text-ds-sm font-semibold text-ink mb-1.5",
  hint: "mt-1 text-ds-xs text-muted",
  fieldError: "mt-1 text-ds-xs font-semibold text-danger",
  sectionTitle: "text-[17px] font-bold text-navy",
  btnPrimary:
    "inline-flex items-center justify-center gap-2 min-h-11 rounded-pill border-[1.5px] border-transparent bg-accent px-5 text-ds-sm font-semibold text-white " +
    "hover:bg-accent-hover transition-colors disabled:bg-disabled disabled:text-disabled-fg disabled:cursor-not-allowed",
  btnSecondary:
    "inline-flex items-center justify-center gap-2 min-h-11 rounded-pill border-[1.5px] border-line bg-surface px-5 text-ds-sm font-semibold text-navy " +
    "hover:border-accent hover:text-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed",
  btnSuccess:
    "inline-flex items-center justify-center gap-2 min-h-11 rounded-pill border-[1.5px] border-transparent bg-success px-5 text-ds-sm font-semibold text-white " +
    "hover:opacity-90 transition-opacity disabled:bg-disabled disabled:text-disabled-fg disabled:cursor-not-allowed",
  btnLink: "text-ds-sm font-bold text-accent hover:underline disabled:opacity-50",
  checkbox: "w-[18px] h-[18px] rounded accent-accent",
};

// ── Status badges ────────────────────────────────────────────────────────────
// Status is never colour alone: every badge carries its text (and usually an icon).
export type BadgeTone = "gray" | "blue" | "amber" | "green" | "red" | "indigo" | "purple" | "navy";

const TONES: Record<BadgeTone, string> = {
  gray:   "bg-pending-bg text-pending",
  blue:   "bg-accent-soft text-accent",
  amber:  "bg-warn-bg text-warn",
  green:  "bg-success-bg text-success",
  red:    "bg-danger-bg text-danger",
  indigo: "bg-sky text-brand",
  purple: "bg-tint-violet text-navy",
  navy:   "bg-sky text-navy",
};

export function StatusBadge({ tone = "gray", children, icon: Icon }: { tone?: BadgeTone; children: ReactNode; icon?: LucideIcon }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-pill px-2.5 py-[5px] text-ds-xs font-bold leading-none whitespace-nowrap ${TONES[tone]}`}>
      {Icon && <Icon size={12} aria-hidden />}
      {children}
    </span>
  );
}

// ── Layout pieces ────────────────────────────────────────────────────────────
export function PageHeader({
  title, description, actions, back,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  back?: { href: string; label: string };
}) {
  return (
    <div className="mb-6">
      {back && (
        <Link href={back.href} className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink mb-3">
          <ArrowLeft size={15} aria-hidden /> {back.label}
        </Link>
      )}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-[26px] font-extrabold leading-tight tracking-[-0.02em] text-navy">{title}</h1>
          {description && <p className="text-sm text-muted mt-1 max-w-2xl">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap gap-2 shrink-0">{actions}</div>}
      </div>
    </div>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`${ui.card} ${className}`}>{children}</div>;
}

export function CardHeader({ title, description, actions }: { title: ReactNode; description?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-line">
      <div className="min-w-0">
        <h2 className="text-sm font-semibold text-ink">{title}</h2>
        {description && <p className="text-xs text-muted mt-0.5">{description}</p>}
      </div>
      {actions}
    </div>
  );
}

export function StatCard({ label, value, icon: Icon, tone = "blue", hint }: {
  label: string; value: ReactNode; icon: LucideIcon; tone?: "blue" | "amber" | "green" | "navy"; hint?: string;
}) {
  const iconTone = {
    blue: "bg-teal-soft text-teal-deep",
    amber: "bg-warn-bg text-warn",
    green: "bg-success-bg text-success",
    navy: "bg-sky text-navy",
  }[tone];
  return (
    <div className={`${ui.card} p-4 sm:p-5 flex items-center gap-4`}>
      <span className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${iconTone}`}>
        <Icon size={19} aria-hidden />
      </span>
      <div className="min-w-0">
        <p className="text-xs font-medium text-muted">{label}</p>
        <p className="text-ds-xl font-bold text-navy leading-tight">{value}</p>
        {hint && <p className="text-xs text-muted truncate">{hint}</p>}
      </div>
    </div>
  );
}

export function EmptyState({ icon: Icon, title, description, action }: {
  icon: LucideIcon; title: string; description?: ReactNode; action?: ReactNode;
}) {
  return (
    <div className="px-6 py-14 text-center">
      <span className="mx-auto w-12 h-12 rounded-full bg-pending-bg text-muted flex items-center justify-center">
        <Icon size={22} aria-hidden />
      </span>
      <p className="mt-4 font-semibold text-ink">{title}</p>
      {description && <p className="mt-1 text-sm text-muted max-w-sm mx-auto">{description}</p>}
      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </div>
  );
}

export function Notice({ tone = "amber", icon: Icon, children, action }: {
  tone?: "amber" | "blue" | "red" | "green"; icon?: LucideIcon; children: ReactNode; action?: ReactNode;
}) {
  const styles = {
    amber: "bg-warn-bg border-transparent text-ink",
    blue: "bg-accent-soft border-transparent text-ink",
    red: "bg-danger-bg border-transparent text-ink",
    green: "bg-success-bg border-transparent text-ink",
  }[tone];
  return (
    <div className={`rounded-ds-sm border px-4 py-3 text-ds-sm flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between ${styles}`}>
      <div className="flex items-start gap-2.5">
        {Icon && <Icon size={17} className="mt-0.5 shrink-0" aria-hidden />}
        <div>{children}</div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

export function Spinner({ className = "" }: { className?: string }) {
  return <span className={`inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin ${className}`} aria-hidden />;
}

export function DetailRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-medium text-muted">{label}</dt>
      <dd className="text-sm text-ink mt-0.5 break-words">{value || value === 0 ? value : "—"}</dd>
    </div>
  );
}

export function formatNaira(n: number | string | null | undefined) {
  const v = Number(n ?? 0);
  return `₦${(Number.isFinite(v) ? v : 0).toLocaleString("en-NG")}`;
}

export function formatDateTime(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-NG", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}
