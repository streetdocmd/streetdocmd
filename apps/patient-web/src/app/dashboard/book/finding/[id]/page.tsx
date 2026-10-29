"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { Check, SearchX, UserX } from "lucide-react";
import { Button, Card, TopBar, useDialog } from "@/components/ds";
import ProviderDeclinedActions from "@/app/dashboard/bookings/ProviderDeclinedActions";

// Nobody is going to accept: the screen stops searching and offers next steps
const STOPPED = ["cancelled", "provider_declined", "expired"];

export default function FindingProviderPage({ params }: { params: { id: string } }) {
  const dialog = useDialog();
  const router = useRouter();
  const [status, setStatus] = useState("pending");
  // The offer currently waiting on a provider (each provider has a 2 minute window)
  const [offer, setOffer] = useState<{ expires_at: string; sent_at: string; provider_first_name: string | null; is_doctor: boolean } | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState("");

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    let stop = false;
    async function loadOffer() {
      const res = await fetch(`/api/bookings/${params.id}/dispatch`).catch(() => null);
      if (!res?.ok || stop) return;
      const json = await res.json().catch(() => null);
      if (!stop) setOffer(json?.offer ?? null);
    }
    loadOffer();
    const id = setInterval(loadOffer, 3000);
    return () => { stop = true; clearInterval(id); };
  }, [params.id]);

  async function cancelRequest() {
    if (!(await dialog.confirm({ title: "Cancel this request?", message: "If you've paid, we'll refund you.", confirmLabel: "Cancel request", cancelLabel: "Keep it", tone: "danger" }))) return;
    setCancelling(true);
    setCancelError("");
    const res = await fetch(`/api/bookings/${params.id}/cancel`, { method: "POST" }).catch(() => null);
    const json = await res?.json().catch(() => ({}));
    if (!res?.ok) {
      setCancelError(json?.error ?? "Could not cancel. Check your connection and try again.");
      setCancelling(false);
      return;
    }
    router.push("/dashboard/bookings");
    router.refresh();
  }

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
      } else {
        // Back to "pending" once a new search starts (e.g. after "Search nearest available")
        setStatus(STOPPED.includes(data.status) ? data.status : "pending");
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
          } else if (row.status) {
            setStatus(STOPPED.includes(row.status) ? row.status : "pending");
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

  const cancelBlock = (
    <>
      {cancelError && <p className="mt-4 text-center text-ds-sm font-semibold text-danger">{cancelError}</p>}
      <Button variant="secondary" block className="mt-3" onClick={cancelRequest} disabled={cancelling}>
        {cancelling ? "Cancelling…" : "Cancel and get a refund"}
      </Button>
    </>
  );

  if (status === "provider_declined") {
    return (
      <div className="mx-auto max-w-md">
        <TopBar title="Request sent" hideBack className="-mx-5 -mt-2 md:mx-0" />
        <div className="px-5 py-8 text-center">
          <span className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-ds bg-pending-bg text-pending">
            <UserX size={28} aria-hidden />
          </span>
          <h1 className="text-ds-xl font-bold text-navy">Your provider isn&apos;t available</h1>
          <p className="mt-2.5 text-ds-sm text-muted">
            The provider you chose wasn&apos;t able to accept this visit. Choose someone else, let us find the nearest
            available provider, or cancel for a full refund.
          </p>
          <div className="mt-5 flex justify-center">
            <ProviderDeclinedActions bookingId={params.id} />
          </div>
          {cancelBlock}
        </div>
      </div>
    );
  }

  if (status === "expired") {
    return (
      <div className="mx-auto max-w-md">
        <TopBar title="Request sent" hideBack className="-mx-5 -mt-2 md:mx-0" />
        <div className="px-5 py-8 text-center">
          <span className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-ds bg-pending-bg text-pending">
            <SearchX size={28} aria-hidden />
          </span>
          <h1 className="text-ds-xl font-bold text-navy">No providers available</h1>
          <p className="mt-2.5 text-ds-sm text-muted">
            No provider near you could take this visit in time. Cancel for a full refund and try again in a little while.
          </p>
          {cancelBlock}
          <Button variant="ghost" block className="mt-2" onClick={() => router.push("/dashboard")}>Back to home</Button>
        </div>
      </div>
    );
  }

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

  // Countdown to the current offer's deadline; without an offer the ring just turns
  const windowMs = offer ? Math.max(1, Date.parse(offer.expires_at) - Date.parse(offer.sent_at)) : 0;
  const leftMs = offer ? Math.max(0, Date.parse(offer.expires_at) - now) : 0;
  const leftS = Math.ceil(leftMs / 1000);
  const mins = Math.floor(leftS / 60);
  const secs = String(leftS % 60).padStart(2, "0");
  const circumference = 452;
  const who = offer?.provider_first_name ? `${offer.is_doctor ? "Dr. " : ""}${offer.provider_first_name}` : null;
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
          {offer ? (
            <svg viewBox="0 0 170 170" className="h-[170px] w-[170px] -rotate-90" aria-hidden>
              <circle cx="85" cy="85" r="72" fill="none" stroke="var(--line)" strokeWidth="10" />
              <circle cx="85" cy="85" r="72" fill="none" stroke="var(--blue)" strokeWidth="10" strokeLinecap="round"
                strokeDasharray={circumference} strokeDashoffset={circumference * (1 - leftMs / windowMs)}
                className="transition-[stroke-dashoffset] duration-1000 ease-linear motion-reduce:transition-none" />
            </svg>
          ) : (
            <svg viewBox="0 0 170 170" className="h-[170px] w-[170px] animate-spin [animation-duration:2.4s] motion-reduce:animate-none" aria-hidden>
              <circle cx="85" cy="85" r="72" fill="none" stroke="var(--line)" strokeWidth="10" />
              <circle cx="85" cy="85" r="72" fill="none" stroke="var(--blue)" strokeWidth="10" strokeLinecap="round"
                strokeDasharray="452" strokeDashoffset="330" />
            </svg>
          )}
          <div className="absolute inset-0 grid place-items-center">
            {offer ? (
              <div>
                <b className="block text-[30px] text-navy tabular-nums">{mins}:{secs}</b>
                <small className="text-ds-2xs font-bold uppercase tracking-[0.06em] text-muted">to accept</small>
              </div>
            ) : (
              <small className="text-ds-2xs font-bold uppercase tracking-[0.06em] text-muted">Searching</small>
            )}
          </div>
        </div>

        <h1 className="mt-7 text-ds-xl font-bold text-navy">{who ? `Waiting for ${who}` : "Finding your provider"}</h1>
        <p className="mt-2.5 max-w-[300px] text-ds-sm text-muted">
          {who
            ? "Each provider has 2 minutes to accept. If they decline, we offer the next nearest available provider so you are never left waiting."
            : "We're matching you with the nearest available healthcare professional. This usually takes under a minute."}
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
      {cancelError && <p className="mt-4 text-center text-ds-sm font-semibold text-danger">{cancelError}</p>}
      <Button variant="secondary" block className="mt-5" onClick={cancelRequest} disabled={cancelling}>
        {cancelling ? "Cancelling…" : "Cancel request"}
      </Button>
    </div>
  );
}