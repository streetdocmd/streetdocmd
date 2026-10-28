"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { Button } from "@/components/ds";

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
    <Button variant="secondary" onClick={cancel} disabled={loading} className="min-h-10 px-4 text-ds-sm text-danger hover:border-danger hover:text-danger">
      {loading ? "Cancelling…" : "Cancel"}
    </Button>
  );
}