"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft, ArrowRight, BadgeDollarSign, Camera, CheckCircle2, Circle, Clock, Landmark, NotebookPen, Power, X,
  type LucideIcon,
} from "lucide-react";
import { Card, Pill, buttonClass, cx, focusRing } from "@/components/ds";

export type SetupStepKey = "rates" | "photo" | "bio" | "hours" | "bank" | "online";

export interface SetupStep {
  key: SetupStepKey;
  title: string;
  why: string;
  /** Extra line, e.g. which rates are still missing */
  detail?: string;
  cta: string;
  href: string;
  done: boolean;
  /** Patients can't book the provider until this is done */
  required?: boolean;
}

const ICONS: Record<SetupStepKey, LucideIcon> = {
  rates: BadgeDollarSign,
  photo: Camera,
  bio: NotebookPen,
  hours: Clock,
  bank: Landmark,
  online: Power,
};

// Opens by itself once per browser session until everything is done, because a
// checklist further down the dashboard was easy to miss. The card stays on the
// dashboard so the guide can be reopened at any time.
export default function SetupGuide({ providerId, steps }: { providerId: string; steps: SetupStep[] }) {
  const firstOpen = Math.max(0, steps.findIndex(s => !s.done));
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(firstOpen);
  const panel = useRef<HTMLDivElement>(null);
  const seenKey = `sdm-setup-guide:${providerId}`;
  const doneCount = steps.filter(s => s.done).length;
  const allDone = doneCount === steps.length;

  const close = useCallback(() => {
    setOpen(false);
    try { sessionStorage.setItem(seenKey, "1"); } catch { /* blocked storage: it just opens again next visit */ }
  }, [seenKey]);

  useEffect(() => {
    if (allDone) return;
    let seen = false;
    try { seen = sessionStorage.getItem(seenKey) === "1"; } catch { /* treat as not seen */ }
    if (!seen) setOpen(true);
  }, [allDone, seenKey]);

  useEffect(() => {
    if (!open) return;
    panel.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close]);

  if (allDone) return null;

  const step = steps[index];
  const Icon = ICONS[step.key];
  const last = index === steps.length - 1;

  return (
    <>
      <Card className="mb-4 border-accent/30">
        <div className="mb-1 flex items-center justify-between gap-3">
          <b className="text-ink">Finish setting up your profile</b>
          <span className="text-ds-xs font-bold text-accent">{doneCount}/{steps.length} done</span>
        </div>
        <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-pending-bg">
          <div className="h-full rounded-full bg-accent" style={{ width: `${(doneCount / steps.length) * 100}%` }} />
        </div>
        {steps.some(s => s.required && !s.done) && (
          <p className="mb-3 text-ds-sm font-semibold text-warn">Patients can&apos;t book you yet: set your rates first.</p>
        )}
        <button type="button" onClick={() => { setIndex(firstOpen); setOpen(true); }} className={buttonClass("primary", false, undefined, "sm")}>
          Continue setup <ArrowRight size={16} aria-hidden />
        </button>
      </Card>

      {open && (
        <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4" onClick={close}>
          <div
            ref={panel}
            role="dialog"
            aria-modal="true"
            aria-labelledby="setup-guide-title"
            tabIndex={-1}
            onClick={e => e.stopPropagation()}
            className="max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-t-[28px] bg-surface p-5 shadow-ds outline-none sm:rounded-[28px] sm:p-6"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <small className="text-ds-xs font-bold text-accent">Step {index + 1} of {steps.length}</small>
                <h2 id="setup-guide-title" className="text-[20px] font-extrabold leading-tight text-navy">Set up your profile</h2>
              </div>
              <button type="button" onClick={close} aria-label="Close setup guide"
                className={cx("grid h-9 w-9 flex-none place-items-center rounded-full text-muted hover:bg-page", focusRing)}>
                <X size={18} aria-hidden />
              </button>
            </div>

            {/* Every step, so they can see what's left and jump to any of them */}
            <ol className="mt-4 flex gap-1.5" aria-label="Setup steps">
              {steps.map((s, i) => (
                <li key={s.key} className="flex-1">
                  <button
                    type="button"
                    onClick={() => setIndex(i)}
                    aria-label={`${s.title}${s.done ? " (done)" : ""}`}
                    aria-current={i === index ? "step" : undefined}
                    className={cx("block h-1.5 w-full rounded-full", s.done ? "bg-success" : i === index ? "bg-accent" : "bg-line", focusRing)}
                  />
                </li>
              ))}
            </ol>

            <div className="mt-5 flex items-start gap-3.5">
              <span className={cx("grid h-12 w-12 flex-none place-items-center rounded-[16px]", step.done ? "bg-success-bg text-success" : "bg-accent-soft text-accent")}>
                <Icon size={24} aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <h3 className="text-ds-md font-extrabold text-ink">{step.title}</h3>
                <div className="mt-1">
                  {step.done
                    ? <Pill tone="ok">Done</Pill>
                    : step.required
                      ? <Pill tone="warn">Needed before patients can book you</Pill>
                      : <Pill tone="idle" icon={null}>Recommended</Pill>}
                </div>
              </div>
            </div>
            <p className="mt-4 text-ds-sm leading-relaxed text-muted">{step.why}</p>
            {step.detail && !step.done && <p className="mt-2 text-ds-sm font-semibold text-ink">{step.detail}</p>}

            <Link href={step.href} onClick={close}
              className={cx(buttonClass(step.done ? "secondary" : "primary", true), "mt-5")}>
              {step.done ? "Review" : step.cta}
            </Link>

            <div className="mt-3 flex items-center justify-between gap-3">
              <button type="button" disabled={index === 0} onClick={() => setIndex(i => i - 1)}
                className={cx("inline-flex items-center gap-1 rounded-lg px-2 py-2 text-ds-sm font-semibold text-muted disabled:invisible", focusRing)}>
                <ArrowLeft size={16} aria-hidden /> Back
              </button>
              {last ? (
                <button type="button" onClick={close} className={cx("rounded-lg px-2 py-2 text-ds-sm font-bold text-accent", focusRing)}>
                  I&apos;ll finish later
                </button>
              ) : (
                <button type="button" onClick={() => setIndex(i => i + 1)}
                  className={cx("inline-flex items-center gap-1 rounded-lg px-2 py-2 text-ds-sm font-bold text-accent", focusRing)}>
                  Next <ArrowRight size={16} aria-hidden />
                </button>
              )}
            </div>

            <ul className="mt-4 space-y-1 border-t border-line pt-4">
              {steps.map((s, i) => (
                <li key={s.key}>
                  <button type="button" onClick={() => setIndex(i)}
                    className={cx("flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-ds-sm", i === index ? "bg-page font-semibold text-ink" : "text-muted hover:bg-page", focusRing)}>
                    {s.done
                      ? <CheckCircle2 size={16} className="flex-none text-success" aria-hidden />
                      : <Circle size={16} className="flex-none text-line" aria-hidden />}
                    <span className="flex-1">{s.title}</span>
                    {s.required && !s.done && <span className="text-ds-2xs font-bold text-warn">Required</span>}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </>
  );
}
