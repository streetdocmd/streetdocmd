"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, useDialog } from "@/components/ds";

// Cancels through the API, which also closes open dispatch offers and marks
// paid requests for a refund (migration 059)
export default function CancelButton({ bookingId }: { bookingId: string }) {
  const dialog = useDialog();
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function cancel() {
    if (!(await dialog.confirm({ title: "Cancel this request?", message: "If you've paid, we'll refund you.", confirmLabel: "Cancel request", cancelLabel: "Keep it", tone: "danger" }))) return;
    setLoading(true);
    const res = await fetch(`/api/bookings/${bookingId}/cancel`, { method: "POST" }).catch(() => null);
    setLoading(false);
    if (!res?.ok) {
      const json = await res?.json().catch(() => null);
      await dialog.alert({ title: "Couldn't cancel", message: json?.error ?? "Check your connection and try again." });
    }
    router.refresh();
  }

  return (
    <Button variant="danger-outline" size="sm" onClick={cancel} disabled={loading}>
      {loading ? "Cancelling…" : "Cancel"}
    </Button>
  );
}
