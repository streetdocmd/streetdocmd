"use client";
import { useState } from "react";

export default function PayForMedicationButton({ orderId }: { orderId: string }) {
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
    <div>
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3 mb-4">{error}</div>
      )}
      <button onClick={pay} disabled={loading} className="btn-primary w-full text-base py-3">
        {loading ? "Redirecting to payment…" : "Pay Now"}
      </button>
    </div>
  );
}
