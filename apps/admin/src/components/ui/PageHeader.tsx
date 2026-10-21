import Link from "next/link";
import { ArrowLeft } from "lucide-react";

/** Standard page title block used at the top of every dashboard page. */
export default function PageHeader({
  title,
  description,
  actions,
  backHref,
  backLabel,
  meta,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  backHref?: string;
  backLabel?: string;
  /** Badges / small facts shown under the title. */
  meta?: React.ReactNode;
}) {
  return (
    <div className="mb-6">
      {backHref && (
        <Link
          href={backHref}
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 mb-3 transition-colors"
        >
          <ArrowLeft size={15} aria-hidden />
          {backLabel ?? "Back"}
        </Link>
      )}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight break-words">{title}</h1>
          {description && <p className="text-sm text-gray-500 mt-1">{description}</p>}
          {meta && <div className="flex items-center gap-2 flex-wrap mt-2">{meta}</div>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2 shrink-0">{actions}</div>}
      </div>
    </div>
  );
}
