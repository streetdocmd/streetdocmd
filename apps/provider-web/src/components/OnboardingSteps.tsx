import { Check } from "lucide-react";

const STEPS = ["Account", "Documents", "Review", "Go live"];

/** Compact progress indicator shared by the registration and onboarding screens. */
export default function OnboardingSteps({ current, tone = "light" }: { current: number; tone?: "light" | "dark" }) {
  const dark = tone === "dark";
  return (
    <ol className="flex items-center justify-center gap-1.5 sm:gap-2" aria-label="Application progress">
      {STEPS.map((label, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <li key={label} className="flex items-center gap-1.5 sm:gap-2">
            <span
              aria-current={active ? "step" : undefined}
              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
                done ? "bg-teal-deep text-white"
                  : active ? "bg-accent text-white ring-4 " + (dark ? "ring-white/15" : "ring-accent-soft")
                  : dark ? "bg-white/10 text-muted" : "bg-line text-muted"
              }`}
            >
              {done ? <Check size={13} strokeWidth={3} /> : i + 1}
            </span>
            <span
              className={`text-xs font-medium ${
                active ? (dark ? "text-white" : "text-ink")
                  : dark ? "text-muted" : "text-muted"
              } ${active ? "" : "hidden sm:inline"}`}
            >
              {label}
            </span>
            {i < STEPS.length - 1 && (
              <span className={`h-px w-4 sm:w-6 ${done ? "bg-teal-deep" : dark ? "bg-white/15" : "bg-line"}`} />
            )}
          </li>
        );
      })}
    </ol>
  );
}
