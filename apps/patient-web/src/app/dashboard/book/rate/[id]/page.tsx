import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase-server";
import { TopBar } from "@/components/ds";
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
    .select("id, provider_id, status, providers!bookings_provider_id_fkey(name)")
    .eq("id", params.id)
    .eq("patient_id", user.id)
    .single();

  if (!booking || booking.status !== "completed") redirect("/dashboard/bookings");

  const { data: existing } = await supabase.from("reviews").select("id").eq("booking_id", params.id).single();
  if (existing) redirect("/dashboard/bookings");

  return (
    <div className="mx-auto max-w-lg">
      <TopBar title="Rate your visit" backHref="/dashboard/bookings" className="-mx-5 -mt-2 md:mx-0" />
      {booking.providers && (
        <p className="mb-4 text-ds-sm text-muted">
          How was your experience with <span className="font-bold text-ink">{(booking.providers as any).name}</span>?
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