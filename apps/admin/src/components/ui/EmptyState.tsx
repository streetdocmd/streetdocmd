import type { LucideIcon } from "lucide-react";
import { Inbox } from "lucide-react";

export default function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
  compact = false,
}: {
  icon?: LucideIcon;
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  compact?: boolean;
}) {
  return (
    <div className={`flex flex-col items-center justify-center text-center px-6 ${compact ? "py-8" : "py-14"}`}>
      <div className="w-11 h-11 rounded-full bg-gray-100 text-gray-400 flex items-center justify-center mb-3">
        <Icon size={20} aria-hidden />
      </div>
      <p className="text-sm font-semibold text-gray-900">{title}</p>
      {description && <p className="text-sm text-gray-500 mt-1 max-w-sm">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
