"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, CheckCircle2, Circle, Loader2, X } from "lucide-react";
import { formatNaira } from "@streetdocmd/shared";
import { createClient } from "@/lib/supabase";
import { Button, cx, focusRing } from "@/components/ds";
import { OPEN_SETUP_EVENT, type SetupState } from "@/lib/setup";
import AvailabilityToggle from "./AvailabilityToggle";

const MAX_RATE = 2_000_000;
type Step = "rates" | "availability" | "profile";
const STEP_LABELS: Record<Step, string> = { rates: "Rates", availability: "Availability", profile: "Profile" };

// Lives in the dashboard layout, so it covers every dashboard page.
//  - Rates missing: opens on its own and can't be closed until they're saved,
//    because patients can't book a provider without them.
//  - Otherwise: opens once per browser session while the provider is offline
//    or still has profile items to fill in. The dashboard card reopens it.
export default function SetupGuide({ setup }: { setup: SetupState }) {
  const router = useRouter();
  const steps: Step[] = [...(setup.rates.length ? ["rates" as const] : []), "availability", "profile"];
  const firstStep: Step = setup.ratesMissing ? "rates" : !setup.available ? "availability" : "profile";
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>(firstStep);
  const panel = useRef<HTMLDivElement>(null);
  const seenKey = `sdm-setup-guide:${setup.providerId}`;
  const locked = setup.ratesMissing;

  const close = useCallback(() => {
    if (locked) return;
    setOpen(false);
    try { sessionStorage.setItem(seenKey, "1"); } catch { /* blocked storage: it opens again next visit */ }
  }, [locked, seenKey]);

  useEffect(() => {
    if (locked) { setStep("rates"); setOpen(true); return; }
    if (setup.complete) return;
    let seen = false;
    try { seen = sessionStorage.getItem(seenKey) === "1"; } catch { /* treat as not seen */ }
    if (!seen) setOpen(true);
  }, [locked, setup.complete, seenKey]);

  useEffect(() => {
    const onOpen = () => { setStep(firstStep); setOpen(true); };
    window.addEventListener(OPEN_SETUP_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_SETUP_EVENT, onOpen);
  }, [firstStep]);

  useEffect(() => {
    if (!open) return;
    panel.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close]);

  if (!open) return null;
  const index = steps.indexOf(step);

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/45 sm:items-center sm:p-4" onClick={close}>
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby="setup-title"
        tabIndex={-1}
        onClick={e => e.stopPropagation()}
        className="max-h-[94dvh] w-full max-w-md overflow-y-auto rounded-t-[28px] bg-surface p-5 shadow-ds outline-none sm:rounded-[28px] sm:p-6"
      >
        <div className="flex items-center justify-between gap-3">
          <ol className="flex items-center gap-2" aria-label="Setup steps">
            {steps.map((s, i) => (
              <li key={s} className="flex items-center gap-2">
                <span aria-current={s === step ? "step" : undefined}
                  className={cx("grid h-6 w-6 place-items-center rounded-full text-[11px] font-bold",
                    i < index ? "bg-success text-white" : s === step ? "bg-accent text-white" : "bg-line text-muted")}>
                  {i < index ? <Check size={13} strokeWidth={3} aria-hidden /> : i + 1}
                </span>
                <span className={cx("text-ds-xs font-semibold", s === step ? "text-ink" : "hidden text-muted sm:inline")}>{STEP_LABELS[s]}</span>
              </li>
            ))}
          </ol>
          {!locked && (
            <button type="button" onClick={close} aria-label="Close"
              className={cx("grid h-9 w-9 flex-none place-items-center rounded-full text-muted hover:bg-page", focusRing)}>
              <X size={18} aria-hidden />
            </button>
          )}
        </div>

        {step === "rates" && (
          <RatesStep setup={setup} onSaved={() => { router.refresh(); setStep("availability"); }} />
        )}
        {step === "availability" && (
          <div>
            <h2 id="setup-title" className="mt-5 text-[22px] font-extrabold leading-tight text-navy">Turn on your availability</h2>
            <p className="mt-2 text-ds-sm leading-relaxed text-muted">
              Patients can only send you visit requests while you&apos;re online. Switch it on whenever you can take visits, and off when you can&apos;t.
            </p>
            <div className="mt-4"><AvailabilityToggle providerId={setup.providerId} initialAvailable={setup.available} /></div>
            <p className="mt-3 text-ds-xs text-muted">If you&apos;re offline, we&apos;ll send you a reminder each morning.</p>
            <Button block className="mt-5" onClick={() => setStep("profile")}>Continue <ArrowRight size={16} aria-hidden /></Button>
          </div>
        )}
        {step === "profile" && (
          <div>
            <h2 id="setup-title" className="mt-5 text-[22px] font-extrabold leading-tight text-navy">Finish your profile</h2>
            <p className="mt-2 text-ds-sm leading-relaxed text-muted">These help patients choose you and make sure you get paid.</p>
            <ul className="mt-4 divide-y divide-line rounded-ds-lg border border-line">
              {setup.items.map(item => (
                <li key={item.key}>
                  <Link href={item.href} onClick={close}
                    className={cx("flex items-start gap-3 p-3.5 hover:bg-page", focusRing)}>
                    {item.done
                      ? <CheckCircle2 size={20} className="mt-0.5 flex-none text-success" aria-hidden />
                      : <Circle size={20} className="mt-0.5 flex-none text-line" aria-hidden />}
                    <span className="min-w-0 flex-1">
                      <b className={cx("block text-ds-sm", item.done ? "text-muted line-through" : "text-ink")}>{item.title}</b>
                      {!item.done && <span className="block text-ds-xs text-muted">{item.why}</span>}
                    </span>
                    {!item.done && <ArrowRight size={16} className="mt-1 flex-none text-accent" aria-hidden />}
                  </Link>
                </li>
              ))}
            </ul>
            <Button block className="mt-5" onClick={close}>Done</Button>
          </div>
        )}
      </div>
    </div>
  );
}

