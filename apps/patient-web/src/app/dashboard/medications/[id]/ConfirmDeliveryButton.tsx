"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";

import { useDialog } from "@/components/ds";
export default function ConfirmDeliveryButton({ orderId }: { orderId: string }) {
  const dialog = useDialog();
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);

  async function confirmDelivery() {
    if (!(await dialog.confirm({ title: "Received your medication?", message: "Confirm only once the order is in your hands.", confirmLabel: "Yes, received" }))) return;
    setConfirming(true);
    const supabase = createClient();
    await supabase.from("prescription_orders").update({ status: "delivered" }).eq("id", orderId);
    setConfirming(false);
    router.refresh();
  }

  return (
    <button onClick={confirmDelivery} disabled={confirming} className="btn-success w-full mb-4">
      {confirming ? "Confirming…" : "I've Received My Medication"}
    </button>
  );
}
