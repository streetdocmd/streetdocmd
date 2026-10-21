import Link from "next/link";
import {
  Stethoscope, FlaskConical, Bandage, HeartHandshake, Syringe, Dumbbell, Footprints, PenLine,
  KeyRound, ArrowRight, Truck, CalendarClock, Pill, Video, CalendarHeart, ClipboardCheck,
  ShieldCheck, Home as HomeIcon, type LucideIcon,
} from "lucide-react";
import ComingSoonBadge from "@/components/ComingSoonBadge";
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

export default async function DashboardHome({ searchParams }: { searchParams?: { welcome?: string } }) {
  const justOnboarded = searchParams?.welcome === "1";
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  const [{ data: profile }, { count: bookingCount }] = await Promise.all([
    supabase.from("users").select("name, dob, gender, emergency_contact_name").eq("id", user!.id).maybeSingle(),
    supabase.from("bookings").select("id", { count: "exact", head: true }).eq("patient_id", user!.id),
  ]);
  const firstName = profile?.name?.split(" ")[0] ?? "there";
  // Onboarding step 2 can be skipped — keep nudging until the details a
  // visiting clinician relies on are filled in.
  const profileIncomplete = !!profile && (!profile.dob || !profile.gender || !profile.emergency_contact_name);
  const isFirstVisit = (bookingCount ?? 0) === 0;

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
          {justOnboarded ? `Welcome to StreetdocMD, ${firstName}` : <>Hello, {firstName} <span aria-hidden>👋</span></>}
        </h1>
        <p className="text-gray-500 mt-1 text-[15px] leading-snug max-w-sm">
          What care do you need today? A provider will come to you.
        </p>
      </div>

      {profileIncomplete && (
        <Link
          href="/onboarding/medical"
          className="card p-4 mb-6 flex items-center gap-3.5 border-amber-200 bg-amber-50/60 hover:shadow-card-md transition-all group"
        >
          <div className="w-11 h-11 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
            <ClipboardCheck size={20} className="text-amber-700" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-gray-900">Complete your medical profile</p>
            <p className="text-xs text-gray-600 mt-0.5">
              Add your date of birth, gender and an emergency contact so your clinician arrives prepared.
            </p>
          </div>
          <ArrowRight size={18} className="text-amber-400 group-hover:text-amber-700 group-hover:translate-x-0.5 transition-all shrink-0" />
        </Link>
      )}

      {isFirstVisit && !careBooking && (
        <div className="card p-5 mb-8">
          <p className="text-sm font-semibold text-gray-900 mb-4">How StreetdocMD works</p>
          <ol className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { icon: Stethoscope, title: "Choose a service", text: "Pick the care you need below and tell us where you are." },
              { icon: ShieldCheck, title: "Pay securely", text: "Pay securely online through Paystack to confirm your booking." },
              { icon: HomeIcon, title: "Care comes to you", text: "A verified clinician accepts and you can track them to your door." },
            ].map(({ icon: StepIcon, title, text }, i) => (
              <li key={title} className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg bg-blue-light flex items-center justify-center shrink-0">
                  <StepIcon size={18} className="text-blue-brand" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">{i + 1}. {title}</p>
                  <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{text}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      )}

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

        <Link
          href="/dashboard/book/medication"
          className="card p-5 hover:shadow-card-md hover:border-blue-mid active:scale-[0.98] transition-all group relative"
        >
          <div className="flex items-start justify-between mb-3">
            <div className="w-11 h-11 rounded-xl bg-blue-light flex items-center justify-center">
              <Pill size={22} strokeWidth={2} className="text-blue-brand" />
            </div>
            <ArrowRight size={16} className="text-gray-200 group-hover:text-blue-brand group-hover:translate-x-0.5 transition-all mt-1.5" />
          </div>
          <h3 className="font-semibold text-gray-900 group-hover:text-blue-brand transition-colors">
            Buy Medication
          </h3>
          <p className="text-xs text-gray-500 mt-1 leading-relaxed">
            Order over-the-counter medication for delivery from the pharmacy nearest you
          </p>
        </Link>
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

      {/* Planned features — shown so patients know what's coming, but
          deliberately inert (no link, no handler) until they're built. */}
      <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">On the way</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-10">
        {[
          { icon: Video, title: "Video Consultation", text: "Speak to a doctor from home over a secure video call" },
          { icon: CalendarHeart, title: "Care Plans", text: "Monthly plans with included home visits for you or your family" },
        ].map(({ icon: SoonIcon, title, text }) => (
          <div key={title} aria-disabled="true" className="card p-5 opacity-70 cursor-default select-none">
            <div className="flex items-start justify-between mb-3">
              <div className="w-11 h-11 rounded-xl bg-gray-100 flex items-center justify-center">
                <SoonIcon size={22} strokeWidth={2} className="text-gray-400" />
              </div>
              <ComingSoonBadge />
            </div>
            <h3 className="font-semibold text-gray-700">{title}</h3>
            <p className="text-xs text-gray-500 mt-1 leading-relaxed">{text}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
