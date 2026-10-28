/**
 * Marks a partner-portal feature that's planned but not built yet. Always pair
 * it with a visibly disabled control (aria-disabled, no handler) and never
 * with placeholder data.
 */
export default function ComingSoonBadge({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border border-line bg-pending-bg px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted whitespace-nowrap ${className}`}
    >
      Coming soon
    </span>
  );
}
