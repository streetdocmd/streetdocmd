"use client";
import PayPanel from "@/components/PayPanel";
import { useState } from "react";

export default function PayForMedicationButton({ orderId, total }: { orderId: string; total: number }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function pay() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/pharmacy/payment/initialize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId }),
      });
      const json = await res.json();
      if (!res.ok || !json.authorization_url) {
        setError(json.error ?? "Could not start payment. Please try again.");
        setLoading(false);
        return;
      }
      window.location.href = json.authorization_url;
    } catch {
      setError("Could not reach the server. Check your connection and try again.");
      setLoading(false);
    }
  }

  return (
    <PayPanel
      total={total}
      onPay={pay}
      loading={loading}
      loadingLabel="Redirecting to payment…"
      error={error}
      note="Your order is prepared and dispatched once payment is confirmed."
    />
  );
}
