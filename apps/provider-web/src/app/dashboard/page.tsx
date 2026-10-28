import Link from "next/link";
import {
  ArrowRight, CalendarDays, CheckCircle2, Circle, Clock, Check, Inbox, MessageSquareHeart, Stethoscope, UserPlus, Users, Wallet,
  type LucideIcon,
} from "lucide-react";
import { createServerSupabase, createAdminSupabase } from "@/lib/supabase-server";
import { SERVICE_LABELS, BOOKING_STATUS_LABELS, formatNaira } from "@streetdocmd/shared";
import { loadOpenOffers } from "@/lib/dispatch";
import { hasCurrentAgreement } from "@/lib/onboarding";
import AgreementAcceptCard from "@/components/AgreementAcceptCard";
import { ComingSoonItem } from "@/components/ComingSoonBadge";
import { Card, Notice, Pill, cx, focusRing } from "@/components/ds";
import DispatchCard from "./DispatchCard";
import AvailabilityToggle from "./AvailabilityToggle";
import ReferralCodeCard from "./ReferralCodeCard";
import RealtimeDispatch from "./RealtimeDispatch";
import LocationBroadcaster from "@/components/LocationBroadcaster";

export const revalidate = 0;

const TZ = "Africa/Lagos";
const DAY_MS = 86_400_000;
const sentence = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : s);
const lagosDay = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(d);

