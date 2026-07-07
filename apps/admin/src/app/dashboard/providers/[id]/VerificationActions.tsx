"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

type Status = "pending" | "under_review" | "verified" | "rejected";

const DOC_LABELS: Record<string, string> = {
  mdcn_licence: "MDCN Licence",
  nmcn_licence: "NMCN Licence",
  nin: "NIN",
  passport: "Passport Photo",
  certificate: "Certificate",
};

export default function VerificationActions({
  providerId,
  currentStatus,
}: {
  providerId: string;
  currentStatus: Status;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<"idle" | "reject">("idle");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function submit(action: "approve" | "reject" | "under_review") {
    if (action === "reject" && mode !== "reject") {
      setMode("reject");
      return;
    }
    if (action === "reject" && !reason.trim()) {
      setError("Please enter a rejection reason so the provider knows what to fix.");
      return;
    }

    setLoading(action);
    setError("");

    const fd = new FormData();
    fd.append("action", action);
    if (action === "reject") fd.append("notes", reason.trim());

    const res = await fetch(`/api/providers/${providerId}/verify`, {
      method: "POST",
      body: fd,
      redirect: "manual",
    });

    if (res.ok || res.status === 0 || res.type === "opaqueredirect") {
      router.refresh();
      setMode("idle");
      setReason("");
    } else {
      setError("Action failed. Please try again.");
    }
    setLoading(null);
  }

  if (currentStatus === "verified") {
    return (
      <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center gap-3">
        <span className="text-green-600 text-xl">✓</span>
        <p className="text-green-700 font-medium text-sm">
          Verified and active on the platform.
        </p>
        <button
          onClick={() => submit("reject")}
          disabled={loading !== null}
          className="ml-auto text-xs text-red-600 border border-red-200 rounded-lg px-3 py-1.5 hover:bg-red-50 transition-colors"
        >
          Revoke
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 space-y-4">
      <h3 className="font-semibold text-gray-900">Verification Decision</h3>

      {mode === "reject" && (
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700">
            Rejection reason <span className="text-red-500">*</span>
          </label>
          <textarea
            value={reason}
            onChange={e => setReason(e.target.value)}
            rows={3}
            placeholder="e.g. MDCN licence number could not be verified. Please upload a clearer copy of your licence."
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400 resize-none"
            autoFocus
          />
          <p className="text-xs text-gray-400">
            This message is shown to the provider on their pending screen.
          </p>
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex gap-3 flex-wrap">
        <button
          onClick={() => submit("approve")}
          disabled={loading !== null}
          className="px-5 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors disabled:opacity-50"
        >
          {loading === "approve" ? "Approving…" : "✓ Approve & Issue Badge"}
        </button>

        {mode !== "reject" && currentStatus !== "under_review" && (
          <button
            onClick={() => submit("under_review")}
            disabled={loading !== null}
            className="px-5 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {loading === "under_review" ? "Updating…" : "Mark Under Review"}
          </button>
        )}

        {mode === "reject" ? (
          <>
            <button
              onClick={() => submit("reject")}
              disabled={loading !== null}
              className="px-5 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition-colors disabled:opacity-50"
            >
              {loading === "reject" ? "Rejecting…" : "Confirm Reject"}
            </button>
            <button
              onClick={() => { setMode("idle"); setReason(""); setError(""); }}
              className="px-5 py-2 border border-gray-200 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
          </>
        ) : (
          <button
            onClick={() => setMode("reject")}
            disabled={loading !== null}
            className="px-5 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition-colors disabled:opacity-50"
          >
            Reject
          </button>
        )}
      </div>
    </div>
  );
}