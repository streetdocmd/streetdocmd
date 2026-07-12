"use client";
import { useState, useEffect } from "react";
import { createBrowserClient } from "@supabase/ssr";

type Emergency = {
  id: string;
  created_at: string;
  status: string;
};

export default function EmergencyAlert() {
  const [active, setActive] = useState<Emergency[]>([]);

  useEffect(() => {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    supabase
      .from("emergencies")
      .select("id, created_at, status")
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .then(({ data }) => setActive(data ?? []));

    const channel = supabase
      .channel("emergency_banner")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "emergencies" }, (payload) => {
        setActive(prev => [payload.new as Emergency, ...prev]);
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "emergencies" }, (payload) => {
        const u = payload.new as Emergency;
        if (u.status !== "active") setActive(prev => prev.filter(e => e.id !== u.id));
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  if (active.length === 0) return null;

  const first = new Date(active[0].created_at).toLocaleTimeString("en-NG", {
    hour: "2-digit", minute: "2-digit",
  });

  return (
    <div className="flex items-center justify-between bg-red-600 text-white px-6 py-3 animate-pulse shrink-0">
      <div className="flex items-center gap-3">
        <span className="text-xl">🚨</span>
        <div>
          <p className="font-bold text-sm">
            {active.length} Active Emergency{active.length > 1 ? " Alerts" : ""}
          </p>
          <p className="text-xs text-red-200">First received at {first}</p>
        </div>
      </div>
      <a
        href="/dashboard/emergencies"
        className="bg-white text-red-600 px-4 py-1.5 rounded-lg text-xs font-bold hover:bg-red-50 transition-colors no-underline"
      >
        View &amp; Respond →
      </a>
    </div>
  );
}