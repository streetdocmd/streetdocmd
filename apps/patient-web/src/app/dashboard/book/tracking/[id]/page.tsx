import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase-server";
import { BOOKING_STATUS_LABELS } from "@/lib/shared";
import { Check, Mail, Phone, Star } from "lucide-react";
import { SUPPORT_EMAIL } from "@/lib/brand";
import { Avatar, Button, Card, Notice, TopBar, iconButtonClass } from "@/components/ds";
import TrackingClient from "./TrackingClient";

const STATUS_STEPS = ["pending", "accepted", "en_route", "arrived", "in_progress", "completed"];

export default async function TrackingPage({ params }: { params: { id: string } }) {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: booking } = await supabase
    .from("bookings")
    .select("*, providers!bookings_provider_id_fkey(id, name, specialty, phone, rating, lat, lng)")
    .eq("id", params.id)
    .eq("patient_id", user.id)
    .single();

  if (!booking) redirect("/dashboard/bookings");

  const provider = booking.providers as {
    id: string; name: string; specialty: string;
    phone: string; rating: number; lat: number | null; lng: number | null;
  } | null;

  // "paid" is the real database value for what STATUS_STEPS calls "pending"
  // (payment confirmed, provider being matched) since migration 019.
  const currentStep = STATUS_STEPS.indexOf(booking.status === "paid" ? "pending" : booking.status);

  const isScheduled = booking.status === "accepted" && !!booking.scheduled_at && new Date(booking.scheduled_at) > new Date();
  const fmt = (o: Intl.DateTimeFormatOptions) =>
    booking.scheduled_at ? new Date(booking.scheduled_at).toLocaleString("en-NG", { ...o, timeZone: "Africa/Lagos" }) : "";
  const timeline = [
    { label: "Accepted", text: provider ? `${provider.name} confirmed your visit` : "A provider confirmed your visit" },
    { label: "On the way", text: "Heading to your door" },
    { label: "Arrived", text: "At your door" },
    { label: "In progress", text: "Visit underway" },
    { label: "Completed", text: "Notes and prescriptions sent to you" },
  ];

  return (
    <div className="mx-auto max-w-2xl">
      <TopBar title={isScheduled ? "Scheduled visit" : "Your visit"} backHref="/dashboard/bookings" className="-mx-5 -mt-2 md:mx-0" />

      {booking.status === "cancelled" ? (
        <Notice tone="danger" title="This visit was cancelled." className="mb-4" />
      ) : currentStep <= 0 ? (
        <Notice tone="info" title={(BOOKING_STATUS_LABELS as Record<string, string>)[booking.status]} className="mb-4">
          We&apos;ll update this page as soon as a provider accepts.
        </Notice>
      ) : null}

      {/* Live map + distance/ETA, shown while the provider is on the way */}
      {provider && !isScheduled && ["accepted", "en_route", "arrived"].includes(booking.status) && (
        <div className="mb-4">
          <TrackingClient
            bookingId={params.id}
            providerId={provider.id}
            providerName={provider.name}
            patientLat={booking.patient_lat}
            patientLng={booking.patient_lng}
            initialProviderLat={provider.lat}
            initialProviderLng={provider.lng}
          />
        </div>
      )}

      {/* Provider card */}
      {provider && (
        <Card>
          <div className="flex items-center gap-3">
            <Avatar name={provider.name} size="sm" />
            <div className="min-w-0 flex-1">
              <b className="block truncate text-ds-control text-ink">{provider.name}</b>
              <span className="text-ds-sm text-muted">{provider.specialty}</span>
            </div>
            {provider.rating > 0 && (
              <span className="inline-flex items-center gap-1 text-[13px] font-extrabold text-ink">
                <Star size={14} className="fill-amber-500 text-amber-500" aria-hidden /> {provider.rating.toFixed(1)}
              </span>
            )}
            {provider.phone && (
              <a href={`tel:${provider.phone}`} aria-label={`Call ${provider.name}`} className={iconButtonClass}>
                <Phone size={20} aria-hidden />
              </a>
            )}
          </div>
          {isScheduled && (
            <dl className="mt-3">
              {[["Date", fmt({ weekday: "short", day: "numeric", month: "short" })], ["Time", fmt({ hour: "numeric", minute: "2-digit", hour12: true })], ["Where", booking.patient_address]]
                .filter(([, v]) => v)
                .map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-4 border-b border-line py-2.5 text-ds-sm last:border-b-0">
                    <dt className="text-muted">{k}</dt>
                    <dd className="text-right font-bold text-ink">{v}</dd>
                  </div>
                ))}
            </dl>
          )}
        </Card>
      )}

      {/* Visit status timeline */}
      {booking.status !== "cancelled" && (
        <section className="mt-[26px]">
          <h2 className="mb-3 text-[17px] font-bold text-navy">{isScheduled ? "What happens next" : "Visit status"}</h2>
          <ol>
            {timeline.map(({ label, text }, i) => {
              const step = i + 1;
              // currentStep: 1 accepted ... 5 completed. A reached status is done; the next one is current.
              const state = currentStep >= step ? "done" : currentStep + 1 === step ? "now" : "todo";
              return (
                <li key={label} className="relative flex gap-3.5 pb-5 last:pb-0">
                  {i < timeline.length - 1 && (
                    <span aria-hidden className={`absolute left-[13px] top-7 h-[calc(100%-24px)] w-0.5 ${state === "done" ? "bg-success" : "bg-line"}`} />
                  )}
                  <span className={`relative grid h-7 w-7 flex-none place-items-center rounded-full ${
                    state === "done" ? "bg-success text-white" : state === "now" ? "bg-accent-soft ring-2 ring-accent" : "border-2 border-line bg-surface"
                  }`}>
                    {state === "done" && <Check size={14} strokeWidth={3} aria-hidden />}
                    {state === "now" && <span className="h-2.5 w-2.5 rounded-full bg-accent" aria-hidden />}
                  </span>
                  <div className="pt-0.5">
                    <b className={`block text-ds-sm ${state === "todo" ? "text-muted" : "text-ink"}`}>{label}</b>
                    <small className="text-ds-xs text-muted">{text}</small>
                    <span className="sr-only">{state === "done" ? ", done" : state === "now" ? ", current step" : ", not yet"}</span>
                  </div>
                </li>
              );
            })}
          </ol>
        </section>
      )}

      <div className="mt-6 flex gap-2.5">
        {booking.status === "completed" ? (
          <Button href={`/dashboard/book/rate/${params.id}?providerId=${provider?.id}`} className="flex-1">
            Rate your visit
          </Button>
        ) : (
          <Button href={`mailto:${SUPPORT_EMAIL}`} variant="secondary" className="flex-1">
            <Mail size={18} aria-hidden /> Get help
          </Button>
        )}
      </div>
      {/* TODO(design): Share location, Reschedule and Add to calendar need features that don't exist yet. */}
    </div>
  );
}
