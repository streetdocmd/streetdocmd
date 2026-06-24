"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { SERVICE_PRICES, formatNaira } from "@streetdocmd/shared";
import type { ServiceType } from "@streetdocmd/shared";

type Provider = {
  id: string;
  name: string;
  specialty: string;
  credentials: string;
  rating: number;
  total_visits: number;
  lat: number;
  lng: number;
};

export default function BookProviderClient({
  providers,
  service,
  userId,
  description,
}: {
  providers: Provider[];
  service: ServiceType;
  userId: string;
  description?: string;
}) {
  const router = useRouter();
  const [booking, setBooking] = useState<string | null>(null);

  async function book(provider: Provider) {
    setBooking(provider.id);
    const supabase = createClient();

    const fee = SERVICE_PRICES[service];
    const commission = Math.round(fee * 0.2);

    const { data, error } = await supabase
      .from("bookings")
      .insert({
        patient_id: userId,
        provider_id: provider.id,
        service_type: service,
        patient_lat: 6.5244,
        patient_lng: 3.3792,
        patient_address: "Patient location",
        fee,
        commission,
        net_payout: fee - commission,
        status: "pending",
        payment_status: "pending",
        ...(description ? { notes: description } : {}),
      })
      .select()
      .single();

    if (error || !data) { setBooking(null); alert("Could not create booking. Please try again."); return; }

    await supabase.from("dispatch_queue").insert({
      booking_id: data.id,
      provider_id: provider.id,
      expires_at: new Date(Date.now() + 2 * 60 * 1000).toISOString(),
    });

    router.push(`/dashboard/book/payment/${data.id}`);
  }

  if (providers.length === 0) {
    return (
      <div className="card p-12 text-center">
        <p className="text-4xl mb-4">🔍</p>
        <p className="font-semibold text-gray-700 text-lg">No providers available</p>
        <p className="text-gray-400 text-sm mt-1">No verified providers are currently available. Please try again shortly.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {providers.map(p => (
        <div key={p.id} className="card p-5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-blue-brand flex items-center justify-center text-white font-bold text-lg shrink-0">
              {p.name[0]}
            </div>
            <div>
              <p className="font-semibold text-gray-900">{p.name}</p>
              <p className="text-sm text-gray-500">{p.specialty} · {p.credentials}</p>
              <div className="flex items-center gap-3 mt-0.5">
                <span className="text-xs text-gray-400">
                  {p.rating > 0 ? `⭐ ${p.rating.toFixed(1)}` : "New provider"}
                </span>
                {p.total_visits > 0 && (
                  <span className="text-xs text-gray-400">{p.total_visits} visits</span>
                )}
              </div>
            </div>
          </div>
          <button
            onClick={() => book(p)}
            disabled={booking !== null}
            className="btn-primary shrink-0"
          >
            {booking === p.id ? "Booking…" : "Book"}
          </button>
        </div>
      ))}
    </div>
  );
}