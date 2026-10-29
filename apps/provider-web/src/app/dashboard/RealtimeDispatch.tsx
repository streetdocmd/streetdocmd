"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";

// Listens for new requests while the page is open. The label shows whether
// the provider can receive them: Live when online, Offline when switched off.
export default function RealtimeDispatch({ providerId, available }: { providerId: string; available: boolean }) {
  const router = useRouter();
  const [online, setOnline] = useState(available);

  useEffect(() => setOnline(available), [available]);
  useEffect(() => {
    const onChange = (e: Event) => setOnline(Boolean((e as CustomEvent<boolean>).detail));
    window.addEventListener("sdmd-availability", onChange);
    return () => window.removeEventListener("sdmd-availability", onChange);
  }, []);

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

  return online ? (
    <span className="inline-flex items-center gap-1.5 text-xs text-teal-deep">
      <span className="w-1.5 h-1.5 bg-teal-deep rounded-full animate-pulse" aria-hidden />
      Live
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted">
      <span className="w-1.5 h-1.5 bg-muted rounded-full" aria-hidden />
      Offline
    </span>
  );
}