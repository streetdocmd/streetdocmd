"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { Button } from "@/components/ds";

export default function ProviderDeclinedActions({ bookingId }: { bookingId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function searchNearest() {
    setLoading(true);
    setError("");
    const supabase = createClient();
    const { error } = await supabase.rpc("retry_dispatch_broad", { p_booking_id: bookingId });
    setLoading(false);
    if (error) { setError(error.message); return; }
    router.refresh();
  }

  return (
    <div className="mt-3 space-y-2">
      {error && <p className="text-ds-xs font-semibold text-danger">{error}</p>}
      <div className="flex flex-wrap gap-2">
        <Button href={`/dashboard/book/preferred-provider?retarget=${bookingId}`} className="min-h-10 px-4 text-ds-sm">
          Choose another provider
        </Button>
        <Button variant="secondary" onClick={searchNearest} disabled={loading} className="min-h-10 px-4 text-ds-sm">
          {loading ? "Searching…" : "Search nearest available"}
        </Button>
      </div>
    </div>
  );
}
