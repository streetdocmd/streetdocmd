import Link from "next/link";
import {
  ArrowRight, CheckCircle2, Circle, Inbox, Star, Users, Wallet, Activity, MessageSquareHeart, UserPlus,
} from "lucide-react";
import { createServerSupabase, createAdminSupabase } from "@/lib/supabase-server";
import { SERVICE_LABELS, BOOKING_STATUS_LABELS, formatNaira } from "@streetdocmd/shared";
import { hasCurrentAgreement } from "@/lib/onboarding";
import AgreementAcceptCard from "@/components/AgreementAcceptCard";
import { ComingSoonItem } from "@/components/ComingSoonBadge";
import DispatchCard from "./DispatchCard";
import AvailabilityToggle from "./AvailabilityToggle";
import ReferralCodeCard from "./ReferralCodeCard";
import RealtimeDispatch from "./RealtimeDispatch";
import LocationBroadcaster from "@/components/LocationBroadcaster";

export const revalidate = 0;

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: { notice?: string };
}) {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();

  // select("*"): tolerate a database without migration 046's agreement columns
  const { data: provider } = await supabase
    .from("providers")
    .select("*")
    .eq("user_id", user!.id)
    .single();

  if (!provider) return null;

  const needsServices = provider.profession !== "doctor";

  const [{ data: activeBooking }, { count: activeServices }] = await Promise.all([
    supabase
      .from("bookings")
      .select("id, service_type, status, patient_address, fee, net_payout")
      .eq("provider_id", provider.id)
      .in("status", ["accepted", "en_route", "arrived", "in_progress"])
      .order("accepted_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    needsServices
      ? supabase
          .from("provider_services")
          .select("id", { count: "exact", head: true })
          .eq("provider_id", provider.id)
          .eq("active", true)
      : Promise.resolve({ count: null }),
  ]);

  // Use admin client for dispatch queue so booking details are always readable
  // regardless of the bookings RLS policy on pending (provider_id = NULL) bookings
  const admin = createAdminSupabase();
  const { data: dispatchQueue } = await admin
    .from("dispatch_queue")
    .select("id, booking_id, expires_at, bookings(service_type, patient_address, fee, net_payout, notes)")
    .eq("provider_id", provider.id)
    .is("response", null)
    .gt("expires_at", new Date().toISOString())
    .order("sent_at", { ascending: true });

  const requests = (dispatchQueue ?? []) as any[];

  // First-arrival checklist — every item is something the provider can do
  // right now, and each one links straight to where it's done.
  const checklist = [
    {
      done: !!(provider.bank_name && provider.bank_account_number && provider.bank_account_name),
      label: "Add your bank details for payouts",
      href: "/dashboard/profile#payouts",
    },
    {
      done: !!(provider.bio && provider.bio.trim().length > 0),
      label: "Write a short bio patients will see",
      href: "/dashboard/profile#about",
    },
    {
      done: !!(provider.working_hours_start && provider.working_hours_end),
      label: "Set your working hours and service radius",
      href: "/dashboard/profile#availability",
    },
    ...(needsServices
      ? [{
          done: (activeServices ?? 0) > 0,
          label: "List the services you offer and your prices",
          href: "/dashboard/services",
        }]
      : []),
    {
      done: provider.lat != null && provider.lng != null,
      label: "Go online once so we can match you to nearby patients",
      href: "#availability",
    },
  ];
  const completed = checklist.filter(c => c.done).length;
  const allDone = completed === checklist.length;
  const firstName = (provider.name as string).replace(/^(dr|mr|mrs|ms|nurse)\.?\s+/i, "").split(" ")[0];
  const greetingName = /^dr\.?\s/i.test(provider.name) ? `Dr. ${firstName}` : firstName;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[1.65rem] leading-tight font-bold text-ink tracking-tight">
          Hello, {greetingName} <span aria-hidden>👋</span>
        </h1>
        <p className="text-muted mt-1 text-[15px] leading-snug">
          {provider.available
            ? "You're online — new visit requests will appear below."
            : "Go online when you're ready to receive home-visit requests."}
        </p>
      </div>

      {searchParams.notice === "note_submitted" && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center gap-3">
          <CheckCircle2 size={20} className="text-green-600 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-green-800">Clinical note submitted</p>
            <p className="text-xs text-green-600">The visit is marked complete and your payout has been credited.</p>
          </div>
        </div>
      )}

      {!hasCurrentAgreement(provider.agreement_version) && (
        <AgreementAcceptCard updated={!!provider.agreement_version} />
      )}

      {/* Active booking banner */}
      {activeBooking && (
        <Link
          href={`/dashboard/active/${activeBooking.id}`}
          className="card p-4 flex items-center gap-3.5 border-teal-deep/30 bg-teal-soft hover:shadow-card-md transition-all group"
        >
          <div className="w-11 h-11 rounded-xl bg-teal-deep flex items-center justify-center shrink-0">
            <Activity size={20} className="text-white" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-teal-deep uppercase tracking-wide">Active visit</p>
            <p className="text-sm font-semibold text-ink truncate">
              {(SERVICE_LABELS as Record<string, string>)[activeBooking.service_type]}
            </p>
            <p className="text-xs text-muted truncate">
              {(BOOKING_STATUS_LABELS as Record<string, string>)[activeBooking.status]} · {activeBooking.patient_address}
            </p>
          </div>
          <span className="hidden sm:inline-flex btn-teal text-sm items-center gap-1">
            Continue <ArrowRight size={15} />
          </span>
          <ArrowRight size={18} className="sm:hidden text-teal-deep shrink-0" />
        </Link>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <div className="space-y-6 min-w-0">
          {/* Availability toggle + location broadcaster */}
          <div id="availability" className="scroll-mt-24">
            <AvailabilityToggle providerId={provider.id} initialAvailable={provider.available} />
          </div>
          {provider.available && <LocationBroadcaster providerId={provider.id} />}

          {/* Dispatch requests */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-muted uppercase tracking-wide">
                Incoming requests
              </h2>
              <RealtimeDispatch providerId={provider.id} />
            </div>

            {requests.length === 0 ? (
              <div className="card p-10 text-center">
                <div className="w-12 h-12 rounded-2xl bg-accent-soft flex items-center justify-center mx-auto mb-3">
                  <Inbox size={22} className="text-accent" />
                </div>
                <p className="font-semibold text-ink">No pending requests</p>
                <p className="text-sm text-muted mt-1 max-w-xs mx-auto">
                  {provider.available
                    ? "New requests will appear here automatically — keep this page open."
                    : "Go online above to start receiving requests from patients near you."}
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {requests.map((r: any) => (
                  <DispatchCard key={r.id} request={r} />
                ))}
              </div>
            )}
          </div>
        </div>

        <aside className="space-y-4 min-w-0">
          {/* Stats */}
          <div className="grid grid-cols-3 lg:grid-cols-1 gap-3">
            <Stat icon={Users} label="Total visits" value={String(provider.total_visits ?? 0)} />
            <Stat icon={Star} label="Rating" value={provider.rating > 0 ? Number(provider.rating).toFixed(1) : "—"} />
            <Stat icon={Wallet} label="Wallet" value={formatNaira(provider.wallet_balance ?? 0)} href="/dashboard/earnings" accent />
          </div>

          {!allDone && (
            <div className="card p-5">
              <div className="flex items-center justify-between mb-1">
                <p className="font-semibold text-ink">Get ready for your first visit</p>
                <span className="text-xs font-semibold text-accent">{completed}/{checklist.length}</span>
              </div>
              <div className="h-1.5 rounded-full bg-pending-bg overflow-hidden mb-4">
                <div className="h-full bg-accent rounded-full transition-all" style={{ width: `${(completed / checklist.length) * 100}%` }} />
              </div>
              <ul className="space-y-1">
                {checklist.map(item => (
                  <li key={item.label}>
                    <Link
                      href={item.href}
                      className={`flex items-start gap-2.5 rounded-lg px-2 py-2 -mx-2 text-sm transition-colors ${
                        item.done ? "text-muted" : "text-ink hover:bg-page"
                      }`}
                    >
                      {item.done
                        ? <CheckCircle2 size={17} className="text-green-600 shrink-0 mt-px" />
                        : <Circle size={17} className="text-line shrink-0 mt-px" />}
                      <span className={item.done ? "line-through" : ""}>{item.label}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {provider.referral_code && <ReferralCodeCard code={provider.referral_code} />}

          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-muted uppercase tracking-wide">On the way</h2>
            <ComingSoonItem
              icon={MessageSquareHeart}
              title="Ratings & reviews"
              description="Read what patients say after each visit and reply to feedback."
            />
            <ComingSoonItem
              icon={UserPlus}
              title="Refer a colleague"
              description="Invite licensed colleagues to join the StreetdocMD provider network."
            />
          </div>
        </aside>
      </div>
    </div>
  );
}

function Stat({
  icon: Icon, label, value, href, accent = false,
}: { icon: typeof Users; label: string; value: string; href?: string; accent?: boolean }) {
  const body = (
    <>
      <div className={`hidden lg:flex w-10 h-10 rounded-xl items-center justify-center shrink-0 ${accent ? "bg-teal-soft" : "bg-accent-soft"}`}>
        <Icon size={19} className={accent ? "text-teal-deep" : "text-accent"} />
      </div>
      <div className="min-w-0 text-center lg:text-left">
        <p className={`text-lg sm:text-xl font-bold truncate ${accent ? "text-teal-deep" : "text-ink"}`}>{value}</p>
        <p className="text-xs text-muted">{label}</p>
      </div>
    </>
  );
  const cls = "card p-3 sm:p-4 flex flex-col lg:flex-row items-center lg:items-center gap-3";
  return href
    ? <Link href={href} className={`${cls} hover:shadow-card-md transition-shadow`}>{body}</Link>
    : <div className={cls}>{body}</div>;
}
