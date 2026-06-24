import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase-server";
import RateForm from "./RateForm";

export default async function RatePage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { providerId?: string };
}) {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: booking } = await supabase
    .from("bookings")
    .select("id, provider_id, status, providers(name)")
    .eq("id", params.id)
    .eq("patient_id", user.id)
    .single();

  if (!booking || booking.status !== "completed") redirect("/dashboard/bookings");

  const { data: existing } = await supabase.from("reviews").select("id").eq("booking_id", params.id).single();
  if (existing) redirect("/dashboard/bookings");

  return (
    <div className="max-w-lg mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Rate your visit</h1>
      {booking.providers && (
        <p className="text-gray-500 text-sm mb-6">
          How was your experience with <span className="font-medium text-gray-700">{(booking.providers as any).name}</span>?
        </p>
      )}
      <RateForm
        bookingId={params.id}
        providerId={booking.provider_id ?? searchParams.providerId ?? ""}
        patientId={user.id}
      />
    </div>
  );
}