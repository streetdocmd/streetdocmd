"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, FileText, X } from "lucide-react";
import LegalAcceptanceFields, { type LegalAcceptanceValue } from "./LegalAcceptanceFields";
import { TERMS_VERSION, PRIVACY_VERSION } from "@/lib/legal-acceptance";

// Shown across the dashboard (see dashboard/layout.tsx) to a patient who
// hasn't accepted the current Patient Terms of Service / acknowledged the
// current Privacy Policy — e.g. every patient who signed up before v2.0.
// A persistent prompt, not a hard gate: the app keeps working, but the
// banner stays until they tick the same two separate boxes as at sign-up.
export default function PolicyUpdateBanner({ firstTime }: { firstTime?: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [legal, setLegal] = useState<LegalAcceptanceValue>({ terms: false, privacy: false });
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const legalOk = legal.terms && legal.privacy;

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && !saving) setOpen(false); };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", onKey);
    };
  }, [open, saving]);

  function openDialog() {
    // Every review starts unticked — no carry-over from a previous attempt.
    setLegal({ terms: false, privacy: false });
    setSubmitted(false);
    setError("");
    setOpen(true);
  }

  async function accept() {
    if (saving) return;
    setSubmitted(true);
    if (!legalOk) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/legal/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          acceptTerms: legal.terms,
          acknowledgePrivacy: legal.privacy,
          termsVersion: TERMS_VERSION,
          privacyVersion: PRIVACY_VERSION,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error ?? "We couldn't save your acceptance. Please try again.");
        setSaving(false);
        return;
      }
      setDone(true);
      setOpen(false);
      setSaving(false);
      router.refresh();
    } catch {
      setError("Couldn't reach StreetdocMD. Check your internet connection and try again.");
      setSaving(false);
    }
  }

  if (done) return null;

  return (
    <>
      <div className="mb-5 flex flex-col gap-3 rounded-xl border border-amber-200/70 bg-amber-50 px-4 py-3 sm:flex-row sm:items-center">
        <FileText size={18} className="hidden text-amber-600 shrink-0 sm:block" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-amber-900">
            {firstTime ? "Please review our Terms and Privacy Policy" : "We've updated our Terms and Privacy Policy"}
          </p>
          <p className="mt-0.5 text-xs leading-relaxed text-amber-800">
            Please read and accept the Patient Terms of Service and acknowledge the Privacy Policy (version {TERMS_VERSION}).
          </p>
        </div>
        <button type="button" onClick={openDialog} className="btn-primary shrink-0 whitespace-nowrap px-4 py-2 text-sm">
          Review &amp; accept
        </button>
      </div>

      {open && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-navy-900/60 backdrop-blur-[2px] p-3 sm:p-6"
          onClick={e => { if (e.target === e.currentTarget && !saving) setOpen(false); }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="policy-update-title"
            className="flex w-full max-w-lg max-h-[90vh] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
          >
            <div className="flex shrink-0 items-start justify-between gap-4 bg-navy px-5 py-4 sm:px-6">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-blue-200">StreetdocMD</p>
                <h2 id="policy-update-title" className="mt-1 text-lg font-bold text-white">Terms &amp; Privacy Policy</h2>
                <p className="mt-0.5 text-xs text-blue-200">Version {TERMS_VERSION}</p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={saving}
                aria-label="Close"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/10 text-white transition-colors hover:bg-white/20 disabled:opacity-50"
              >
                <X size={16} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-5 sm:px-6">
              <p className="mb-4 text-sm leading-relaxed text-muted">
                Use the <span className="font-semibold">Read</span> links to open each document in full, then tick both
                boxes to continue.
              </p>
              <LegalAcceptanceFields
                value={legal}
                onChange={next => { setLegal(next); if (next.terms && next.privacy) setError(""); }}
                showErrors={submitted}
                idPrefix="reaccept"
              />
              {error && (
                <div role="alert" className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {error}
                </div>
              )}
            </div>

            <div className="flex shrink-0 items-center justify-end gap-2 border-t border-line px-5 py-3.5 sm:px-6">
              <button type="button" onClick={() => setOpen(false)} disabled={saving} className="btn-secondary">
                Not now
              </button>
              <button
                type="button"
                onClick={accept}
                disabled={!legalOk || saving}
                aria-busy={saving}
                className="btn-primary inline-flex items-center gap-1.5"
              >
                {saving ? "Saving…" : <><CheckCircle2 size={15} /> Continue</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
