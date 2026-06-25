import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase-server";

export async function POST(req: NextRequest) {
  const { reference, bookingId } = await req.json();
  if (!reference || !bookingId) return NextResponse.json({ error: "Missing fields" }, { status: 400 });

  const res = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
    headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` },
  });
  const { data } = await res.json();

  if (data?.status !== "success") {
    return NextResponse.json({ error: "Payment not successful" }, { status: 400 });
  }

  const supabase = createAdminSupabase();

  // Mark booking payment successful
  await supabase
    .from("bookings")
    .update({ payment_status: "successful" })
    .eq("id", bookingId);

  // Insert payment record (ignore conflict if webhook already created it)
  const patientId = data.metadata?.patient_id ?? data.customer?.metadata?.patient_id;
  await supabase.from("payments").upsert(
    {
      booking_id: bookingId,
      patient_id: patientId,
      amount: data.amount / 100,
      method: "card",
      paystack_reference: reference,
      status: "successful",
    },
    { onConflict: "paystack_reference", ignoreDuplicates: true }
  );

  // Credit provider wallet — do this here as the reliable path
  // (Paystack webhook to admin is secondary; if unconfigured, providers still get paid)
  const { data: booking } = await supabase
    .from("bookings")
    .select("provider_id, net_payout")
    .eq("id", bookingId)
    .single();

  if (booking?.provider_id && booking?.net_payout) {
    await supabase.rpc("increment_wallet", {
      p_provider_id: booking.provider_id,
      p_amount: booking.net_payout,
    });
  }

  return NextResponse.json({ ok: true });
}