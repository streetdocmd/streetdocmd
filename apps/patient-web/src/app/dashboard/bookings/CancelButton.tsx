"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ds";

// Cancels through the API, which also closes open dispatch offers and marks
// paid requests for a refund (migration 059)
export default function CancelButton({ bookingId }: { bookingId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function cancel() {
    if (!confirm("Cancel this request? If you've paid, we'll refund you.")) return;
    setLoading(true);
    const res = await fetch(`/api/bookings/${bookingId}/cancel`, { method: "POST" }).catch(() => null);
    setLoading(false);
    if (!res?.ok) {
      const json = await res?.json().catch(() => null);
      alert(json?.error ?? "Could not cancel. Check your connection and try again.");
    }
    router.refresh();
  }

  return (
    <Button variant="danger-outline" size="sm" onClick={cancel} disabled={loading}>
      {loading ? "Cancelling…" : "Cancel"}
    </Button>
  );
}
