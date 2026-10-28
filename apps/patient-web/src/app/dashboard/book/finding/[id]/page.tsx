"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { Check, SearchX } from "lucide-react";
import { Button, Card, TopBar } from "@/components/ds";

export default function FindingProviderPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [status, setStatus] = useState("pending");
  // Seconds since this screen opened. There is no acceptance deadline to count down from.
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setElapsed(e => e + 1), 1000);
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
      <div className="mx-auto max-w-md">
        <TopBar title="Request sent" hideBack className="-mx-5 -mt-2 md:mx-0" />
        <div className="px-5 py-8 text-center">
          <span className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-ds bg-pending-bg text-pending">
            <SearchX size={28} aria-hidden />
          </span>
          <h1 className="text-ds-xl font-bold text-navy">No providers available</h1>
          <p className="mt-2.5 text-ds-sm text-muted">
            There are no available providers near you right now. Please try again in a few minutes.
          </p>
          <Button block className="mt-6" onClick={() => router.push("/dashboard")}>Back to home</Button>
        </div>
      </div>
    );
  }

  const mins = Math.floor(elapsed / 60);
  const secs = String(elapsed % 60).padStart(2, "0");
  const steps = [
    { done: true, label: "Booking created" },
    { done: true, label: "Locating nearby providers" },
    { done: false, label: "Awaiting provider confirmation" },
    { done: false, label: "Provider on the way" },
  ];

  return (
    <div className="mx-auto max-w-md">
      <TopBar title="Request sent" hideBack className="-mx-5 -mt-2 md:mx-0" />

      <div className="flex flex-col items-center px-6 pb-6 pt-6 text-center">
        <div className="relative h-[170px] w-[170px]" role="status" aria-label="Waiting for a provider to accept">
          <svg viewBox="0 0 170 170" className="h-[170px] w-[170px] animate-spin [animation-duration:2.4s] motion-reduce:animate-none" aria-hidden>
            <circle cx="85" cy="85" r="72" fill="none" stroke="var(--line)" strokeWidth="10" />
            <circle cx="85" cy="85" r="72" fill="none" stroke="var(--blue)" strokeWidth="10" strokeLinecap="round"
              strokeDasharray="452" strokeDashoffset="330" />
          </svg>
          <div className="absolute inset-0 grid place-items-center">
            <div>
              <b className="block text-[30px] text-navy tabular-nums">{mins}:{secs}</b>
              <small className="text-ds-2xs font-bold uppercase tracking-[0.06em] text-muted">Waiting</small>
            </div>
          </div>
        </div>

        <h1 className="mt-7 text-ds-xl font-bold text-navy">Finding your provider</h1>
        <p className="mt-2.5 max-w-[300px] text-ds-sm text-muted">
          We&apos;re matching you with the nearest available healthcare professional. This usually takes under a minute.
        </p>
      </div>

      <Card padded={false} className="px-4 py-1">
        <ol>
          {steps.map(({ done, label }) => (
            <li key={label} className="flex items-center gap-3 border-b border-line py-3 last:border-b-0">
              <span className={`grid h-6 w-6 flex-none place-items-center rounded-full ${done ? "bg-success text-white" : "border-2 border-line"}`}>
                {done && <Check size={14} strokeWidth={3} aria-hidden />}
              </span>
              <span className={`text-ds-sm ${done ? "font-semibold text-ink" : "text-muted"}`}>
                {label}<span className="sr-only">{done ? ", done" : ", not yet"}</span>
              </span>
            </li>
          ))}
        </ol>
      </Card>
      {/* TODO(design): "Cancel request" needs a cancel endpoint, and the 2 minute countdown needs the acceptance deadline. */}
    </div>
  );
}