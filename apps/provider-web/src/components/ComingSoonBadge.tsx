import type { LucideIcon } from "lucide-react";

/** Small pill marking a feature that's planned but not built yet. */
export default function ComingSoonBadge({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-gray-500 whitespace-nowrap ${className}`}
    >
      Coming soon
    </span>
  );
}

/**
 * A visibly disabled feature tile: no link, no handler, nothing clickable —
 * just tells the provider what's on the way.
 */
export function ComingSoonItem({
  icon: Icon,
  title,
  description,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
}) {
  return (
    <div
      aria-disabled="true"
      className="card flex items-start gap-3 p-4 opacity-70 cursor-not-allowed select-none"
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gray-100">
        <Icon size={19} strokeWidth={2} className="text-gray-400" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-semibold text-gray-700">{title}</p>
          <ComingSoonBadge />
        </div>
        <p className="mt-0.5 text-xs leading-relaxed text-gray-500">{description}</p>
      </div>
    </div>
  );
}
