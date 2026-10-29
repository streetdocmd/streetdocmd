import Link from "next/link";
import { createServerSupabase, createAdminSupabase } from "@/lib/supabase-server";
import { loadOpenOffers } from "@/lib/dispatch";
import { Avatar, Card, Pill, cx, focusRing } from "@/components/ds";
import DispatchCard from "../DispatchCard";
import RequestsTabs from "./RequestsTabs";
import { CalendarCheck, CalendarClock } from "lucide-react";
import EmptyState from "@/components/EmptyState";
import { SERVICE_LABELS, BOOKING_STATUS_LABELS, formatNaira } from "@streetdocmd/shared";
import ProviderBookingCard from "./ProviderBookingCard";
import LiveRefresh from "@/components/LiveRefresh";

const ACTIVE = ["accepted", "en_route", "arrived", "in_progress"];
const sentence = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : s);

export default async function BookingsPage() {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: provider } = await supabase.from("providers").select("id, profession, lat, lng").eq("user_id", user!.id).single();
  if (!provider) return null;

  const { data: bookings } = await supabase
    .from("bookings")
    .select("id, service_type, status, patient_address, net_payout, scheduled_at, completed_at, created_at, patients:users!patient_id(name)")
    .eq("provider_id", provider.id)
    .order("created_at", { ascending: false });

  const list = bookings ?? [];
  const bookingIds = list.map((b: any) => b.id);

  let visitsMap: Record<string, any> = {};
  let prescriptionsMap: Record<string, any> = {};
  let encounterMap: Record<string, any> = {};

  if (bookingIds.length > 0) {
    const { data: visits } = await supabase
      .from("visits")
      .select("id, booking_id, diagnosis, treatment, follow_up_plan")
      .in("booking_id", bookingIds);

    for (const v of visits ?? []) visitsMap[v.booking_id] = v;

    const visitIds = (visits ?? []).map((v: any) => v.id);
    if (visitIds.length > 0) {
      const { data: prescriptions } = await supabase
        .from("prescriptions")
        .select("id, visit_id, pdf_url, drugs")
        .in("visit_id", visitIds);

      for (const p of prescriptions ?? []) prescriptionsMap[p.visit_id] = p;
    }

    // Which encounter table to read depends on this provider's profession —
    // a provider only ever has rows in their own profession's table.
    const encounterTable = provider.profession === "nurse" ? "nursing_encounters"
      : provider.profession === "physiotherapist" ? "physiotherapy_encounters"
      : "clinical_notes";

    const { data: encounters } = await supabase
      .from(encounterTable)
      .select("id, booking_id, status, submitted_at")
      .in("booking_id", bookingIds);

    for (const e of encounters ?? []) encounterMap[e.booking_id] = e;
  }

  const enriched = list.map((b: any) => {
    const visit = visitsMap[b.id];
    if (visit) {
      visit.prescription = prescriptionsMap[visit.id] ?? null;
    }
    return { ...b, visit, encounter: encounterMap[b.id] ?? null };
  });

  // The design's request tabs: open offers (now or scheduled), upcoming accepted visits, declined offers
  const admin = createAdminSupabase();
  const [offers, { data: declinedRows }] = await Promise.all([
    loadOpenOffers(admin, provider),
    admin
      .from("dispatch_queue")
      .select("id, responded_at, bookings(service_type, scheduled_at, patient_address)")
      .eq("provider_id", provider.id)
      .eq("response", "declined")
      .gte("sent_at", new Date(Date.now() - 7 * 86_400_000).toISOString())
      .order("responded_at", { ascending: false }),
  ]);
  const newOffers = offers.filter((o: any) => !o.bookings?.scheduled_at);
  const scheduledOffers = offers.filter((o: any) => o.bookings?.scheduled_at);
  const upcoming = list.filter((b: any) => b.status === "accepted" && b.scheduled_at && new Date(b.scheduled_at) > new Date());
  const declined = (declinedRows ?? []) as any[];

  const empty = (text: string) => (
    <div className="rounded-[20px] border border-dashed border-muted/40 bg-surface px-4 py-[30px] text-center text-ds-sm text-muted">{text}</div>
  );
  const when = (iso: string) => new Date(iso).toLocaleString("en-NG", {
    weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true, timeZone: "Africa/Lagos",
  });

  return (
    <div className="mx-auto max-w-2xl">
      <LiveRefresh sources={[{ table: "bookings" }, { table: "dispatch_queue" }]} />
      <div className="pb-4">
        <h1 className="text-[26px] font-extrabold leading-tight tracking-[-0.02em] text-navy">Requests</h1>
        <small className="text-[13px] font-semibold text-muted">Accept what fits your day</small>
      </div>

      <RequestsTabs
        initial={newOffers.length ? "new" : scheduledOffers.length || upcoming.length ? "scheduled" : "past"}
        counts={{ new: newOffers.length, scheduled: scheduledOffers.length + upcoming.length, declined: declined.length, past: enriched.length }}
        panels={{
          new: newOffers.length
            ? <div className="space-y-3">{newOffers.map((r: any) => <DispatchCard key={r.id} request={r} />)}</div>
            : empty("No requests here right now. New bookings appear the moment they arrive."),
          scheduled: scheduledOffers.length || upcoming.length ? (
            <div className="space-y-3">
              {scheduledOffers.map((r: any) => (
                <div key={r.id}>
                  <p className="mb-1.5 px-1 text-ds-xs font-bold text-muted">For {when(r.bookings.scheduled_at)}</p>
                  <DispatchCard request={r} />
                </div>
              ))}
              {upcoming.map((b: any) => (
                <Link key={b.id} href={`/dashboard/active/${b.id}`}
                  className={cx("block rounded-ds-lg border border-line bg-surface p-4 shadow-ds-sm", focusRing)}>
                  <div className="flex items-center justify-between">
                    <Pill tone="idle" icon={CalendarClock}>{when(b.scheduled_at)}</Pill>
                    <b className="text-navy tabular-nums">{formatNaira(b.net_payout)}</b>
                  </div>
                  <div className="mt-3 flex items-center gap-3">
                    <Avatar name={b.patients?.name ?? "Patient"} size="sm" />
                    <div className="min-w-0 flex-1">
                      <b className="block text-ds-sm text-ink">{sentence((SERVICE_LABELS as Record<string, string>)[b.service_type] ?? "")}</b>
                      <small className="block truncate text-ds-xs text-muted">{b.patients?.name ?? "Patient"} · {b.patient_address}</small>
                    </div>
                    <Pill tone="ok">Accepted</Pill>
                  </div>
                </Link>
              ))}
            </div>
          ) : empty("No scheduled requests yet."),
          declined: declined.length ? (
            <Card padded={false} className="px-4 py-1">
              {declined.map((d: any) => (
                <div key={d.id} className="flex items-center gap-3 border-b border-line py-3.5 last:border-b-0">
                  <div className="min-w-0 flex-1">
                    <b className="block text-ds-sm text-ink">{sentence((SERVICE_LABELS as Record<string, string>)[d.bookings?.service_type] ?? "Request")}</b>
                    <small className="block truncate text-ds-xs text-muted">{d.bookings?.patient_address ?? ""}</small>
                  </div>
                  <span className="text-ds-xs text-muted">{d.responded_at ? when(d.responded_at) : ""}</span>
                </div>
              ))}
            </Card>
          ) : empty("No declined requests this week."),
          past: enriched.length ? (
            <div className="space-y-3">
              {enriched.map((b: any) => (
                <ProviderBookingCard
                  key={b.id}
                  booking={b}
                  profession={provider.profession}
                  serviceLabel={sentence((SERVICE_LABELS as Record<string, string>)[b.service_type] ?? "")}
                  statusLabel={(BOOKING_STATUS_LABELS as Record<string, string>)[b.status]}
                  isActive={ACTIVE.includes(b.status)}
                />
              ))}
            </div>
          ) : (
            <EmptyState icon={CalendarCheck} title="No visits yet"
              description="Visits you accept appear here, with their notes and prescriptions once completed." />
          ),
        }}
      />
    </div>
  );
}
