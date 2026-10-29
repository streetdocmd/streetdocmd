"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ds";

// Marks a reviewed investigation complete once its follow up is done
export default function CompleteButton({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function complete() {
    setBusy(true);
    const res = await fetch(`/api/investigations/${orderId}/review`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ complete: true }),
    }).catch(() => null);
    setBusy(false);
    if (!res?.ok) { setError("Couldn't update. Please try again."); return; }
    router.refresh();
  }
  return (
    <div>
      <Button size="sm" variant="secondary" onClick={complete} disabled={busy}>{busy ? "Saving…" : "Follow up done"}</Button>
      {error && <p role="alert" className="mt-1 text-ds-xs font-semibold text-danger">{error}</p>}
    </div>
  );
}
