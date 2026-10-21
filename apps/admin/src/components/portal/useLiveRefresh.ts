"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";

/**
 * Re-renders the (server-fetched) page when rows in `table` change, with a
 * periodic refresh as a fallback in case realtime isn't available for the
 * signed-in role.
 */
export function useLiveRefresh(table: string, filter: string | null, intervalMs = 60_000) {
  const router = useRouter();
  useEffect(() => {
    const supabase = createClient();
    let timeout: ReturnType<typeof setTimeout> | null = null;
    const refresh = () => {
      if (timeout) clearTimeout(timeout);
      timeout = setTimeout(() => router.refresh(), 400);
    };
    const channel = supabase
      .channel(`portal-${table}-${filter ?? "all"}`)
      .on("postgres_changes", { event: "*", schema: "public", table, ...(filter ? { filter } : {}) }, refresh)
      .subscribe();
    const interval = setInterval(() => router.refresh(), intervalMs);
    return () => {
      if (timeout) clearTimeout(timeout);
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, [table, filter, intervalMs, router]);
}
