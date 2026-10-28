"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Inbox, Activity, CheckCircle2, FileText, Phone, Stethoscope, AlertTriangle, AlertCircle, Lock } from "lucide-react";
import { useLiveRefresh } from "@/components/portal/useLiveRefresh";
import { REFERRAL_STATUS, URGENCY } from "@/components/portal/statuses";
import { Card, EmptyState, Notice, PageHeader, Spinner, StatCard, StatusBadge, formatDateTime, ui } from "@/components/portal/ui";

export interface ReferralRow {
  id: string;
  status: string;
  urgency: string;
  reason: string | null;
  referred_at: string;
  pdf_url: string | null;
  clinical_summary: string | null;
  patient_label: string;
  patient_phone: string | null;
  referred_by: string | null;
  revealed: boolean;
}

type Tab = "new" | "in_progress" | "history";

export default function ReferralsClient({ referrals, partnerId, facilityName, loadError }: {
  referrals: ReferralRow[];
  partnerId: string | null;
  facilityName: string | null;
  loadError: string | null;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("new");
  const [updating, setUpdating] = useState<string | null>(null);
  const [error, setError] = useState("");
  useLiveRefresh("hospital_referrals", partnerId ? `hospital_partner_id=eq.${partnerId}` : null);

  const newRefs = referrals.filter(r => r.status === "pending");
  const inProgress = referrals.filter(r => ["acknowledged", "in_progress"].includes(r.status));
  const history = referrals.filter(r => ["completed", "cancelled"].includes(r.status));
  const visible = tab === "new" ? newRefs : tab === "in_progress" ? inProgress : history;

  async function updateStatus(id: string, status: string) {
    setUpdating(id);
    setError("");
    const res = await fetch(`/api/hospital-portal/referrals/${id}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    setUpdating(null);
    if (!res.ok) {
      const b = await res.json().catch(() => ({}));
      setError(b.error ?? "Couldn't update the referral. Please try again.");
      return;
    }
    router.refresh();
  }

  const tabs: [Tab, string, number][] = [
    ["new", "New", newRefs.length],
    ["in_progress", "In progress", inProgress.length],
    ["history", "History", history.length],
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Referrals"
        description={facilityName
          ? `Patients referred to ${facilityName} by StreetdocMD doctors. New referrals appear here automatically.`
          : "Referrals across all partner hospitals."}
      />

      {loadError && <Notice tone="red" icon={AlertTriangle}>{loadError}</Notice>}
      {error && <Notice tone="red" icon={AlertCircle}>{error}</Notice>}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard label="New referrals" value={newRefs.length} icon={Inbox} tone="amber" hint="Waiting for acknowledgement" />
        <StatCard label="In progress" value={inProgress.length} icon={Activity} tone="blue" hint="Acknowledged or arrived" />
        <StatCard label="Completed" value={referrals.filter(r => r.status === "completed").length} icon={CheckCircle2} tone="green" />
      </div>

      <Card>
        <div className="flex gap-1 px-3 pt-3 border-b border-line overflow-x-auto" role="tablist">
          {tabs.map(([v, label, count]) => (
            <button key={v} role="tab" aria-selected={tab === v} onClick={() => setTab(v)}
              className={`px-3 py-2.5 text-sm font-medium border-b-2 -mb-px whitespace-nowrap transition-colors ${
                tab === v ? "border-accent text-accent" : "border-transparent text-muted hover:text-ink"
              }`}>
              {label} <span className="ml-1 text-xs text-muted">{count}</span>
            </button>
          ))}
        </div>

        {visible.length === 0 ? (
          <EmptyState
            icon={Inbox}
            title={referrals.length === 0 ? "No referrals yet" : "Nothing here"}
            description={referrals.length === 0
              ? "When a StreetdocMD doctor refers a patient to your hospital, it shows up here and we send you an SMS."
              : "No referrals in this category."}
          />
        ) : (
          <ul className="divide-y divide-line">
            {visible.map(r => {
              const s = REFERRAL_STATUS[r.status] ?? { label: r.status, tone: "gray" as const };
              const u = URGENCY[r.urgency] ?? { label: r.urgency, tone: "gray" as const };
              const busy = updating === r.id;
              return (
                <li key={r.id} className="px-5 py-4 space-y-3">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-ink">{r.patient_label}</p>
                        <StatusBadge tone={u.tone}>{u.label}</StatusBadge>
                        <StatusBadge tone={s.tone}>{s.label}</StatusBadge>
                      </div>
                      <p className="text-xs text-muted">
                        {r.referred_by ? <span className="inline-flex items-center gap-1"><Stethoscope size={12} aria-hidden /> {r.referred_by} · </span> : null}
                        {formatDateTime(r.referred_at)}
                      </p>
                    </div>
                    {r.pdf_url && (
                      <a href={r.pdf_url} target="_blank" rel="noreferrer" className={`${ui.btnLink} inline-flex items-center gap-1`}>
                        <FileText size={14} aria-hidden /> Referral letter
                      </a>
                    )}
                  </div>
                  {r.reason && <p className="text-sm text-ink"><span className="font-medium">Reason:</span> {r.reason}</p>}
                  {r.clinical_summary && <p className="text-sm text-muted bg-page rounded-lg px-3 py-2">{r.clinical_summary}</p>}
                  {r.patient_phone && (
                    <a href={`tel:${r.patient_phone}`} className="inline-flex items-center gap-1.5 text-sm text-accent hover:underline">
                      <Phone size={14} aria-hidden /> {r.patient_phone}
                    </a>
                  )}
                  {!r.revealed && r.status === "pending" && (
                    <p className="text-xs text-muted inline-flex items-center gap-1.5">
                      <Lock size={12} aria-hidden /> Full patient details and clinical summary unlock when you acknowledge.
                    </p>
                  )}
                  {(r.status === "pending" || r.status === "acknowledged" || r.status === "in_progress") && (
                    <div className="flex flex-wrap gap-2 pt-1">
                      {r.status === "pending" && (
                        <button onClick={() => updateStatus(r.id, "acknowledged")} disabled={busy} className={ui.btnPrimary}>
                          {busy ? <><Spinner /> Updating…</> : "Acknowledge referral"}
                        </button>
                      )}
                      {r.status === "acknowledged" && (
                        <button onClick={() => updateStatus(r.id, "in_progress")} disabled={busy} className={ui.btnSecondary}>
                          Patient arrived
                        </button>
                      )}
                      {(r.status === "acknowledged" || r.status === "in_progress") && (
                        <button onClick={() => updateStatus(r.id, "completed")} disabled={busy} className={ui.btnSuccess}>
                          {busy ? <><Spinner /> Updating…</> : "Mark completed"}
                        </button>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
