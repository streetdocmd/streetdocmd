import Link from "next/link";
import {
  Stethoscope, FlaskConical, Bandage, HeartHandshake, Syringe, Dumbbell, Footprints, PenLine,
  KeyRound, ArrowRight, Truck, CalendarClock, type LucideIcon,
} from "lucide-react";
import { createServerSupabase } from "@/lib/supabase-server";
import { SERVICE_LABELS, SERVICE_DESCRIPTIONS, BOOKING_STATUS_LABELS } from "@/lib/shared";
import type { ServiceType } from "@/lib/shared";

const SERVICES: ServiceType[] = [
  "general_consultation",
  "wellness_check",
  "wound_care",
  "elderly_review",
  "nursing_care",
  "physiotherapy_assessment",
  "custom_request",
];

// physiotherapy_session is intentionally not a front-door option — it's
// only ever a follow-up after a completed physiotherapy_assessment (see
// ContinueCareButton), the same way a nurse follow-up only ever comes
// from an elderly_review visit, not from browsing services fresh.
const SERVICE_ICONS: Record<ServiceType, LucideIcon> = {
  general_consultation: Stethoscope,
  wellness_check: FlaskConical,
  wound_care: Bandage,
  elderly_review: HeartHandshake,
  nursing_care: Syringe,
  physiotherapy_assessment: Dumbbell,
  physiotherapy_session: Footprints,
  custom_request: PenLine,
};

const ACTIVE_STATUSES = ["accepted", "en_route", "arrived", "in_progress"];

export default async function DashboardHome() {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase.from("users").select("name").eq("id", user!.id).single();
  const firstName = profile?.name?.split(" ")[0] ?? "there";

  // "Your Care" — surfaces only when real data supports it: an in-progress
  // visit takes priority (most actionable), otherwise the soonest booking
  // that's actually been scheduled for a future time (Phase 4 scheduling).
  // No data invented — this section simply doesn't render if neither exists.
  const [{ data: activeBooking }, { data: upcomingBooking }] = await Promise.all([
    // 'accepted' is active only if it's not actually a future-scheduled
    // slot (that's the "upcoming" query below) — en_route/arrived/
    // in_progress are always active regardless of scheduled_at.
    supabase
      .from("bookings")
      .select("id, service_type, status, scheduled_at, providers!bookings_provider_id_fkey(name)")
      .eq("patient_id", user!.id)
      .in("status", ACTIVE_STATUSES)
      .or(`scheduled_at.is.null,scheduled_at.lte.${new Date().toISOString()}`)
      .order("accepted_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    // 'accepted' specifically — a provider has actually confirmed for this
    // slot, not just "payment received, still searching" (status 'paid').
    supabase
      .from("bookings")
      .select("id, service_type, status, scheduled_at, providers!bookings_provider_id_fkey(name)")
      .eq("patient_id", user!.id)
      .eq("status", "accepted")
      .not("scheduled_at", "is", null)
      .gt("scheduled_at", new Date().toISOString())
      .order("scheduled_at", { ascending: true })
      .limit(1)
      .maybeSingle(),
  ]);

  const careBooking = (activeBooking ?? upcomingBooking) as any;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-[1.65rem] leading-tight font-bold text-gray-900 tracking-tight">
          Hello, {firstName} <span aria-hidden>👋</span>
        </h1>
        <p className="text-gray-500 mt-1 text-[15px] leading-snug max-w-sm">
          What care do you need today? A provider will come to you.
        </p>
      </div>

      {careBooking && (
        <Link
          href={activeBooking ? `/dashboard/book/tracking/${careBooking.id}` : "/dashboard/bookings"}
          className="card p-4 mb-6 flex items-center gap-3.5 border-blue-mid hover:shadow-card-md transition-all group"
        >
          <div className="w-11 h-11 rounded-xl bg-blue-brand flex items-center justify-center shrink-0">
            {activeBooking ? <Truck size={20} className="text-white" /> : <CalendarClock size={20} className="text-white" />}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-blue-brand uppercase tracking-wide">
              {activeBooking ? "Your visit" : "Upcoming appointment"}
            </p>
            <p className="text-sm font-semibold text-gray-900 truncate">
              {(SERVICE_LABELS as Record<string, string>)[careBooking.service_type]}
              {careBooking.providers?.name && ` · ${careBooking.providers.name}`}
            </p>
            <p className="text-xs text-gray-500 mt-0.5">
              {activeBooking
                ? (BOOKING_STATUS_LABELS as Record<string, string>)[careBooking.status]
                : new Date(careBooking.scheduled_at).toLocaleString("en-NG", { weekday: "long", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}
            </p>
          </div>
          <ArrowRight size={18} className="text-gray-300 group-hover:text-blue-brand group-hover:translate-x-0.5 transition-all shrink-0" />
        </Link>
      )}

      <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">Available Services</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-10">
        {SERVICES.map(service => {
          const href = service === "custom_request" ? "/dashboard/book/custom"
            : service === "wellness_check" ? "/dashboard/book/lab-investigations"
            : `/dashboard/book/${service}`;
          const label = service === "wellness_check" ? "Request Lab Investigations" : SERVICE_LABELS[service];
          const description = service === "wellness_check"
            ? "Book a curated wellness package, or choose the specific tests you need"
            : SERVICE_DESCRIPTIONS[service];

          const Icon = SERVICE_ICONS[service];

          return (
            <Link
              key={service}
              href={href}
              className="card p-5 hover:shadow-card-md hover:border-blue-mid active:scale-[0.98] transition-all group relative"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="w-11 h-11 rounded-xl bg-blue-light flex items-center justify-center">
                  <Icon size={22} strokeWidth={2} className="text-blue-brand" />
                </div>
                <ArrowRight
                  size={16}
                  className="text-gray-200 group-hover:text-blue-brand group-hover:translate-x-0.5 transition-all mt-1.5"
                />
              </div>
              <h3 className="font-semibold text-gray-900 group-hover:text-blue-brand transition-colors">
                {label}
              </h3>
              <p className="text-xs text-gray-500 mt-1 leading-relaxed">{description}</p>
            </Link>
          );
        })}
      </div>

      <Link
        href="/dashboard/book/preferred-provider"
        className="card p-5 flex items-center gap-4 hover:shadow-card-md hover:border-blue-mid active:scale-[0.99] transition-all group mb-10"
      >
        <div className="w-11 h-11 rounded-xl bg-blue-light flex items-center justify-center shrink-0">
          <KeyRound size={22} strokeWidth={2} className="text-blue-brand" />
        </div>
        <div className="flex-1">
          <h3 className="font-semibold text-gray-900 group-hover:text-blue-brand transition-colors">
            Have a Preferred Provider?
          </h3>
          <p className="text-xs text-gray-500 mt-0.5">Enter their code to book directly with them</p>
        </div>
        <ArrowRight size={18} className="text-gray-300 group-hover:text-blue-brand group-hover:translate-x-0.5 transition-all shrink-0" />
      </Link>
    </div>
  );
}
