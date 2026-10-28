import Link from "next/link";
import { createServerSupabase } from "@/lib/supabase-server";
import { SERVICE_LABELS } from "@streetdocmd/shared";
import { Card } from "@/components/ds";
import { hoursSummary, weeklyHoursOf } from "@/lib/hours";
import CalendarClient, { type CalendarVisit } from "./CalendarClient";

const ACTIVE_STATUSES = ["accepted", "en_route", "arrived", "in_progress"];
const sentence = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : s);

// The area part of an address: drop the house number and street
function area(address: string | null) {
  const parts = (address ?? "").split(",").map(s => s.trim()).filter(Boolean);
  return parts.length > 1 ? parts[1] : parts[0] ?? "";
}

export default async function CalendarPage() {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();

  // select("*") so weekly_hours (migration 060) is read when it exists
  const { data: provider } = await supabase.from("providers").select("*").eq("user_id", user!.id).single();
  if (!provider) return null;

  const [{ data: bookings }, timeOffRes] = await Promise.all([
    supabase
      .from("bookings")
      .select("id, service_type, status, patient_address, scheduled_at, accepted_at, patients:users!patient_id(name)")
      .eq("provider_id", provider.id)
      .in("status", ACTIVE_STATUSES)
      .order("scheduled_at", { ascending: true, nullsFirst: false }),
    supabase
      .from("provider_time_off")
      .select("day")
      .eq("provider_id", provider.id)
      .gte("day", new Date(Date.now() - 31 * 86_400_000).toISOString().slice(0, 10)),
  ]);

  // A visit occupies the day it was scheduled for, or the day an ASAP visit was accepted
  const visits: CalendarVisit[] = ((bookings ?? []) as any[])
    .filter(b => b.scheduled_at ?? b.accepted_at)
    .map(b => ({
      id: b.id,
      at: b.scheduled_at ?? b.accepted_at,
      service: sentence((SERVICE_LABELS as Record<string, string>)[b.service_type] ?? b.service_type),
      patient: b.patients?.name ?? "Patient",
      area: area(b.patient_address),
      asap: !b.scheduled_at,
    }));

  const hours = hoursSummary(weeklyHoursOf(provider));

  return (
    <div className="mx-auto max-w-2xl">
      <div className="pb-4">
        <h1 className="text-[26px] font-extrabold leading-tight tracking-[-0.02em] text-navy">Calendar</h1>
        <small className="text-[13px] font-semibold text-muted">Bookings and time off</small>
      </div>

      <CalendarClient
        providerId={provider.id}
        visits={visits}
        timeOff={((timeOffRes.data ?? []) as { day: string }[]).map(t => t.day)}
        timeOffAvailable={!timeOffRes.error}
      />

      <section className="mt-[26px]">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-[17px] font-bold text-navy">Working hours</h2>
          <Link href="/dashboard/profile#availability" className="text-[13px] font-bold text-accent">Change</Link>
        </div>
        <Card padded={false} className="px-5 py-1">
          {hours.length ? (
            <dl>
              {hours.map(h => (
                <div key={h.label} className="flex items-center justify-between gap-4 border-b border-line py-2.5 text-ds-sm last:border-b-0">
                  <dt className="text-muted">{h.label}</dt>
                  <dd className="font-bold text-ink">{h.value}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="py-3 text-ds-sm text-muted">You haven&apos;t set working hours yet.</p>
          )}
        </Card>
      </section>
    </div>
  );
}
