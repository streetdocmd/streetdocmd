"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";

export default function FindingProviderPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [status, setStatus] = useState("pending");
  const [dots, setDots] = useState(".");

  // Animate dots
  useEffect(() => {
    const id = setInterval(() => setDots(d => d.length >= 3 ? "." : d + "."), 600);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const supabase = createClient();
    const ACTIVE = ["accepted", "en_route", "arrived", "in_progress", "completed"];
    let cancelled = false;

    async function checkStatus() {
      const { data } = await supabase
        .from("bookings")
        .select("status")
        .eq("id", params.id)
        .single();
      if (cancelled) return;
      if (!data) return;
      if (ACTIVE.includes(data.status)) {
        router.replace(`/dashboard/book/tracking/${params.id}`);
      } else if (data.status === "cancelled") {
        setStatus("cancelled");
      }
    }

    // Check immediately, then poll every 3 seconds as fallback
    checkStatus();
    const pollId = setInterval(checkStatus, 3000);

    // Also subscribe to real-time for instant updates
    const channel = supabase
      .channel(`finding-${params.id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "bookings", filter: `id=eq.${params.id}` },
        ({ new: row }) => {
          if (row.status && ACTIVE.includes(row.status)) {
            router.replace(`/dashboard/book/tracking/${params.id}`);
          } else if (row.status === "cancelled") {
            setStatus("cancelled");
          }
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      clearInterval(pollId);
      supabase.removeChannel(channel);
    };
  }, [params.id, router]);

  if (status === "cancelled") {
    return (
      <div className="max-w-md mx-auto mt-16 text-center">
        <p className="text-5xl mb-4">😔</p>
        <h2 className="text-xl font-bold text-gray-900 mb-2">No providers available</h2>
        <p className="text-gray-500 text-sm mb-6">
          There are no available providers near you right now. Please try again in a few minutes.
        </p>
        <button
          onClick={() => router.push("/dashboard")}
          className="btn-primary w-full"
        >
          Back to home
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto mt-16 text-center">
      {/* Pulsing ring animation */}
      <div className="relative w-28 h-28 mx-auto mb-8">
        <div className="absolute inset-0 rounded-full bg-blue-brand/10 animate-ping" />
        <div className="absolute inset-3 rounded-full bg-blue-brand/20 animate-ping [animation-delay:300ms]" />
        <div className="relative flex items-center justify-center w-28 h-28 rounded-full bg-blue-brand">
          <span className="text-4xl">🏥</span>
        </div>
      </div>

      <h2 className="text-xl font-bold text-gray-900 mb-2">
        Finding your provider{dots}
      </h2>
      <p className="text-gray-500 text-sm mb-1">
        We're matching you with the nearest available healthcare professional.
      </p>
      <p className="text-xs text-gray-400">This usually takes under a minute.</p>

      <div className="mt-10 card p-4 text-left space-y-3">
        {[
          { done: true,  label: "Booking created" },
          { done: true,  label: "Locating nearby providers" },
          { done: false, label: "Awaiting provider confirmation" },
          { done: false, label: "Provider en route" },
        ].map(({ done, label }) => (
          <div key={label} className="flex items-center gap-3">
            <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 text-xs font-bold ${
              done ? "bg-green-500 text-white" : "border-2 border-gray-200"
            }`}>
              {done && "✓"}
            </div>
            <span className={`text-sm ${done ? "text-gray-700 font-medium" : "text-gray-400"}`}>
              {label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}