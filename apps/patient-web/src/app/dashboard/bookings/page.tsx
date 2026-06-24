import Link from "next/link";
import { createServerSupabase } from "@/lib/supabase-server";
import { formatNaira, SERVICE_LABELS, BOOKING_STATUS_LABELS } from "@streetdocmd/shared";
import CancelButton from "./CancelButton";

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800",
  accepted: "bg-blue-100 text-blue-800",
  en_route: "bg-violet-100 text-violet-800",
  arrived: "bg-indigo-100 text-indigo-800",
  in_progress: "bg-amber-100 text-amber-800",
  completed: "bg-green-100 text-green-800",
  cancelled: "bg-red-100 text-red-800",
};

const ACTIVE = ["accepted", "en_route", "arrived", "in_progress"];

export default async function BookingsPage() {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: bookings } = await supabase
    .from("bookings")
    .select("*, providers(name, specialty), reviews(id)")
    .eq("patient_id", user!.id)
    .order("created_at", { ascending: false });

  const list = bookings ?? [];

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">My Bookings</h1>

      {list.length === 0 ? (
        <div className="card p-12 text-center">
          <p className="text-4xl mb-4">📋</p>
          <p className="font-semibold text-gray-700 text-lg">No bookings yet</p>
          <p className="text-gray-400 text-sm mt-1">Your booking history will appear here.</p>
          <Link href="/dashboard" className="btn-primary inline-flex mt-4">Book a Service</Link>
        </div>
      ) : (
        <div className="space-y-3">
          {list.map((b: any) => {
            const isActive = ACTIVE.includes(b.status);
            const isRated = (b.reviews?.length ?? 0) > 0;
            return (
              <div key={b.id} className="card p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-gray-900">{SERVICE_LABELS[b.service_type]}</h3>
                      <span className={`badge ${STATUS_COLORS[b.status]}`}>
                        {(BOOKING_STATUS_LABELS as Record<string, string>)[b.status]}
                      </span>
                    </div>
                    {b.providers && (
                      <p className="text-sm text-gray-500 mt-0.5">{b.providers.name} · {b.providers.specialty}</p>
                    )}
                    <div className="flex items-center gap-4 mt-2">
                      <span className="text-blue-brand font-bold text-sm">{formatNaira(b.fee)}</span>
                      <span className="text-gray-400 text-xs">
                        {new Date(b.created_at).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" })}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 items-end shrink-0">
                    {isActive && (
                      <Link href={`/dashboard/book/tracking/${b.id}`} className="btn-primary text-xs px-3 py-1.5">
                        Track →
                      </Link>
                    )}
                    {b.status === "completed" && !isRated && (
                      <Link href={`/dashboard/book/rate/${b.id}?providerId=${b.provider_id}`} className="bg-navy-700 text-white text-xs px-3 py-1.5 rounded-lg font-semibold hover:bg-navy-800 transition-colors">
                        Rate Visit ★
                      </Link>
                    )}
                    {b.status === "completed" && isRated && (
                      <span className="text-xs text-green-600 font-medium">✓ Rated</span>
                    )}
                    {b.status === "pending" && <CancelButton bookingId={b.id} />}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}