"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { BadgeCheck, CircleX, Clock, ShieldAlert, TriangleAlert } from "lucide-react";
import ConfirmModal from "@/components/ui/ConfirmModal";

type Status = "pending" | "under_review" | "verified" | "rejected";
type Action = "approve" | "reject" | "under_review";

export default function VerificationActions({
  providerId,
  providerName,
  currentStatus,
  documentCount,
  hasLicence,
  missingDocs = [],
}: {
  providerId: string;
  providerName: string;
  currentStatus: Status;
  documentCount: number;
  hasLicence: boolean;
  /** Labels of required documents not yet uploaded. */
  missingDocs?: string[];
}) {
  const router = useRouter();
  const [modal, setModal] = useState<Action | null>(null);
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const revoking = currentStatus === "verified";

  const close = useCallback(() => {
    if (loading) return;
    setModal(null);
    setError(null);
  }, [loading]);

  function open(action: Action) {
    setError(null);
    setNotice(null);
    setModal(action);
  }

  async function submit(action: Action) {
    if (action === "reject" && !reason.trim()) {
      setError("Please enter a reason so the provider knows what to fix.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/providers/${providerId}/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, notes: action === "reject" ? reason.trim() : null }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body?.error ?? `Action failed (${res.status}).`);
        return;
      }
      setModal(null);
      setReason("");
      const warnings: string[] = body?.warnings ?? [];
      setNotice(warnings.length ? warnings.join(" ") : null);
      router.refresh();
    } catch {
      setError("Could not reach the server. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="card p-5">
      <h2 className="text-sm font-semibold text-gray-900">Verification decision</h2>

      {revoking ? (
        <div className="mt-3 flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex items-center gap-2 text-sm text-green-700 flex-1">
            <BadgeCheck size={18} aria-hidden />
            Verified — badge issued and eligible for visit requests.
          </div>
          <button onClick={() => open("reject")} className="btn-danger-outline">
            <ShieldAlert size={15} aria-hidden /> Revoke verification
          </button>
        </div>
      ) : (
        <>
          <p className="text-sm text-gray-500 mt-1">
            Check the licence number against the regulator&apos;s register and review every document before approving.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button onClick={() => open("approve")} className="btn-success">
              <BadgeCheck size={15} aria-hidden /> Approve &amp; issue badge
            </button>
            {(currentStatus === "pending" || currentStatus === "rejected") && (
              <button onClick={() => open("under_review")} className="btn-secondary">
                <Clock size={15} aria-hidden /> Mark under review
              </button>
            )}
            {currentStatus !== "rejected" && (
              <button onClick={() => open("reject")} className="btn-danger-outline">
                <CircleX size={15} aria-hidden /> Reject
              </button>
            )}
          </div>
        </>
      )}

      {notice && (
        <p className="mt-3 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2" role="status">
          {notice}
        </p>
      )}

      <ConfirmModal
        open={modal === "approve"}
        title={`Approve ${providerName}?`}
        tone="success"
        confirmLabel={loading ? "Approving…" : "Approve & issue badge"}
        loading={loading}
        error={error}
        onConfirm={() => submit("approve")}
        onCancel={close}
      >
        <p>
          The provider gets the verified badge, becomes eligible for visit requests, and is emailed that they&apos;re approved.
        </p>
        {(documentCount === 0 || !hasLicence || missingDocs.length > 0) && (
          <div className="flex gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-800">
            <TriangleAlert size={16} className="shrink-0 mt-0.5" aria-hidden />
            <p>
              {documentCount === 0 ? "No documents have been uploaded. " : missingDocs.length > 0 ? `Missing required documents: ${missingDocs.join(", ")}. ` : ""}
              {!hasLicence ? "No licence number is on file. " : ""}
              Make sure you&apos;ve verified their credentials another way.
            </p>
          </div>
        )}
      </ConfirmModal>

      <ConfirmModal
        open={modal === "under_review"}
        title="Mark under review?"
        confirmLabel={loading ? "Updating…" : "Mark under review"}
        loading={loading}
        error={error}
        onConfirm={() => submit("under_review")}
        onCancel={close}
      >
        <p>Moves this provider to the Under review tab so other admins know it&apos;s being checked.</p>
      </ConfirmModal>

      <ConfirmModal
        open={modal === "reject"}
        title={revoking ? `Revoke ${providerName}'s verification?` : `Reject ${providerName}?`}
        tone="danger"
        confirmLabel={loading ? (revoking ? "Revoking…" : "Rejecting…") : revoking ? "Revoke verification" : "Reject application"}
        loading={loading}
        confirmDisabled={!reason.trim()}
        error={error}
        onConfirm={() => submit("reject")}
        onCancel={close}
      >
        <p>
          {revoking
            ? "Their badge is removed immediately and they stop receiving visit requests."
            : "They can upload corrected documents from the provider app, which puts them back in the review queue."}{" "}
          The reason below is shown to the provider and emailed to them.
        </p>
        <label htmlFor="reject-reason" className="label">
          Reason <span className="text-red-500">*</span>
        </label>
        <textarea
          id="reject-reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={4}
          disabled={loading}
          placeholder="e.g. MDCN licence number could not be verified. Please upload a clearer copy of your current practising licence."
          className="input resize-none"
          autoFocus
        />
      </ConfirmModal>
    </section>
  );
}
