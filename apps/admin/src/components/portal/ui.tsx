// Shared visual primitives for the partner portals. Classes are spelled out
// here (not borrowed from globals.css) so the portals render the same
// regardless of the admin console's own utility classes.
import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft, type LucideIcon } from "lucide-react";

export const ui = {
  card: "bg-white rounded-xl border border-gray-100 shadow-card",
  input:
    "w-full border border-gray-200 rounded-lg px-3.5 py-2.5 text-sm text-gray-900 bg-white placeholder:text-gray-400 " +
    "focus:outline-none focus:ring-2 focus:ring-blue-brand/30 focus:border-blue-brand transition-colors " +
    "disabled:bg-gray-50 disabled:text-gray-500",
  label: "block text-sm font-medium text-gray-700 mb-1.5",
  hint: "mt-1 text-xs text-gray-500",
  fieldError: "mt-1 text-xs text-red-600",
  sectionTitle: "text-xs font-semibold text-gray-500 uppercase tracking-wide",
  btnPrimary:
    "inline-flex items-center justify-center gap-2 bg-blue-brand text-white px-4 py-2.5 rounded-lg text-sm font-semibold " +
    "hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed",
  btnSecondary:
    "inline-flex items-center justify-center gap-2 bg-white text-gray-700 px-4 py-2.5 rounded-lg text-sm font-medium " +
    "border border-gray-200 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed",
  btnSuccess:
    "inline-flex items-center justify-center gap-2 bg-green-600 text-white px-4 py-2.5 rounded-lg text-sm font-semibold " +
    "hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed",
  btnLink: "text-sm font-medium text-blue-brand hover:text-blue-700 hover:underline disabled:opacity-50",
  checkbox: "w-4 h-4 rounded border-gray-300 accent-blue-brand",
};

// ── Status badges ────────────────────────────────────────────────────────────
export type BadgeTone = "gray" | "blue" | "amber" | "green" | "red" | "indigo" | "purple" | "navy";

const TONES: Record<BadgeTone, string> = {
  gray:   "bg-gray-100 text-gray-600 ring-gray-200",
  blue:   "bg-blue-50 text-blue-700 ring-blue-200",
  amber:  "bg-amber-50 text-amber-700 ring-amber-200",
  green:  "bg-green-50 text-green-700 ring-green-200",
  red:    "bg-red-50 text-red-700 ring-red-200",
  indigo: "bg-indigo-50 text-indigo-700 ring-indigo-200",
  purple: "bg-purple-50 text-purple-700 ring-purple-200",
  navy:   "bg-navy-50 text-navy-700 ring-navy-100",
};

export function StatusBadge({ tone = "gray", children, icon: Icon }: { tone?: BadgeTone; children: ReactNode; icon?: LucideIcon }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset whitespace-nowrap ${TONES[tone]}`}>
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
        <Link href={back.href} className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 mb-3">
          <ArrowLeft size={15} aria-hidden /> {back.label}
        </Link>
      )}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">{title}</h1>
          {description && <p className="text-sm text-gray-500 mt-1 max-w-2xl">{description}</p>}
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
    <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-gray-100">
      <div className="min-w-0">
        <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
        {description && <p className="text-xs text-gray-500 mt-0.5">{description}</p>}
      </div>
      {actions}
    </div>
  );
}

export function StatCard({ label, value, icon: Icon, tone = "blue", hint }: {
  label: string; value: ReactNode; icon: LucideIcon; tone?: "blue" | "amber" | "green" | "navy"; hint?: string;
}) {
  const iconTone = {
    blue: "bg-blue-50 text-blue-brand",
    amber: "bg-amber-50 text-amber-600",
    green: "bg-green-50 text-green-600",
    navy: "bg-navy-50 text-navy-700",
  }[tone];
  return (
    <div className={`${ui.card} p-4 sm:p-5 flex items-center gap-4`}>
      <span className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${iconTone}`}>
        <Icon size={19} aria-hidden />
      </span>
      <div className="min-w-0">
        <p className="text-xs font-medium text-gray-500">{label}</p>
        <p className="text-xl font-bold text-gray-900 leading-tight">{value}</p>
        {hint && <p className="text-xs text-gray-400 truncate">{hint}</p>}
      </div>
    </div>
  );
}

export function EmptyState({ icon: Icon, title, description, action }: {
  icon: LucideIcon; title: string; description?: ReactNode; action?: ReactNode;
}) {
  return (
    <div className="px-6 py-14 text-center">
      <span className="mx-auto w-12 h-12 rounded-full bg-gray-100 text-gray-400 flex items-center justify-center">
        <Icon size={22} aria-hidden />
      </span>
      <p className="mt-4 font-semibold text-gray-900">{title}</p>
      {description && <p className="mt-1 text-sm text-gray-500 max-w-sm mx-auto">{description}</p>}
      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </div>
  );
}

export function Notice({ tone = "amber", icon: Icon, children, action }: {
  tone?: "amber" | "blue" | "red" | "green"; icon?: LucideIcon; children: ReactNode; action?: ReactNode;
}) {
  const styles = {
    amber: "bg-amber-50 border-amber-200 text-amber-900",
    blue: "bg-blue-50 border-blue-200 text-blue-900",
    red: "bg-red-50 border-red-200 text-red-800",
    green: "bg-green-50 border-green-200 text-green-800",
  }[tone];
  return (
    <div className={`rounded-xl border px-4 py-3 text-sm flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between ${styles}`}>
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
      <dt className="text-xs font-medium text-gray-500">{label}</dt>
      <dd className="text-sm text-gray-900 mt-0.5 break-words">{value || value === 0 ? value : "—"}</dd>
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
