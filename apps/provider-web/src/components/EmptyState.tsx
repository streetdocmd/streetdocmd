import type { LucideIcon } from "lucide-react";

/** Standard empty state card (icon tile + title + hint), as in patient-web. */
export default function EmptyState({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="card p-10 sm:p-12 text-center">
      <div className="w-12 h-12 rounded-2xl bg-blue-light flex items-center justify-center mx-auto mb-3">
        <Icon size={22} className="text-blue-brand" />
      </div>
      <p className="font-semibold text-gray-800">{title}</p>
      {description && <p className="text-sm text-gray-500 mt-1 max-w-sm mx-auto">{description}</p>}
      {children && <div className="mt-4">{children}</div>}
    </div>
  );
}
