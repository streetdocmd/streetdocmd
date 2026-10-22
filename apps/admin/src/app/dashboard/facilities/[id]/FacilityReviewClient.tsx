"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import {
  FlaskConical, Pill, Hospital, FileText, ExternalLink, Info, Copy, Check,
  CircleCheck, KeyRound, Clock, CircleX, TriangleAlert, Eye, FileClock,
} from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";
import StatusBadge from "@/components/ui/StatusBadge";
import ConfirmModal, { Spinner } from "@/components/ui/ConfirmModal";
import EmptyState from "@/components/ui/EmptyState";
import { facilityDocLabel, facilityDocSpecs, missingFacilityDocs, type FacilityDocument } from "@/lib/facility-docs";

const TYPE_META: Record<string, { label: string; icon: typeof Pill; portal: string }> = {
  lab:      { label: "Laboratory", icon: FlaskConical, portal: "/lab-portal/login" },
  pharmacy: { label: "Pharmacy",   icon: Pill,         portal: "/pharmacy-portal/login" },
  hospital: { label: "Hospital",   icon: Hospital,     portal: "/hospital-portal/login" },
};

type ApproveResult = {
  temp_password: string | null;
  login_email: string | null;
  portal_url: string | null;
  sms_sent: boolean;
};

function fmtDate(d?: string | null, withTime = false) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-NG", {
    day: "numeric", month: "short", year: "numeric",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  });
}

function humanise(key: string) {
  return key.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
}

