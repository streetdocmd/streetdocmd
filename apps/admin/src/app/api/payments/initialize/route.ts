import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase-server";

export async function POST(req: NextRequest) {
  const { booking_id } = await req.json();
  if (!booking_id) return NextResponse.json({ error: "booking_id required" }, { status: 400 });

  const supabase = createAdminSupabase();

  const { data: booking, error } = await supabase
    .from("bookings")
    .select("id, fee, payment_status, users!patient_id(email, phone)")
    .eq("id", booking_id)
    .single();

  if (error || !booking) return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  if (booking.payment_status === "paid") return NextResponse.json({ error: "Already paid" }, { status: 409 });

  const patient = booking.users as { email?: string; phone?: string } | null;
  const email = patient?.email ?? `${patient?.phone?.replace("+", "")}@streetdocmd.com`;
  const reference = `sdmd-${booking_id}-${Date.now()}`;

  const paystackRes = await fetch("https://api.paystack.co/transaction/initialize", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email,
      amount: booking.fee * 100, // kobo
      reference,
      metadata: { booking_id },
      callback_url: `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/api/payments/callback`,
    }),
  });

  const paystack = await paystackRes.json();
  if (!paystack.status) return NextResponse.json({ error: "Paystack error", detail: paystack.message }, { status: 502 });

  await supabase.from("payments").insert({
    booking_id,
    reference,
    amount: booking.fee,
    method: "card",
    status: "pending",
  });

  return NextResponse.json({ authorization_url: paystack.data.authorization_url, reference });
}