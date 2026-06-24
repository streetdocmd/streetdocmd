"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";

export default function TrackingClient({ bookingId, initialStatus }: { bookingId: string; initialStatus: string }) {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`booking-web-${bookingId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "bookings", filter: `id=eq.${bookingId}` },
        () => { router.refresh(); }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [bookingId, router]);

  return (
    <div className="mt-4 text-center">
      <div className="inline-flex items-center gap-2 text-sm text-gray-400">
        <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse inline-block" />
        Live updates active
      </div>
    </div>
  );
}