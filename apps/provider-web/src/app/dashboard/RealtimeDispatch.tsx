"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";

export default function RealtimeDispatch({ providerId }: { providerId: string }) {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`dispatch-${providerId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "dispatch_queue",
          filter: `provider_id=eq.${providerId}`,
        },
        () => router.refresh()
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [providerId, router]);

  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-teal-brand">
      <span className="w-1.5 h-1.5 bg-teal-brand rounded-full animate-pulse" />
      Live
    </span>
  );
}