/**
 * Marks a feature that's planned but not built yet. Pair it with a visibly
 * disabled control (aria-disabled, no handler) — never with fake data.
 */
export default function ComingSoonBadge({
  className = "",
  tone = "light",
}: {
  className?: string;
  /** "dark" for use on the navy sidebar. */
  tone?: "light" | "dark";
}) {
  const styles =
    tone === "dark"
      ? "bg-white/10 text-blue-200 border-white/10"
      : "bg-gray-100 text-gray-500 border-gray-200";
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide whitespace-nowrap ${styles} ${className}`}
    >
      Coming soon
    </span>
  );
}
