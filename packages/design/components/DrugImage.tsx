import { Pill } from "lucide-react";
import { cx } from "./cx";

/** A medicine's picture, or a pill placeholder when it has none. Size it with `className`. */
export function DrugImage({ src, alt = "", className = "h-12 w-12" }: { src?: string | null; alt?: string; className?: string }) {
  const frame = cx("flex-none overflow-hidden rounded-ds-sm border border-line", className);
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt={alt} className={cx(frame, "bg-surface object-cover")} />;
  }
  return (
    <span aria-hidden className={cx(frame, "grid place-items-center bg-tint-yellow text-navy")}>
      <Pill className="h-1/2 w-1/2" strokeWidth={1.75} aria-hidden />
    </span>
  );
}
