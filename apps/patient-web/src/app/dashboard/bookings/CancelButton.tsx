"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";

export default function CancelButton({ bookingId }: { bookingId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function cancel() {
    if (!confirm("Cancel this booking?")) return;
    setLoading(true);
    const supabase = createClient();
    await supabase.from("bookings").update({ status: "cancelled" }).eq("id", bookingId).eq("status", "pending");
    setLoading(false);
    router.refresh();
  }

  return (
    <button onClick={cancel} disabled={loading} className="btn-danger text-xs px-3 py-1.5">
      {loading ? "…" : "Cancel"}
    </button>
  );
}