function displayValue(v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  if (Array.isArray(v)) return v.filter(Boolean).join(", ") || "—";
  if (typeof v === "boolean") return v ? "Yes" : "No";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

async function readError(res: Response) {
  const data = await res.json().catch(() => ({}));
  return (data as { error?: string }).error ?? `Request failed (${res.status}).`;
}

export default function FacilityReviewClient({
  application: app,
  reviewerName,
  uploads = [],
  uploadsUnavailable = false,
}: {
  application: any;
  reviewerName?: string | null;
  /** Files the facility uploaded from its portal (facility_documents), newest first. */
  uploads?: FacilityDocument[];
  /** facility_documents doesn't exist yet (migration 052 not applied). */
  uploadsUnavailable?: boolean;
}) {
  const router = useRouter();
  const [modal, setModal] = useState<"approve" | "reject" | "review" | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [approved, setApproved] = useState<ApproveResult | null>(null);
  const [copied, setCopied] = useState(false);

  const meta = TYPE_META[app.facility_type] ?? { label: humanise(app.facility_type ?? "Facility"), icon: FileText, portal: "" };
  const TypeIcon = meta.icon;
  const docs: Record<string, unknown> = app.documents ?? {};
  const typeData: Record<string, unknown> = app.type_specific_data ?? {};
  const isOpen = app.status === "pending" || app.status === "under_review";
  const hasLogin = !!app.user_id;
  const missingDocs = uploadsUnavailable ? [] : missingFacilityDocs(app.facility_type, uploads.map((d) => d.document_type));
  const docsComplete = missingDocs.length === 0;
  const requiredCount = facilityDocSpecs(app.facility_type).filter((s) => s.required).length;
  // Required types first (in spec order), then anything else.
  const specOrder = facilityDocSpecs(app.facility_type).map((s) => s.type as string);
  const sortedUploads = [...uploads].sort((a, b) => {
    const ia = specOrder.indexOf(a.document_type), ib = specOrder.indexOf(b.document_type);
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || b.uploaded_at.localeCompare(a.uploaded_at);
  });

  const closeModal = useCallback(() => {
    if (processing) return;
    setModal(null);
    setError(null);
  }, [processing]);

  async function post(body: Record<string, unknown>, method: "POST" | "PATCH" = "POST") {
    setProcessing(true);
    setError(null);
    try {
      const res = await fetch(`/api/facilities/${app.id}/review`, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        setError(await readError(res));
        return null;
      }
      return await res.json().catch(() => ({}));
    } catch {
      setError("Could not reach the server. Check your connection and try again.");
      return null;
    } finally {
      setProcessing(false);
    }
  }

  async function handleApprove() {
    const data = await post({ action: "approve" });
    if (!data) return;
    setModal(null);
    setApproved({
      temp_password: data.temp_password ?? null,
      login_email: data.login_email ?? app.email ?? null,
      portal_url: data.portal_url ?? null,
      sms_sent: !!data.sms_sent,
    });
  }

  async function handleReject() {
    if (!rejectReason.trim()) return;
    const data = await post({ action: "reject", rejection_reason: rejectReason.trim() });
    if (!data) return;
    setModal(null);
    router.refresh();
  }

  async function handleUnderReview() {
    const data = await post({ action: "under_review" }, "PATCH");
    if (!data) return;
    setModal(null);
    router.refresh();
  }

  async function copyPassword() {
    if (!approved?.temp_password) return;
    try {
      await navigator.clipboard.writeText(approved.temp_password);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable — the password stays visible to copy manually */
    }
  }

  const docEntries = Object.entries(docs).flatMap(([key, value]) =>
    Array.isArray(value)
      ? value.filter(Boolean).map((v, i) => ({ key: `${key}-${i}`, label: `${humanise(key.replace(/_urls?$/, ""))} ${i + 1}`, value: String(v) }))
      : value
        ? [{ key, label: humanise(key.replace(/_urls?$/, "")), value: String(value) }]
        : []
  );

  return (
    <div className="max-w-4xl">
      <PageHeader
        backHref="/dashboard/facilities"
        backLabel="Facility applications"
        title={app.name}
        meta={
          <>
            <span className="inline-flex items-center gap-1.5 text-sm text-gray-600">
              <TypeIcon size={15} className="text-gray-400" aria-hidden />
              {meta.label}
            </span>
            <span className="text-gray-300" aria-hidden>·</span>
            <StatusBadge status={app.status} />
            <span className="text-gray-300" aria-hidden>·</span>
            <span className="text-sm text-gray-500">Submitted {fmtDate(app.created_at)}</span>
          </>
        }
        actions={
          isOpen ? (
            <>
              {app.status === "pending" && (
                <button onClick={() => setModal("review")} className="btn-secondary">
                  <Clock size={15} aria-hidden /> Mark under review
                </button>
              )}
              <button onClick={() => { setModal("reject"); setError(null); }} className="btn-danger-outline">
                <CircleX size={15} aria-hidden /> Reject
              </button>
              <button onClick={() => { setModal("approve"); setError(null); }} className="btn-success">
                <CircleCheck size={15} aria-hidden /> Approve
              </button>
            </>
          ) : undefined
        }
      />

      <div className="space-y-5">
        {/* Decision summary for closed applications */}
        {app.status === "approved" && (
          <div className="card border-green-200 bg-green-50/60 p-5 flex gap-3">
            <CircleCheck size={20} className="text-green-600 shrink-0 mt-0.5" aria-hidden />
            <div className="text-sm">
              <p className="font-semibold text-green-800">Approved {fmtDate(app.reviewed_at, true)}{reviewerName ? ` by ${reviewerName}` : ""}</p>
              <p className="text-green-700 mt-0.5">
                The partner is live. Staff sign in at <span className="font-medium">{meta.portal}</span> with {app.email}.
              </p>
            </div>
          </div>
        )}
        {app.status === "rejected" && (
          <div className="card border-red-200 bg-red-50/60 p-5 flex gap-3">
            <CircleX size={20} className="text-red-600 shrink-0 mt-0.5" aria-hidden />
            <div className="text-sm">
              <p className="font-semibold text-red-800">Rejected {fmtDate(app.reviewed_at, true)}{reviewerName ? ` by ${reviewerName}` : ""}</p>
              {app.rejection_reason && <p className="text-red-700 mt-1 whitespace-pre-wrap">{app.rejection_reason}</p>}
            </div>
          </div>
        )}

        {isOpen && !hasLogin && (
          <div className="card border-blue-200 bg-blue-50/60 p-4 flex gap-3 text-sm text-blue-800">
            <Info size={18} className="shrink-0 mt-0.5" aria-hidden />
            <p>
              This application was submitted before facilities created their own login. Approving it creates a portal
              login for <strong>{app.email}</strong> with a temporary password, shown to you once after approval.
            </p>
          </div>
        )}

        <section className="card">
          <h2 className="px-5 pt-5 pb-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Facility details</h2>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4 px-5 pb-5 text-sm">
            <Field label="Email" value={app.email} />
            <Field label="Phone" value={app.phone} />
            <Field label="Address" value={[app.address, app.city, app.state].filter(Boolean).join(", ")} wide />
            <Field label="Registration no." value={app.registration_number} />
            <Field label="CAC no." value={app.cac_number} />
            <Field
              label="Contact person"
              value={app.contact_person_name ? `${app.contact_person_name}${app.contact_person_role ? ` (${app.contact_person_role})` : ""}` : null}
            />
            <Field label="Operating hours" value={app.operating_hours} />
            <Field label="Portal login" value={hasLogin ? `Created at registration (${app.email})` : "Not yet created"} />
          </dl>
        </section>

        <section className="card">
          <h2 className="px-5 pt-5 pb-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{meta.label} details</h2>
          {Object.keys(typeData).length === 0 ? (
            <p className="px-5 pb-5 text-sm text-gray-400">No additional details were provided.</p>
          ) : (
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4 px-5 pb-5 text-sm">
              {Object.entries(typeData).map(([k, v]) => (
                <Field key={k} label={humanise(k)} value={displayValue(v)} />
              ))}
            </dl>
          )}
        </section>

        <section className="card">
          <div className="flex flex-wrap items-center justify-between gap-2 px-5 pt-5 pb-3">
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Documents <span className="normal-case font-normal text-gray-400">({uploads.length} uploaded)</span>
            </h2>
            {!uploadsUnavailable && (
              docsComplete ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-green-50 text-green-700 ring-1 ring-inset ring-green-200 px-2.5 py-0.5 text-xs font-semibold">
                  <CircleCheck size={12} aria-hidden /> Documents complete
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200 px-2.5 py-0.5 text-xs font-semibold">
                  <FileClock size={12} aria-hidden /> Awaiting documents ({requiredCount - missingDocs.length}/{requiredCount})
                </span>
              )
            )}
          </div>

          {uploadsUnavailable ? (
            <p className="mx-5 mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-800">
              Portal document uploads aren&apos;t set up yet. Apply migration 052 (facility_documents).
            </p>
          ) : missingDocs.length > 0 && (
            <div className="mx-5 mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-800 flex gap-2">
              <TriangleAlert size={16} className="shrink-0 mt-0.5" aria-hidden />
              <div>
                <p className="font-medium">Missing required documents</p>
                <ul className="mt-1 flex flex-wrap gap-1.5">
                  {missingDocs.map((m) => (
                    <li key={m.type} className="rounded-full bg-white/70 ring-1 ring-inset ring-amber-200 px-2 py-0.5 text-xs">{m.label}</li>
                  ))}
                </ul>
                <p className="mt-1.5 text-xs text-amber-700">The facility uploads these from its partner portal while the application is open.</p>
              </div>
            </div>
          )}

          {sortedUploads.length > 0 && (
            <ul className="px-5 pb-4 divide-y divide-gray-100">
              {sortedUploads.map((d) => (
                <li key={d.id} className="flex items-center gap-3 py-3">
                  <FileText size={18} className="text-gray-400 shrink-0" aria-hidden />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900">{facilityDocLabel(d.document_type)}</p>
                    <p className="text-xs text-gray-500 truncate">
                      {d.file_name ?? "Uploaded file"} · Uploaded {fmtDate(d.uploaded_at, true)}
                    </p>
                  </div>
                  <a
                    href={`/api/facilities/${app.id}/documents/${d.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-secondary px-3 py-1.5 text-xs shrink-0"
                  >
                    <Eye size={13} aria-hidden /> View
                  </a>
                </li>
              ))}
            </ul>
          )}

          {docEntries.length > 0 && (
            <>
              <h3 className="px-5 pt-1 pb-2 text-xs font-medium text-gray-500">Submitted with the application</h3>
              <ul className="px-5 pb-5 grid gap-2 sm:grid-cols-2">
                {docEntries.map((d) => {
                  const isUrl = /^https?:\/\//i.test(d.value);
                  return (
                    <li key={d.key}>
                      {isUrl ? (
                        <a
                          href={d.value}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-3 rounded-lg border border-gray-200 px-3 py-2.5 hover:bg-gray-50 transition-colors"
                        >
                          <FileText size={16} className="text-gray-400 shrink-0" aria-hidden />
                          <span className="flex-1 text-sm font-medium text-gray-800 truncate">{d.label}</span>
                          <ExternalLink size={14} className="text-gray-400" aria-hidden />
                        </a>
                      ) : (
                        <div className="flex items-center gap-3 rounded-lg border border-gray-200 px-3 py-2.5">
                          <FileText size={16} className="text-gray-400 shrink-0" aria-hidden />
                          <span className="flex-1 min-w-0">
                            <span className="block text-sm font-medium text-gray-800">{d.label}</span>
                            <span className="block text-xs text-gray-400 truncate font-mono">{d.value}</span>
                          </span>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </>
          )}

          {sortedUploads.length === 0 && docEntries.length === 0 && (
            <EmptyState
              compact
              icon={FileText}
              title="No documents uploaded yet"
              description="The facility uploads its documents from its partner portal. You can also verify the registration and CAC numbers above with the issuing body."
            />
          )}
          {sortedUploads.length > 0 && (
            <p className="px-5 pb-4 text-xs text-gray-400">View opens a private link that expires after 2 minutes.</p>
          )}
        </section>
      </div>

      {/* Approve */}
      <ConfirmModal
        open={modal === "approve"}
        title={`Approve ${app.name}?`}
        confirmLabel={processing ? "Approving…" : "Approve facility"}
        tone="success"
        loading={processing}
        error={error}
        onConfirm={handleApprove}
        onCancel={closeModal}
      >
        <p>This will:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Create an active {meta.label.toLowerCase()} partner record for <strong>{app.name}</strong></li>
          {hasLogin ? (
            <li>Activate the portal login they created at registration (<strong>{app.email}</strong>)</li>
          ) : (
            <li>Create a portal login for <strong>{app.email}</strong> with a temporary password</li>
          )}
          <li>Send the facility an SMS with sign-in details (if SMS is configured)</li>
        </ul>
        <p className="text-xs text-gray-500">Portal: {meta.portal}</p>
        {missingDocs.length > 0 && (
          <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-800">
            <TriangleAlert size={16} className="shrink-0 mt-0.5" aria-hidden />
            <p>
              <strong>Required documents missing:</strong> {missingDocs.map((m) => m.label).join(", ")}.
              Only approve if you&apos;ve verified these another way.
            </p>
          </div>
        )}
      </ConfirmModal>

      {/* Reject */}
      <ConfirmModal
        open={modal === "reject"}
        title="Reject application"
        confirmLabel={processing ? "Rejecting…" : "Reject application"}
        tone="danger"
        loading={processing}
        confirmDisabled={!rejectReason.trim()}
        error={error}
        onConfirm={handleReject}
        onCancel={closeModal}
      >
        <p>The reason is sent to the facility by SMS so they can fix it and reapply.</p>
        <label htmlFor="reject-reason" className="label">Reason <span className="text-red-500">*</span></label>
        <textarea
          id="reject-reason"
          rows={4}
          className="input resize-none"
          placeholder="e.g. The premises licence number could not be verified with PCN. Please reapply with a valid licence."
          value={rejectReason}
          onChange={(e) => setRejectReason(e.target.value)}
          disabled={processing}
          autoFocus
        />
      </ConfirmModal>

      {/* Under review */}
      <ConfirmModal
        open={modal === "review"}
        title="Mark under review?"
        confirmLabel={processing ? "Updating…" : "Mark under review"}
        loading={processing}
        error={error}
        onConfirm={handleUnderReview}
        onCancel={closeModal}
      >
        <p>Lets other admins see that someone is already checking this application.</p>
      </ConfirmModal>

      {/* Result after approval — stays until dismissed so a temporary password can be copied. */}
      <ConfirmModal
        open={!!approved}
        title={`${app.name} approved`}
        confirmLabel="Done"
        tone="primary"
        hideCancel
        onConfirm={() => { router.push("/dashboard/facilities"); router.refresh(); }}
        onCancel={() => { setApproved(null); router.refresh(); }}
      >
        <div className="flex items-start gap-3 rounded-lg bg-green-50 border border-green-200 p-3 text-green-800">
          <CircleCheck size={18} className="shrink-0 mt-0.5" aria-hidden />
          <p>The partner is now active and can sign in at <strong>{meta.portal}</strong>.</p>
        </div>
        <dl className="space-y-2">
          <div className="flex justify-between gap-4"><dt className="text-gray-500">Login email</dt><dd className="font-medium text-gray-900 break-all text-right">{approved?.login_email ?? "—"}</dd></div>
          <div className="flex justify-between gap-4"><dt className="text-gray-500">SMS to facility</dt><dd className="font-medium text-gray-900">{approved?.sms_sent ? "Sent" : "Not sent — share details manually"}</dd></div>
        </dl>
        {approved?.temp_password ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
            <p className="flex items-center gap-1.5 text-xs font-semibold text-amber-800 uppercase tracking-wide">
              <KeyRound size={13} aria-hidden /> Temporary password — shown once
            </p>
            <div className="mt-2 flex items-center gap-2">
              <code className="flex-1 rounded-md bg-white border border-amber-200 px-3 py-2 font-mono text-base text-gray-900 select-all">
                {approved.temp_password}
              </code>
              <button type="button" onClick={copyPassword} className="btn-secondary px-3" aria-label="Copy temporary password">
                {copied ? <Check size={15} className="text-green-600" /> : <Copy size={15} />}
              </button>
            </div>
            <p className="mt-2 text-xs text-amber-800">Share it securely and ask them to change it after first sign-in.</p>
          </div>
        ) : (
          <p className="text-gray-500">They sign in with the password they chose when registering.</p>
        )}
      </ConfirmModal>

      {processing && modal === null && (
        <div className="fixed bottom-6 right-6 card px-4 py-3 text-sm flex items-center gap-2 shadow-lg">
          <Spinner className="text-blue-brand" /> Working…
        </div>
      )}
    </div>
  );
}

function Field({ label, value, wide = false }: { label: string; value?: string | null; wide?: boolean }) {
  return (
    <div className={wide ? "sm:col-span-2" : ""}>
      <dt className="text-xs text-gray-500">{label}</dt>
      <dd className="mt-0.5 font-medium text-gray-900 break-words">{value || "—"}</dd>
    </div>
  );
}
