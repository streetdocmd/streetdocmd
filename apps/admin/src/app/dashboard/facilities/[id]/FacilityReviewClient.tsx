"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

const STATUS_COLOR: Record<string, string> = {
  pending:      "bg-yellow-100 text-yellow-700",
  under_review: "bg-blue-100 text-blue-700",
  approved:     "bg-green-100 text-green-700",
  rejected:     "bg-red-100 text-red-700",
};

const PORTAL_URLS: Record<string, string> = {
  lab:      "/lab-portal/login",
  pharmacy: "/pharmacy-portal/login",
  hospital: "/hospital-portal/login",
};

export default function FacilityReviewClient({ application: app }: { application: any }) {
  const router = useRouter();
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [showRejectModal,  setShowRejectModal]  = useState(false);
  const [rejectReason,     setRejectReason]     = useState("");
  const [processing,       setProcessing]       = useState(false);
  const [toast,            setToast]            = useState("");

  const docs = app.documents ?? {};
  const typeData = app.type_specific_data ?? {};

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(""), 4000);
  }

  async function handleApprove() {
    setProcessing(true);
    const res = await fetch(`/api/facilities/${app.id}/review`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "approve" }),
    });
    setProcessing(false);
    setShowApproveModal(false);
    if (res.ok) {
      const data = await res.json();
      showToast(`${app.name} approved. Account created. Temp password: ${data.temp_password}`);
      setTimeout(() => router.push("/dashboard/facilities"), 3000);
    } else {
      showToast("Error approving application. Please try again.");
    }
  }

  async function handleReject() {
    if (!rejectReason.trim()) return;
    setProcessing(true);
    await fetch(`/api/facilities/${app.id}/review`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "reject", rejection_reason: rejectReason }),
    });
    setProcessing(false);
    setShowRejectModal(false);
    showToast("Application rejected and facility notified.");
    setTimeout(() => router.push("/dashboard/facilities"), 2000);
  }

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Toast */}
      {toast && (
        <div className="fixed top-6 left-6 right-6 sm:left-auto z-50 bg-gray-900 text-white px-5 py-3 rounded-xl text-sm shadow-lg max-w-sm">
          {toast}
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <a href="/dashboard/facilities" className="text-sm text-blue-brand hover:underline inline-flex items-center gap-1 mb-2">
            ← Back to Applications
          </a>
          <h1 className="text-2xl font-bold text-gray-900 break-words">{app.name}</h1>
          <div className="flex items-center gap-3 mt-1 flex-wrap">
            <span className="text-sm text-gray-500 capitalize">{app.facility_type}</span>
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_COLOR[app.status] ?? ""}`}>
              {app.status.replace("_", " ")}
            </span>
            <span className="text-xs text-gray-400">{new Date(app.created_at).toLocaleDateString("en-NG")}</span>
          </div>
        </div>

        {app.status !== "approved" && app.status !== "rejected" && (
          <div className="flex flex-col sm:flex-row gap-3">
            <button onClick={() => setShowRejectModal(true)}
              className="px-5 py-2.5 border border-red-300 text-red-600 rounded-xl font-semibold hover:bg-red-50 text-sm">
              Reject
            </button>
            <button onClick={() => setShowApproveModal(true)}
              className="px-5 py-2.5 bg-teal-600 text-white rounded-xl font-semibold hover:bg-teal-700 text-sm">
              Approve & Create Account
            </button>
          </div>
        )}
      </div>

      {/* Basic info */}
      <div className="card p-5 space-y-3">
        <p className="text-sm font-semibold text-gray-700 uppercase tracking-wide text-xs mb-3">Basic Information</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          <Row label="Email"    value={app.email} />
          <Row label="Phone"    value={app.phone} />
          <Row label="Address"  value={`${app.address}, ${app.city ?? ""} ${app.state ?? ""}`.trim()} />
          {app.registration_number && <Row label="Reg. No."   value={app.registration_number} />}
          {app.cac_number          && <Row label="CAC No."    value={app.cac_number} />}
          {app.contact_person_name && <Row label="Contact"    value={`${app.contact_person_name} (${app.contact_person_role ?? ""})`} />}
          {app.operating_hours     && <Row label="Hours"      value={app.operating_hours} />}
        </div>
      </div>

      {/* Type-specific details */}
      <div className="card p-5 space-y-3">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
          {app.facility_type === "lab" ? "Laboratory" : app.facility_type === "pharmacy" ? "Pharmacy" : "Hospital"} Details
        </p>
        {Object.entries(typeData).map(([k, v]) => {
          if (Array.isArray(v)) return <Row key={k} label={k.replace(/_/g, " ")} value={(v as any[]).join(", ") || "—"} />;
          if (typeof v === "boolean") return <Row key={k} label={k.replace(/_/g, " ")} value={v ? "Yes" : "No"} />;
          return <Row key={k} label={k.replace(/_/g, " ")} value={String(v ?? "—")} />;
        })}
      </div>

      {/* Documents */}
      {(docs.licence_url || docs.cac_url || (docs.photo_urls?.length > 0)) && (
        <div className="card p-5 space-y-3">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Documents</p>
          <div className="flex gap-4 flex-wrap">
            {docs.licence_url && (
              <a href={docs.licence_url} target="_blank" rel="noopener noreferrer"
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm hover:bg-gray-200 font-medium">
                📄 View Licence
              </a>
            )}
            {docs.cac_url && (
              <a href={docs.cac_url} target="_blank" rel="noopener noreferrer"
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm hover:bg-gray-200 font-medium">
                📄 View CAC Certificate
              </a>
            )}
            {(docs.photo_urls ?? []).map((url: string, i: number) => (
              <a key={i} href={url} target="_blank" rel="noopener noreferrer"
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm hover:bg-gray-200 font-medium">
                📷 Photo {i + 1}
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Rejection reason if rejected */}
      {app.status === "rejected" && app.rejection_reason && (
        <div className="card p-5 border-red-200 bg-red-50">
          <p className="text-xs font-semibold text-red-600 uppercase tracking-wide mb-2">Rejection Reason</p>
          <p className="text-sm text-red-700">{app.rejection_reason}</p>
        </div>
      )}

      {/* Approve Modal */}
      {showApproveModal && (
        <div className="fixed inset-0 bg-black/40 z-40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full max-h-[90vh] overflow-y-auto space-y-4 shadow-xl">
            <p className="text-lg font-bold text-gray-900">Approve Application</p>
            <p className="text-sm text-gray-600">
              This will:
              <ul className="mt-2 space-y-1 list-disc list-inside">
                <li>Create a partner account for <strong>{app.name}</strong></li>
                <li>Create a login in the {app.facility_type} portal</li>
                <li>Generate a temporary password</li>
              </ul>
            </p>
            <p className="text-xs text-gray-400">
              Portal login URL: <strong>{PORTAL_URLS[app.facility_type]}</strong>
            </p>
            <div className="flex gap-3">
              <button onClick={() => setShowApproveModal(false)}
                className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50">
                Cancel
              </button>
              <button onClick={handleApprove} disabled={processing}
                className="flex-1 py-2.5 bg-teal-600 text-white rounded-xl text-sm font-semibold hover:bg-teal-700 disabled:opacity-50">
                {processing ? "Processing…" : "Confirm Approve"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 bg-black/40 z-40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full max-h-[90vh] overflow-y-auto space-y-4 shadow-xl">
            <p className="text-lg font-bold text-gray-900">Reject Application</p>
            <p className="text-sm text-gray-600">
              Please provide a reason. This will be sent to the facility so they can reapply after addressing the issues.
            </p>
            <textarea
              rows={4}
              className="input resize-none"
              placeholder="Reason for rejection…"
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
            />
            <div className="flex gap-3">
              <button onClick={() => setShowRejectModal(false)}
                className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50">
                Cancel
              </button>
              <button onClick={handleReject} disabled={processing || !rejectReason.trim()}
                className="flex-1 py-2.5 bg-red-600 text-white rounded-xl text-sm font-semibold hover:bg-red-700 disabled:opacity-50">
                {processing ? "Processing…" : "Confirm Reject"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-sm">
      <span className="text-gray-400 capitalize">{label}:</span>{" "}
      <span className="text-gray-800 font-medium">{value}</span>
    </div>
  );
}
