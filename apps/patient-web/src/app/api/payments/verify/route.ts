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

  // Fetch booking to get patient_id (more reliable than Paystack metadata)
  const { data: booking } = await supabase
    .from("bookings")
    .select("patient_id, provider_id, net_payout")
    .eq("id", bookingId)
    .single();

  if (!booking) return NextResponse.json({ error: "Booking not found" }, { status: 404 });

  // Mark booking payment successful
  await supabase
    .from("bookings")
    .update({ payment_status: "successful" })
    .eq("id", bookingId);

  // Insert payment record — patient_id comes from booking, not Paystack metadata
  await supabase.from("payments").upsert(
    {
      booking_id: bookingId,
      patient_id: booking.patient_id,
      amount: data.amount / 100,
      method: "card",
      paystack_reference: reference,
      status: "successful",
    },
    { onConflict: "paystack_reference", ignoreDuplicates: true }
  );

  if (booking?.provider_id && booking?.net_payout) {
    await supabase.rpc("increment_wallet", {
      p_provider_id: booking.provider_id,
      p_amount: booking.net_payout,
    });
  }

  return NextResponse.json({ ok: true });
}