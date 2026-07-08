import { createServerSupabase } from "@/lib/supabase-server";
import Link from "next/link";

export default async function VisitsPage() {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  // New system: rich visit summaries generated from clinical notes
  const { data: summaries } = await supabase
    .from("visit_summaries")
    .select("id, visit_date, provider_name, plain_diagnosis, reason_for_visit")
    .eq("patient_id", user.id)
    .eq("visible_to_patient", true)
    .order("visit_date", { ascending: false });

  // Old system: completed bookings with a visits record
  const { data: bookings } = await supabase
    .from("bookings")
    .select("id, completed_at, service_type, providers(name)")
    .eq("patient_id", user.id)
    .eq("status", "completed")
    .order("completed_at", { ascending: false });

  const bookingIds = (bookings ?? []).map((b: any) => b.id);
  let legacyVisits: any[] = [];

  if (bookingIds.length > 0) {
    const { data: visits } = await supabase
      .from("visits")
      .select("id, booking_id, diagnosis, treatment")
      .in("booking_id", bookingIds);

    const visitsByBooking = Object.fromEntries((visits ?? []).map((v: any) => [v.booking_id, v]));
    legacyVisits = (bookings ?? [])
      .filter((b: any) => visitsByBooking[b.id])
      .map((b: any) => ({
        ...visitsByBooking[b.id],
        completed_at: b.completed_at,
        service_type: b.service_type,
        provider_name: (b.providers as any)?.name,
      }));
  }

  const totalCount = (summaries?.length ?? 0) + legacyVisits.length;

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">My Visit History</h1>

      {totalCount === 0 ? (
        <div className="card p-12 text-center">
          <p className="text-4xl mb-3">🏥</p>
          <p className="font-semibold text-gray-700 text-lg">No visit history yet</p>
          <p className="text-sm text-gray-400 mt-1">Your visit summaries will appear here after each completed visit.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {/* New-style: rich summaries from clinical notes */}
          {(summaries ?? []).map((s: any) => (
            <div key={s.id} className="card p-5 flex items-center justify-between gap-4">
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-900">
                  {s.visit_date
                    ? new Date(s.visit_date).toLocaleDateString("en-NG", { day: "numeric", month: "long", year: "numeric" })
                    : "Date unknown"}
                </p>
                <p className="text-sm text-gray-600 mt-0.5">{s.provider_name}</p>
                {s.plain_diagnosis && (
                  <p className="text-sm text-teal-700 font-medium mt-1 truncate">{s.plain_diagnosis}</p>
                )}
              </div>
              <Link href={`/dashboard/visits/${s.id}`}
                className="shrink-0 bg-teal-600 text-white text-sm font-semibold px-4 py-2 rounded-xl hover:bg-teal-700 transition-colors">
                View Details →
              </Link>
            </div>
          ))}

          {/* Legacy: visits from the old complete-visit flow */}
          {legacyVisits.map((v: any) => (
            <div key={v.id} className="card p-5 flex items-center justify-between gap-4 border-l-4 border-l-gray-200">
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-900">
                  {v.completed_at
                    ? new Date(v.completed_at).toLocaleDateString("en-NG", { day: "numeric", month: "long", year: "numeric" })
                    : "Date unknown"}
                </p>
                <p className="text-sm text-gray-600 mt-0.5">{v.provider_name}</p>
                {v.diagnosis && (
                  <p className="text-sm text-teal-700 font-medium mt-1 truncate">{v.diagnosis}</p>
                )}
              </div>
              <Link href="/dashboard/records"
                className="shrink-0 text-sm text-gray-600 border border-gray-200 px-4 py-2 rounded-xl hover:bg-gray-50 transition-colors whitespace-nowrap">
                View Record →
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
