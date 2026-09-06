import Link from "next/link";
import { createServerSupabase } from "@/lib/supabase-server";
import { SERVICE_LABELS } from "@streetdocmd/shared";

const ACTIVE_STATUSES = ["accepted", "en_route", "arrived", "in_progress"];

export default async function CalendarPage() {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: provider } = await supabase.from("providers").select("id").eq("user_id", user!.id).single();
  if (!provider) return null;

  const { data: bookings } = await supabase
    .from("bookings")
    .select("id, service_type, status, patient_address, scheduled_at, accepted_at, duration_minutes, patients:users!patient_id(name)")
    .eq("provider_id", provider.id)
    .in("status", ACTIVE_STATUSES)
    .order("scheduled_at", { ascending: true, nullsFirst: false })
    .order("accepted_at", { ascending: true });

  const list = bookings ?? [];

  // Group by the date this visit actually occupies — scheduled_at if the
  // patient picked a slot, otherwise accepted_at for an ASAP visit already
  // underway/committed to.
  const groups = new Map<string, typeof list>();
  for (const b of list) {
    const at = b.scheduled_at ?? b.accepted_at;
    if (!at) continue;
    const dateKey = new Date(at).toLocaleDateString("en-CA"); // YYYY-MM-DD, stable sort key
    if (!groups.has(dateKey)) groups.set(dateKey, []);
    groups.get(dateKey)!.push(b);
  }

  const sortedDates = Array.from(groups.keys()).sort();

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Calendar</h1>
        <p className="text-gray-500 text-sm mt-0.5">Your upcoming and in-progress visits</p>
      </div>

      {sortedDates.length === 0 ? (
        <div className="card p-12 text-center">
          <p className="text-4xl mb-3">🗓️</p>
          <p className="font-semibold text-gray-700">Nothing scheduled</p>
          <p className="text-sm text-gray-400 mt-1">Accepted and scheduled visits will appear here.</p>
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
                      <Link
                        key={b.id}
                        href={`/dashboard/active/${b.id}`}
                        className="card p-4 flex items-center gap-4 hover:shadow-card-md transition-all"
                      >
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
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
