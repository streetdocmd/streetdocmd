import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase-server";
import { SERVICE_LABELS, formatNaira } from "@/lib/shared";
import { Card, TopBar } from "@/components/ds";
import PaystackButton from "./PaystackButton";

export default async function PaymentPage({ params }: { params: { id: string } }) {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: booking } = await supabase
    .from("bookings")
    .select("*, providers!bookings_provider_id_fkey(name, specialty)")
    .eq("id", params.id)
    .eq("patient_id", user.id)
    .single();

  if (!booking) redirect("/dashboard/bookings");
  if (booking.payment_status === "successful") redirect(`/dashboard/book/tracking/${params.id}`);

  const { data: profile } = await supabase.from("users").select("email, name").eq("id", user.id).single();

  const when = booking.scheduled_at
    ? new Date(booking.scheduled_at).toLocaleString("en-NG", { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true, timeZone: "Africa/Lagos" })
    : "Now";

  return (
    <div className="mx-auto max-w-lg">
      <TopBar title="Review and pay" className="-mx-5 -mt-2 md:mx-0" />
      <div className="mb-4 flex gap-1.5" aria-hidden>
        <span className="h-[5px] flex-1 rounded bg-accent" />
        <span className="h-[5px] flex-1 rounded bg-accent" />
        <span className="h-[5px] flex-1 rounded bg-line" />
      </div>

      <Card padded={false} className="px-5 py-1">
        <dl>
          <Row label="Booking" value={(SERVICE_LABELS as Record<string, string>)[booking.service_type]} />
          {booking.providers && <Row label="Provider" value={booking.providers.name} />}
          <Row label="For" value={booking.family_member_id ? "A family member" : "Me"} />
          <Row label="When" value={when} />
          {booking.patient_address && <Row label="Where" value={booking.patient_address} />}
        </dl>
      </Card>

      <Card className="mt-3">
        <h2 className="mb-1 text-ds-control font-bold text-navy">Price</h2>
        <dl>
          <Row label="Platform fee (20%)" value={formatNaira(booking.commission)} />
          <Row label="Total" value={formatNaira(booking.fee)} bold />
        </dl>
      </Card>

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
    <div className={`flex items-center justify-between gap-4 border-b border-line py-2.5 text-ds-sm last:border-b-0 ${bold ? "text-ds-md" : ""}`}>
      <dt className="text-muted">{label}</dt>
      <dd className={`text-right ${bold ? "font-extrabold text-navy" : "font-bold text-ink"} tabular-nums`}>{value}</dd>
    </div>
  );
}
