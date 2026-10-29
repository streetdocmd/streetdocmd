"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";

interface Source {
  table: string;
  /** Realtime filter, e.g. "id=eq.<uuid>". Rows are already limited to what the viewer may read. */
  filter?: string;
}

/**
 * Re-renders a server-fetched page as soon as rows it shows change, so
 * statuses update without a reload. A periodic refresh covers anything that
 * isn't broadcast (or a dropped connection).
 */
export default function LiveRefresh({ sources, intervalMs = 30_000 }: { sources: Source[]; intervalMs?: number }) {
  const router = useRouter();
  const key = sources.map(s => `${s.table}:${s.filter ?? "*"}`).join("|");

  useEffect(() => {
    const supabase = createClient();
    let timeout: ReturnType<typeof setTimeout> | null = null;
    const refresh = () => {
      if (timeout) clearTimeout(timeout);
      timeout = setTimeout(() => router.refresh(), 300);
    };
    let channel = supabase.channel(`live-${key}`);
    for (const s of key.split("|")) {
      const [table, filter] = s.split(":");
      channel = channel.on(
        "postgres_changes",
        { event: "*", schema: "public", table, ...(filter && filter !== "*" ? { filter } : {}) },
        refresh,
      );
    }
    channel.subscribe();
    const onVisible = () => { if (document.visibilityState === "visible") router.refresh(); };
    document.addEventListener("visibilitychange", onVisible);
    const interval = setInterval(() => { if (document.visibilityState === "visible") router.refresh(); }, intervalMs);
    return () => {
      if (timeout) clearTimeout(timeout);
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
      supabase.removeChannel(channel);
    };
  }, [key, intervalMs, router]);

  return null;
}
