"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase";

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
    <div className="mt-2 space-y-2">
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex flex-col gap-2 items-end">
        <Link
          href={`/dashboard/book/preferred-provider?retarget=${bookingId}`}
          className="btn-primary text-xs px-3 py-1.5 whitespace-nowrap"
        >
          Choose another provider
        </Link>
        <button
          onClick={searchNearest}
          disabled={loading}
          className="text-xs px-3 py-1.5 rounded-lg font-semibold border border-gray-200 text-gray-600 hover:bg-gray-50 whitespace-nowrap"
        >
          {loading ? "Searching…" : "Search nearest available"}
        </button>
      </div>
    </div>
  );
}