function greeting() {
  const h = Number(new Intl.DateTimeFormat("en-GB", { hour: "numeric", hour12: false, timeZone: TZ }).format(new Date()));
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

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
  const now = new Date();
  const since14 = new Date(now.getTime() - 14 * DAY_MS).toISOString();
  const since30 = new Date(now.getTime() - 30 * DAY_MS).toISOString();
  const admin = createAdminSupabase();

  const [
    { data: activeBooking },
    { count: activeServices },
    { data: recentCompleted },
    { data: upcoming },
    { count: reviewCount },
    { data: responses },
    requests,
  ] = await Promise.all([
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
    // Earnings: completed visits in the last two weeks (this week vs last week, and the chart)
    supabase
      .from("bookings")
      .select("net_payout, completed_at")
      .eq("provider_id", provider.id)
      .eq("status", "completed")
      .gte("completed_at", since14),
    // Today's schedule: visits accepted or underway, and today's completed ones
    supabase
      .from("bookings")
      .select("id, service_type, status, scheduled_at, accepted_at, completed_at, users!bookings_patient_id_fkey(name)")
      .eq("provider_id", provider.id)
      .in("status", ["accepted", "en_route", "arrived", "in_progress", "completed"])
      .gte("updated_at", new Date(now.getTime() - 2 * DAY_MS).toISOString())
      .order("scheduled_at", { ascending: true, nullsFirst: true })
      .limit(20),
    supabase.from("reviews").select("id", { count: "exact", head: true }).eq("provider_id", provider.id),
    // Acceptance rate over the last 30 days of offers
    admin
      .from("dispatch_queue")
      .select("response")
      .eq("provider_id", provider.id)
      .not("response", "is", null)
      .gte("sent_at", since30),
    loadOpenOffers(admin, provider),
  ]);

  // KPIs
  const completed = (recentCompleted ?? []) as { net_payout: number; completed_at: string }[];
  const weekStart = (() => { const d = new Date(now); const dow = (d.getDay() + 6) % 7; d.setHours(0, 0, 0, 0); return new Date(d.getTime() - dow * DAY_MS); })();
  const lastWeekStart = new Date(weekStart.getTime() - 7 * DAY_MS);
  const sum = (from: Date, to: Date) => completed
    .filter(c => { const t = new Date(c.completed_at).getTime(); return t >= from.getTime() && t < to.getTime(); })
    .reduce((s, c) => s + Number(c.net_payout ?? 0), 0);
  const earnedThisWeek = sum(weekStart, new Date(now.getTime() + DAY_MS));
  const earnedLastWeek = sum(lastWeekStart, weekStart);
  const weekTrend = earnedLastWeek > 0 ? Math.round(((earnedThisWeek - earnedLastWeek) / earnedLastWeek) * 100) : null;

  const todayKey = lagosDay(now);
  const schedule = ((upcoming ?? []) as any[])
    .filter(b => {
      const when = b.scheduled_at ?? b.accepted_at ?? b.completed_at;
      return when && lagosDay(new Date(when)) === todayKey;
    })
    .map(b => ({
      id: b.id as string,
      time: new Date(b.scheduled_at ?? b.accepted_at ?? b.completed_at)
        .toLocaleTimeString("en-NG", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: TZ }).toLowerCase(),
      who: String(b.users?.name ?? "Patient").split(" ")[0],
      what: sentence((SERVICE_LABELS as Record<string, string>)[b.service_type] ?? b.service_type),
      state: b.status === "completed" ? "done" : "open",
    }));
  const nextIndex = schedule.findIndex(s => s.state === "open");
  const visitsToday = schedule.length;

  const resp = ((responses ?? []) as { response: string }[]);
  const acceptRate = resp.length >= 3 ? Math.round((resp.filter(r => r.response === "accepted").length / resp.length) * 100) : null;

  // Last 7 days of earnings for the chart
  const chart = Array.from({ length: 7 }, (_, i) => {
    const day = new Date(now.getTime() - (6 - i) * DAY_MS);
    const key = lagosDay(day);
    return {
      label: day.toLocaleDateString("en-GB", { weekday: "short", timeZone: TZ }).slice(0, 1),
      value: completed.filter(c => lagosDay(new Date(c.completed_at)) === key).reduce((s, c) => s + Number(c.net_payout ?? 0), 0),
      today: i === 6,
    };
  });
  const chartMax = Math.max(1, ...chart.map(c => c.value));

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
  const completedSteps = checklist.filter(c => c.done).length;
  const allDone = completedSteps === checklist.length;
  const firstName = (provider.name as string).replace(/^(dr|mr|mrs|ms|nurse)\.?\s+/i, "").split(" ")[0];

  const quick: { icon: LucideIcon; label: string; href: string }[] = [
    { icon: Users, label: "Patients", href: "/dashboard/patients" },
    { icon: CalendarDays, label: "Block time", href: "/dashboard/calendar#block" },
    needsServices
      ? { icon: Stethoscope, label: "Services", href: "/dashboard/services" }
      : { icon: Stethoscope, label: "Visits", href: "/dashboard/bookings" },
    { icon: Wallet, label: "Wallet", href: "/dashboard/earnings" },
  ];

  return (
    <div className="mx-auto max-w-3xl">
      <div className="pb-4">
        <small className="text-[13px] font-semibold text-muted">Today{provider.specialty ? ` · ${provider.specialty}` : ""}</small>
        <h1 className="mt-0.5 text-[26px] font-extrabold leading-tight tracking-[-0.02em] text-navy">{greeting()}, {firstName}</h1>
      </div>

      {searchParams.notice === "note_submitted" && (
        <Notice tone="success" title="Clinical note submitted." className="mb-4">
          The visit is marked complete and your payout has been credited.
        </Notice>
      )}

      {!hasCurrentAgreement(provider.agreement_version) && (
        <div className="mb-4"><AgreementAcceptCard updated={!!provider.agreement_version} /></div>
      )}

      {activeBooking && (
        <Link
          href={`/dashboard/active/${activeBooking.id}`}
          className={cx("mb-4 flex items-center gap-3 rounded-[20px] border-2 border-teal-deep bg-surface p-3.5", focusRing)}
        >
          <span className="grid h-10 w-10 flex-none place-items-center rounded-[13px] bg-teal-soft text-teal-deep"><Clock size={20} aria-hidden /></span>
          <span className="min-w-0 flex-1">
            <small className="block text-ds-2xs font-bold uppercase tracking-[0.05em] text-teal-deep">Visit in progress</small>
            <b className="block truncate text-ds-sm text-ink">{sentence((SERVICE_LABELS as Record<string, string>)[activeBooking.service_type] ?? "")}</b>
            <span className="block truncate text-ds-xs text-muted">
              {(BOOKING_STATUS_LABELS as Record<string, string>)[activeBooking.status]} · {activeBooking.patient_address}
            </span>
          </span>
          <ArrowRight size={18} className="text-teal-deep" aria-hidden />
        </Link>
      )}

      <div id="availability" className="scroll-mt-24">
        <AvailabilityToggle providerId={provider.id} initialAvailable={provider.available} />
      </div>
      {provider.available && <LocationBroadcaster providerId={provider.id} />}

      <div className="mt-3.5">
        <div className="mb-2 flex items-center justify-end"><RealtimeDispatch providerId={provider.id} /></div>
        {requests.length > 0 ? (
          <div className="space-y-3">{requests.map((r: any) => <DispatchCard key={r.id} request={r} />)}</div>
        ) : (
          <div className="rounded-[20px] border border-dashed border-muted/40 bg-surface px-5 py-[18px] text-center text-ds-sm text-muted">
            <Inbox size={20} className="mx-auto mb-1.5 text-muted" aria-hidden />
            {provider.available ? "No requests right now. New ones appear here automatically." : "Switch on to receive new requests."}
          </div>
        )}
      </div>

      <section className="mt-[18px] grid grid-cols-2 gap-2.5">
        {[
          { label: "Earned this week", value: formatNaira(earnedThisWeek), trend: weekTrend != null ? `${weekTrend >= 0 ? "+" : ""}${weekTrend}% vs last week` : "Your first week", down: (weekTrend ?? 0) < 0 },
          { label: "Visits today", value: String(visitsToday), trend: nextIndex >= 0 ? "More later today" : visitsToday ? "All done" : "None booked yet" },
          { label: "Rating", value: provider.rating > 0 ? Number(provider.rating).toFixed(1) : "New", trend: `${reviewCount ?? 0} review${reviewCount === 1 ? "" : "s"}`, muted: true },
          { label: "Accepted", value: acceptRate != null ? `${acceptRate}%` : "New", trend: acceptRate == null ? "Last 30 days" : acceptRate >= 80 ? "Excellent response" : "Last 30 days", muted: acceptRate == null || acceptRate < 80 },
        ].map(k => (
          <div key={k.label} className="rounded-[20px] border border-line bg-surface p-3.5 shadow-ds-sm">
            <small className="text-ds-xs font-bold text-muted">{k.label}</small>
            <b className="mt-1 block text-[20px] tracking-[-0.01em] text-navy tabular-nums">{k.value}</b>
            <div className={`mt-0.5 text-ds-xs font-bold ${k.muted ? "font-semibold text-muted" : k.down ? "text-danger" : "text-success"}`}>{k.trend}</div>
          </div>
        ))}
      </section>

      <Card className="mt-[26px]">
        <div className="flex items-center justify-between">
          <h2 className="text-ds-control font-bold text-navy">Earnings this week</h2>
          <span className="text-ds-sm text-muted">Naira</span>
        </div>
        <div className="mb-[22px] mt-3 flex h-[90px] items-end gap-2" role="img"
          aria-label={`Earnings for the last 7 days: ${chart.map(c => formatNaira(c.value)).join(", ")}`}>
          {chart.map((c, i) => (
            <div key={i} className="relative flex-1 rounded-[8px_8px_4px_4px]"
              style={{ height: `${Math.max(6, Math.round((c.value / chartMax) * 100))}%`, background: c.today ? "linear-gradient(180deg, var(--teal), var(--teal-deep))" : "#D9EEEB" }}>
              <small className="absolute -bottom-5 left-0 right-0 text-center text-ds-2xs font-bold text-muted">{c.label}</small>
            </div>
          ))}
        </div>
      </Card>

      <section className="mt-[26px]">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-[17px] font-bold text-navy">Today&apos;s schedule</h2>
          <Link href="/dashboard/calendar" className="text-[13px] font-bold text-accent">See all</Link>
        </div>
        {schedule.length > 0 ? (
          <div className="grid gap-2.5">
            {schedule.map((s, i) => (
              <Link key={s.id} href={s.state === "done" ? "/dashboard/bookings" : `/dashboard/active/${s.id}`}
                className={cx(
                  "flex items-stretch gap-3 rounded-[18px] bg-surface px-3.5 py-3",
                  i === nextIndex ? "border-2 border-teal-deep" : "border border-line",
                  s.state === "done" && "opacity-60",
                  focusRing,
                )}>
                <span className="w-[66px] flex-none pt-0.5 text-[13px] font-extrabold text-navy">{s.time}</span>
                <span className="min-w-0 flex-1">
                  <b className="block text-ds-sm text-ink">{s.who}</b>
                  <small className="text-ds-xs text-muted">{s.what}</small>
                </span>
                {i === nextIndex ? <Pill tone="teal" icon={Clock}>Next</Pill> : s.state === "done" ? <Pill tone="ok" icon={Check}>Done</Pill> : null}
              </Link>
            ))}
          </div>
        ) : (
          <p className="text-ds-sm text-muted">Nothing booked for today yet.</p>
        )}
      </section>

      <section className="mt-[26px]">
        <h2 className="mb-3 text-[17px] font-bold text-navy">Quick actions</h2>
        <div className="grid grid-cols-4 gap-2">
          {quick.map(({ icon: Icon, label, href }) => (
            <Link key={label} href={href}
              className={cx("grid justify-items-center gap-1.5 rounded-[18px] border border-line bg-surface px-1 py-3 text-ds-2xs font-bold text-navy", focusRing)}>
              <span className="grid h-10 w-10 place-items-center rounded-[13px] bg-teal-soft text-teal-deep"><Icon size={20} aria-hidden /></span>
              {label}
            </Link>
          ))}
        </div>
      </section>

      {!allDone && (
        <Card className="mt-[26px]">
          <div className="mb-1 flex items-center justify-between">
            <b className="text-ink">Get ready for your first visit</b>
            <span className="text-ds-xs font-bold text-accent">{completedSteps}/{checklist.length}</span>
          </div>
          <div className="mb-4 h-1.5 overflow-hidden rounded-full bg-pending-bg">
            <div className="h-full rounded-full bg-accent" style={{ width: `${(completedSteps / checklist.length) * 100}%` }} />
          </div>
          <ul className="space-y-1">
            {checklist.map(item => (
              <li key={item.label}>
                <Link href={item.href}
                  className={cx("-mx-2 flex items-start gap-2.5 rounded-lg px-2 py-2 text-ds-sm", item.done ? "text-muted" : "text-ink hover:bg-page", focusRing)}>
                  {item.done
                    ? <CheckCircle2 size={17} className="mt-px flex-none text-success" aria-hidden />
                    : <Circle size={17} className="mt-px flex-none text-line" aria-hidden />}
                  <span className={item.done ? "line-through" : ""}>{item.label}</span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {provider.referral_code && <div className="mt-[26px]"><ReferralCodeCard code={provider.referral_code} /></div>}

      <section className="mt-[26px] space-y-3">
        <h2 className="text-[17px] font-bold text-navy">Coming soon</h2>
        <ComingSoonItem icon={MessageSquareHeart} title="Reply to reviews" description="Read what patients say after each visit and reply to feedback." />
        <ComingSoonItem icon={UserPlus} title="Refer a colleague" description="Invite licensed colleagues to join the StreetdocMD provider network." />
      </section>
    </div>
  );
}
