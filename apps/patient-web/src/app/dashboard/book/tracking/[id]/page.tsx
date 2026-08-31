import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase-server";
import { BOOKING_STATUS_LABELS } from "@/lib/shared";
import TrackingClient from "./TrackingClient";

const STATUS_COLORS: Record<string, string> = {
  pending:     "bg-amber-100 text-amber-800 border-amber-200",
  accepted:    "bg-blue-100 text-blue-800 border-blue-200",
  en_route:    "bg-violet-100 text-violet-800 border-violet-200",
  arrived:     "bg-indigo-100 text-indigo-800 border-indigo-200",
  in_progress: "bg-amber-100 text-amber-800 border-amber-200",
  completed:   "bg-green-100 text-green-800 border-green-200",
  cancelled:   "bg-red-100 text-red-800 border-red-200",
};

const STATUS_STEPS = ["pending", "accepted", "en_route", "arrived", "in_progress", "completed"];

export default async function TrackingPage({ params }: { params: { id: string } }) {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: booking } = await supabase
    .from("bookings")
    .select("*, providers!bookings_provider_id_fkey(id, name, specialty, phone, rating, lat, lng)")
    .eq("id", params.id)
    .eq("patient_id", user.id)
    .single();

  if (!booking) redirect("/dashboard/bookings");

  const provider = booking.providers as {
    id: string; name: string; specialty: string;
    phone: string; rating: number; lat: number | null; lng: number | null;
  } | null;

  const currentStep = STATUS_STEPS.indexOf(booking.status);

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Your Visit</h1>

      {/* Status banner */}
      <div className={`border rounded-xl px-5 py-4 mb-5 text-center ${STATUS_COLORS[booking.status] ?? "bg-gray-100"}`}>
        <p className="font-bold text-lg">
          {(BOOKING_STATUS_LABELS as Record<string, string>)[booking.status]}
        </p>
      </div>

      {/* Progress steps */}
      {booking.status !== "cancelled" && (
        <div className="card p-5 mb-4">
          <div className="flex items-center justify-between">
            {["Assigned", "En Route", "Arrived", "In Progress", "Done"].map((label, i) => {
              const step = i + 1;
              const done = currentStep >= step;
              const active = currentStep === step;
              return (
                <div key={label} className="flex flex-col items-center flex-1">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all ${
                    done   ? "bg-blue-brand border-blue-brand text-white" :
                    active ? "border-blue-brand text-blue-brand" :
                             "border-gray-200 text-gray-300"
                  }`}>
                    {done ? "✓" : step}
                  </div>
                  <p className={`text-xs mt-1 text-center ${done || active ? "text-blue-brand font-medium" : "text-gray-400"}`}>
                    {label}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Live map + distance/ETA — shown while provider is on the way */}
      {provider && ["accepted", "en_route", "arrived"].includes(booking.status) && (
        <div className="mb-4">
          <TrackingClient
            bookingId={params.id}
            providerId={provider.id}
            providerName={provider.name}
            patientLat={booking.patient_lat}
            patientLng={booking.patient_lng}
            initialProviderLat={provider.lat}
            initialProviderLng={provider.lng}
          />
        </div>
      )}

      {/* Provider card */}
      {provider && (
        <div className="card p-5 mb-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-blue-brand flex items-center justify-center text-white font-bold text-lg">
              {provider.name[0]}
            </div>
            <div>
              <p className="font-semibold text-gray-900">{provider.name}</p>
              <p className="text-sm text-gray-500">{provider.specialty}</p>
              {provider.rating > 0 && (
                <p className="text-xs text-gray-400 mt-0.5">⭐ {provider.rating.toFixed(1)}</p>
              )}
            </div>
          </div>
          <a
            href={`tel:${provider.phone}`}
            className="flex items-center gap-2 bg-green-50 border border-green-200 text-green-700 rounded-lg px-4 py-2 text-sm font-medium hover:bg-green-100 transition-colors"
          >
            📞 Call
          </a>
        </div>
      )}

      {/* Rate button for completed visits */}
      {booking.status === "completed" && (
        <a
          href={`/dashboard/book/rate/${params.id}?providerId=${provider?.id}`}
          className="block w-full text-center bg-navy-700 text-white rounded-xl py-4 font-semibold hover:bg-navy-800 transition-colors"
        >
          Rate your visit ★
        </a>
      )}
    </div>
  );
}