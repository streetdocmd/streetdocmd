"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";

export default function ConfirmDeliveryButton({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);

  async function confirmDelivery() {
    if (!confirm("Confirm that you've received your medication?")) return;
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
