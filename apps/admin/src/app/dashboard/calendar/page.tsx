import Link from "next/link";
import { createServerSupabase } from "@/lib/supabase-server";
import { SERVICE_LABELS } from "@/lib/shared";
import ProviderSelect from "./ProviderSelect";

const ACTIVE_STATUSES = ["accepted", "en_route", "arrived", "in_progress"];

export default async function AdminCalendarPage({
  searchParams,
}: {
  searchParams: { providerId?: string };
}) {
  const supabase = createServerSupabase();

  const { data: providers } = await supabase
    .from("providers")
    .select("id, name, profession")
    .eq("verification_status", "verified")
    .order("name");

  const providerList = providers ?? [];
  const selectedId = searchParams.providerId ?? providerList[0]?.id;

  let bookings: any[] = [];
  if (selectedId) {
    const { data } = await supabase
      .from("bookings")
      .select("id, service_type, status, patient_address, scheduled_at, accepted_at, duration_minutes, patients:users!patient_id(name)")
      .eq("provider_id", selectedId)
      .in("status", ACTIVE_STATUSES)
      .order("scheduled_at", { ascending: true, nullsFirst: false })
      .order("accepted_at", { ascending: true });
    bookings = data ?? [];
  }

  const groups = new Map<string, typeof bookings>();
  for (const b of bookings) {
    const at = b.scheduled_at ?? b.accepted_at;
    if (!at) continue;
    const dateKey = new Date(at).toLocaleDateString("en-CA");
    if (!groups.has(dateKey)) groups.set(dateKey, []);
    groups.get(dateKey)!.push(b);
  }
  const sortedDates = Array.from(groups.keys()).sort();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Provider Calendar</h1>
        <p className="text-gray-500 text-sm mt-0.5">Upcoming and in-progress visits, per provider</p>
      </div>

      {providerList.length === 0 ? (
        <div className="card p-10 text-center text-gray-400">No verified providers yet.</div>
      ) : (
        <>
          <ProviderSelect providers={providerList} selectedId={selectedId} />

          {sortedDates.length === 0 ? (
            <div className="card p-12 text-center">
              <p className="text-4xl mb-3">🗓️</p>
              <p className="font-semibold text-gray-700">Nothing scheduled</p>
              <p className="text-sm text-gray-400 mt-1">This provider has no upcoming or in-progress visits.</p>
            </div>
          ) : (
            <div className="space-y-6">
              {sortedDates.map(dateKey => {
                const dayBookings = groups.get(dateKey)!;
                const dateLabel = new Date(dateKey + "T00:00:00").toLocaleDateString("en-NG", {
                  weekday: "long", day: "numeric", month: "long",
                  year: new Date(dateKey).getFullYear() !== new Date().getFullYear() ? "numeric" : undefined,
                });

                return (
                  <div key={dateKey}>
                    <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">{dateLabel}</h2>
                    <div className="space-y-2">
                      {dayBookings.map((b: any) => {
                        const at = b.scheduled_at ?? b.accepted_at;
                        const timeLabel = new Date(at).toLocaleTimeString("en-NG", { hour: "numeric", minute: "2-digit" });
                        const endLabel = new Date(new Date(at).getTime() + b.duration_minutes * 60000)
                          .toLocaleTimeString("en-NG", { hour: "numeric", minute: "2-digit" });

                        return (
                          <div key={b.id} className="card p-4 flex items-center gap-4">
                            <div className="text-center shrink-0 w-16">
                              <p className="text-sm font-bold text-navy-700">{timeLabel}</p>
                              <p className="text-xs text-gray-400">–{endLabel}</p>
                            </div>
                            <div className="w-px self-stretch bg-gray-100" />
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <p className="font-semibold text-gray-900">
                                  {(SERVICE_LABELS as Record<string, string>)[b.service_type]}
                                </p>
                                {!b.scheduled_at && (
                                  <span className="badge bg-amber-100 text-amber-800 text-xs">ASAP</span>
                                )}
                              </div>
                              <p className="text-sm text-gray-500 truncate">{b.patients?.name} · {b.patient_address}</p>
                            </div>
                            <Link href={`/dashboard/bookings?search=${b.patients?.name ?? ""}`} className="text-xs text-blue-brand hover:underline shrink-0">
                              View →
                            </Link>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
