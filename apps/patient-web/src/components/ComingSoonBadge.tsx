// Small pill marking a feature that's visible in the UI but not built yet.
// Anything carrying this badge must also be non-interactive (no link, no
// handler) — the badge explains why it doesn't respond.
export default function ComingSoonBadge({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full bg-pending-bg px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-wide text-muted whitespace-nowrap ${className}`}
    >
      Coming soon
    </span>
  );
}