function RatesStep({ setup, onSaved }: { setup: SetupState; onSaved: () => void }) {
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(setup.rates.map(r => [r.type, r.price ? String(r.price) : ""])));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;
    setError("");
    const parsed: Record<string, number> = {};
    for (const r of setup.rates) {
      const n = Number((values[r.type] ?? "").replace(/[₦,\s]/g, ""));
      if (!Number.isInteger(n) || n <= 0) { setError(`Enter your ${r.label} rate in whole naira.`); return; }
      if (n > MAX_RATE) { setError(`${r.label}: rates above ${formatNaira(MAX_RATE)} aren't accepted. Contact us if you need a higher rate.`); return; }
      parsed[r.type] = n;
    }

    setSaving(true);
    const supabase = createClient();
    const now = new Date().toISOString();
    try {
      for (const r of setup.rates) {
        const price = parsed[r.type];
        if (r.rowId) {
          if (r.price !== price) {
            const { error: err } = await supabase.from("provider_services").update({ price, updated_at: now }).eq("id", r.rowId);
            if (err) throw err;
          }
        } else {
          const { error: err } = await supabase.from("provider_services")
            .insert({ provider_id: setup.providerId, profession: setup.profession, name: r.label, price, service_type: r.type });
          if (err) throw err;
        }
      }
      onSaved();
    } catch {
      setError("Couldn't save your rates. Check your connection and try again.");
      setSaving(false);
    }
  }

  return (
    <form onSubmit={save}>
      <h2 id="setup-title" className="mt-5 text-[22px] font-extrabold leading-tight text-navy">Set your rates</h2>
      <p className="mt-2 text-ds-sm leading-relaxed text-muted">
        {setup.ratesMissing
          ? "Patients can't book you until you've set a price for each visit you offer. "
          : "What you charge per visit. "}
        Patients pay your rate with nothing added, and you receive 80 percent of it.
      </p>
      <div className="mt-4 space-y-3">
        {setup.rates.map(r => (
          <div key={r.type} className="flex items-center justify-between gap-3">
            <label htmlFor={`setup-rate-${r.type}`} className="min-w-0 flex-1 text-ds-sm font-semibold text-ink">{r.label}</label>
            <div className="relative w-36 shrink-0">
              <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm text-muted">₦</span>
              <input
                id={`setup-rate-${r.type}`}
                type="number"
                inputMode="numeric"
                min="1"
                step="1"
                required
                className="input pl-8"
                placeholder="Your rate"
                value={values[r.type] ?? ""}
                onChange={e => { setValues(v => ({ ...v, [r.type]: e.target.value })); setError(""); }}
              />
            </div>
          </div>
        ))}
      </div>
      {error && <p role="alert" className="mt-3 text-ds-sm font-semibold text-danger">{error}</p>}
      <Button type="submit" block className="mt-5" disabled={saving}>
        {saving ? <><Loader2 size={16} className="animate-spin" aria-hidden /> Saving…</> : <>Save rates and continue <ArrowRight size={16} aria-hidden /></>}
      </Button>
      {setup.ratesMissing && (
        <p className="mt-3 text-center text-ds-xs text-muted">You can change these any time under Rates and services.</p>
      )}
    </form>
  );
}
