"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, CheckCircle2, ChevronDown, ScrollText } from "lucide-react";
import { FACILITY_AGREEMENT } from "@/lib/legal";
import { agreementState, type FacilityAgreementRecord } from "@/lib/facility-agreement";
import { Spinner, ui } from "@/components/portal/ui";
import AgreementCheckbox from "./AgreementCheckbox";

/**
 * Asks the authorised representative of a facility that registered before the
 * Agreement was captured at sign-up (or that accepted an older version) to
 * review and accept the current Facility Partner Platform Service Agreement.
 * Persistent until accepted, but never blocks the portal.
 */
export default function FacilityAgreementPrompt({
  record, defaultName, collapsible = false,
}: {
  record: Pick<FacilityAgreementRecord, "facilityName" | "contactName" | "version" | "acceptedAt" | "acceptedName">;
  defaultName?: string | null;
  /** Start as a one-line banner that expands to the acceptance form (for every portal page). */
  collapsible?: boolean;
}) {
  const router = useRouter();
  const outdated = agreementState(record) === "outdated";
  const [expanded, setExpanded] = useState(!collapsible);
  const [name, setName] = useState(record.acceptedName ?? record.contactName ?? defaultName ?? "");
  const [agreed, setAgreed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const title = outdated
    ? `We've updated the Facility Partner Agreement (version ${FACILITY_AGREEMENT.version})`
    : "Please accept the Facility Partner Agreement";
  const summary = outdated
    ? `${record.facilityName} accepted version ${record.version}. Please review and accept the current version to keep receiving patients through StreetdocMD.`
    : `We don't yet have a record of ${record.facilityName} accepting the ${FACILITY_AGREEMENT.title}. An authorised representative needs to review and accept it.`;

  async function accept() {
    if (!agreed || saving) return;
    if (name.trim().length < 2) { setError("Enter the full name of the person accepting for the facility."); return; }
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/facility/agreement", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accepted: true, version: FACILITY_AGREEMENT.version, name: name.trim() }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((json as { error?: string }).error ?? "We couldn't record your acceptance. Please try again.");
      setDone(true);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "We couldn't record your acceptance. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  if (done) {
    return (
      <div role="status" className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800 flex items-start gap-2.5">
        <CheckCircle2 size={17} className="mt-0.5 shrink-0" aria-hidden />
        <p>Thank you — the Facility Partner Agreement (version {FACILITY_AGREEMENT.version}) is accepted. You can view it any time from your Account page.</p>
      </div>
    );
  }

  return (
    <section aria-labelledby="agreement-prompt-title" className="rounded-xl border border-amber-200 bg-amber-50/70">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between px-4 sm:px-5 py-4">
        <div className="flex items-start gap-3 min-w-0">
          <span className="w-9 h-9 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
            <ScrollText size={18} aria-hidden />
          </span>
          <div className="min-w-0">
            <h2 id="agreement-prompt-title" className="text-sm font-semibold text-amber-950">{title}</h2>
            <p className="mt-0.5 text-sm text-amber-900/90">{summary}</p>
          </div>
        </div>
        {collapsible && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
            className={`${ui.btnPrimary} shrink-0 self-start`}
          >
            {expanded ? "Hide" : "Review & accept"}
            <ChevronDown size={15} className={`transition-transform ${expanded ? "rotate-180" : ""}`} aria-hidden />
          </button>
        )}
      </div>

      {expanded && (
        <div className="border-t border-amber-200 bg-white/70 px-4 sm:px-5 py-4 space-y-4 rounded-b-xl">
          <div className="max-w-md">
            <label htmlFor="agreement-rep-name" className={ui.label}>Full name of the authorised representative</label>
            <input
              id="agreement-rep-name"
              className={ui.input}
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={saving}
            />
            <p className={ui.hint}>Recorded with your acceptance, together with this login and the date and time.</p>
          </div>

          <AgreementCheckbox doc={FACILITY_AGREEMENT} checked={agreed} onChange={setAgreed} disabled={saving} />

          {error && (
            <p role="alert" className="flex items-start gap-1.5 text-sm text-red-700">
              <AlertCircle size={15} className="mt-0.5 shrink-0" aria-hidden /> {error}
            </p>
          )}

          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            <button type="button" onClick={accept} disabled={!agreed || saving || name.trim().length < 2} className={ui.btnPrimary}>
              {saving ? <><Spinner /> Recording acceptance…</> : "Accept agreement"}
            </button>
            {!agreed && <p className="text-xs text-muted">Tick the box above to enable this button.</p>}
          </div>
        </div>
      )}
    </section>
  );
}
