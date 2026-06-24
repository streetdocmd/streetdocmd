"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

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
        onSuccess: (transaction: { reference: string }) => void;
        onCancel: () => void;
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
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function pay() {
    setLoading(true);

    const script = document.createElement("script");
    script.src = "https://js.paystack.co/v1/inline.js";
    script.onload = () => {
      const reference = `SDM-${bookingId}-${Date.now()}`;
      const handler = window.PaystackPop.setup({
        key: process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY ?? "",
        email,
        amount: amount * 100,
        currency: "NGN",
        ref: reference,
        metadata: { booking_id: bookingId, patient_name: name },
        onSuccess: async (transaction) => {
          await fetch("/api/payments/verify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ reference: transaction.reference, bookingId }),
          });
          router.push(`/dashboard/book/tracking/${bookingId}`);
        },
        onCancel: () => { setLoading(false); },
      });
      handler.openIframe();
    };
    document.head.appendChild(script);
  }

  return (
    <button onClick={pay} disabled={loading} className="btn-primary w-full text-center text-base py-3">
      {loading ? "Opening payment…" : `Pay ${new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", minimumFractionDigits: 0 }).format(amount)}`}
    </button>
  );
}