import Link from "next/link";
import { createServerSupabase } from "@/lib/supabase-server";
import { SERVICE_LABELS, BOOKING_STATUS_LABELS, formatNaira } from "@streetdocmd/shared";

const STATUS_COLORS: Record<string, string> = {
  accepted:    "bg-blue-100 text-blue-800",
  en_route:    "bg-violet-100 text-violet-800",
  arrived:     "bg-indigo-100 text-indigo-800",
  in_progress: "bg-amber-100 text-amber-800",
  completed:   "bg-green-100 text-green-800",
  cancelled:   "bg-red-100 text-red-800",
};

const ACTIVE = ["accepted", "en_route", "arrived", "in_progress"];

export default async function BookingsPage() {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: provider } = await supabase.from("providers").select("id").eq("user_id", user!.id).single();
  if (!provider) return null;

  const { data: bookings } = await supabase
    .from("bookings")
    .select("id, service_type, status, patient_address, net_payout, completed_at, created_at, patients:users!patient_id(name)")
    .eq("provider_id", provider.id)
    .order("created_at", { ascending: false });

  const list = bookings ?? [];

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Bookings</h1>

      {list.length === 0 ? (
        <div className="card p-12 text-center">
          <p className="text-4xl mb-3">📋</p>
          <p className="font-semibold text-gray-700">No bookings yet</p>
          <p className="text-sm text-gray-400 mt-1">Your accepted visits will appear here.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {list.map((b: any) => {
            const isActive = ACTIVE.includes(b.status);
            return (
              <div key={b.id} className="card p-5 flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold text-gray-900">
                      {(SERVICE_LABELS as Record<string, string>)[b.service_type]}
                    </h3>
                    <span className={`badge ${STATUS_COLORS[b.status] ?? "bg-gray-100 text-gray-600"}`}>
                      {(BOOKING_STATUS_LABELS as Record<string, string>)[b.status]}
                    </span>
                  </div>
                  <p className="text-sm text-gray-500 mt-0.5 truncate">
                    {(b.patients as any)?.name ?? "Patient"} · {b.patient_address}
                  </p>
                  <div className="flex items-center gap-4 mt-1">
                    <span className="text-teal-brand font-bold text-sm">{formatNaira(b.net_payout)}</span>
                    <span className="text-gray-400 text-xs">
                      {new Date(b.created_at).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" })}
                    </span>
                  </div>
                </div>
                {isActive && (
                  <Link href={`/dashboard/active/${b.id}`} className="btn-teal text-xs px-3 py-1.5 shrink-0">
                    Continue →
                  </Link>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}