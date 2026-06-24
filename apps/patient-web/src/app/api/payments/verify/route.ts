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
  await supabase.from("bookings").update({
    payment_status: "successful",
    paystack_reference: reference,
  }).eq("id", bookingId);

  await supabase.from("payments").insert({
    booking_id: bookingId,
    patient_id: data.metadata?.patient_id,
    amount: data.amount / 100,
    method: "card",
    paystack_reference: reference,
    status: "successful",
  });

  return NextResponse.json({ ok: true });
}