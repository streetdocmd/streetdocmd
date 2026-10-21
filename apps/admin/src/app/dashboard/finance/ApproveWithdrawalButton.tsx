"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import ConfirmModal from "@/components/ui/ConfirmModal";

export default function ApproveWithdrawalButton({
  id,
  summary,
  warning = null,
}: {
  id: string;
  /** e.g. "₦25,000 to Jane Doe (GTBank 0123456789)" */
  summary: string;
  /** Shown in the confirm dialog, e.g. when requests exceed the wallet balance. */
  warning?: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function approve() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/withdrawals/${id}/approve`, { method: "POST" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body?.error ?? `Request failed (${res.status}).`);
        return;
      }
      setOpen(false);
      router.refresh();
    } catch {
      setError("Could not reach the server. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button onClick={() => { setError(null); setOpen(true); }} className="btn-success px-3 py-1.5 text-xs">
        Approve
      </button>
      <ConfirmModal
        open={open}
        title="Approve this withdrawal?"
        tone="success"
        confirmLabel={loading ? "Approving…" : "Approve withdrawal"}
        loading={loading}
        error={error}
        onConfirm={approve}
        onCancel={() => !loading && setOpen(false)}
      >
        <p>Confirm the payout of <strong>{summary}</strong>.</p>
        {warning && (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-red-700">{warning}</p>
        )}
        <p>The amount is deducted from the provider&apos;s wallet and the withdrawal is marked processed.</p>
      </ConfirmModal>
    </>
  );
}
