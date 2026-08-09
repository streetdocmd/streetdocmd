"use client";
import { useState } from "react";

declare global {
  interface Window {
    PaystackPop: {
      setup: (config: {
        key: string;
        email: string;
        amount: number;
        currency: string;
        ref: string;
        metadata: Record<string, unknown>;
        callback: (response: { reference: string }) => void;
        onClose: () => void;
      }) => { openIframe: () => void };
    };
  }
}

export default function PaystackButton({
  bookingId,
  amount,
  email,
  name,
}: {
  bookingId: string;
  amount: number;
  email: string;
  name: string;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function pay() {
    setLoading(true);
    setError("");

    // Remove any cached Paystack script to avoid version conflicts
    document.querySelectorAll('script[src*="paystack"]').forEach(s => s.remove());
    delete (window as any).PaystackPop;

    const script = document.createElement("script");
    script.src = "https://js.paystack.co/v1/inline.js";
    script.onload = () => {
      const key = process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY ?? "";
      if (!key) {
        setError("Payment is not configured. Please contact support.");
        setLoading(false);
        return;
      }

      const handler = window.PaystackPop.setup({
        key,
        email,
        amount: amount * 100,
        currency: "NGN",
        ref: `SDM-${bookingId}-${Date.now()}`,
        metadata: { booking_id: bookingId, patient_name: name },
        callback: (response) => {
          // Read-only nudge only — the Paystack webhook (server-to-server) is what
          // actually confirms payment and moves the booking to "paid"
          fetch("/api/payments/verify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ reference: response.reference, bookingId }),
          }).catch(() => {});
          window.location.href = `/dashboard/book/finding/${bookingId}`;
        },
        onClose: () => { setLoading(false); },
      });
      handler.openIframe();
    };
    script.onerror = () => {
      setError("Could not load payment processor. Check your connection and try again.");
      setLoading(false);
    };
    document.head.appendChild(script);
  }

  const formatted = new Intl.NumberFormat("en-NG", {
    style: "currency", currency: "NGN", minimumFractionDigits: 0,
  }).format(amount);

  return (
    <div className="space-y-3">
      <button
        onClick={pay}
        disabled={loading}
        className="btn-primary w-full text-center text-base py-3"
      >
        {loading ? "Processing…" : `Pay ${formatted}`}
      </button>
      {error && <p className="text-sm text-red-600 text-center">{error}</p>}
    </div>
  );
}