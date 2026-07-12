import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase-server";
import { SERVICE_LABELS, formatNaira } from "@/lib/shared";
import PaystackButton from "./PaystackButton";

export default async function PaymentPage({ params }: { params: { id: string } }) {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: booking } = await supabase
    .from("bookings")
    .select("*, providers(name, specialty)")
    .eq("id", params.id)
    .eq("patient_id", user.id)
    .single();

  if (!booking) redirect("/dashboard/bookings");
  if (booking.payment_status === "successful") redirect(`/dashboard/book/tracking/${params.id}`);

  const { data: profile } = await supabase.from("users").select("email, name").eq("id", user.id).single();

  return (
    <div className="max-w-lg mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Complete Payment</h1>

      <div className="card p-6 mb-4">
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-4">Booking Summary</h2>
        <dl className="space-y-3">
          <Row label="Service" value={(SERVICE_LABELS as Record<string, string>)[booking.service_type]} />
          {booking.providers && <Row label="Provider" value={`${booking.providers.name} · ${booking.providers.specialty}`} />}
          <Row label="Platform fee (20%)" value={formatNaira(booking.commission)} />
          <div className="border-t border-gray-100 pt-3">
            <Row label="Total" value={formatNaira(booking.fee)} bold />
          </div>
        </dl>
      </div>

      <div className="card p-6 mb-6 bg-amber-50 border-amber-100">
        <p className="text-sm text-amber-700">
          <span className="font-semibold">Note:</span> Payment is collected upfront. Your provider will be dispatched once payment is confirmed.
        </p>
      </div>

      <PaystackButton
        bookingId={params.id}
        amount={booking.fee}
        email={profile?.email ?? user.email ?? ""}
        name={profile?.name ?? ""}
      />
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex justify-between">
      <dt className="text-sm text-gray-500">{label}</dt>
      <dd className={`text-sm ${bold ? "font-bold text-blue-brand text-base" : "font-medium text-gray-900"}`}>{value}</dd>
    </div>
  );
}