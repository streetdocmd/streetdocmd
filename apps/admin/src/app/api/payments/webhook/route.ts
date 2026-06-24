import { NextRequest, NextResponse } from "next/server";
import { createHmac } from "crypto";
import { createAdminSupabase } from "@/lib/supabase-server";

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const signature = req.headers.get("x-paystack-signature") ?? "";
  const expected = createHmac("sha512", process.env.PAYSTACK_SECRET_KEY!)
    .update(rawBody)
    .digest("hex");

  if (signature !== expected) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const event = JSON.parse(rawBody);
  if (event.event !== "charge.success") return NextResponse.json({ received: true });

  const { reference } = event.data as { reference: string };
  const supabase = createAdminSupabase();

  const { data: payment } = await supabase
    .from("payments")
    .select("booking_id, amount")
    .eq("paystack_reference", reference)
    .single();

  if (!payment) return NextResponse.json({ error: "Payment not found" }, { status: 404 });

  // Mark payment confirmed
  await supabase.from("payments").update({ status: "successful" }).eq("paystack_reference", reference);

  // Update booking payment status
  await supabase
    .from("bookings")
    .update({ payment_status: "paid" })
    .eq("id", payment.booking_id);

  // Credit provider wallet
  const { data: booking } = await supabase
    .from("bookings")
    .select("provider_id, net_payout")
    .eq("id", payment.booking_id)
    .single();

  if (booking?.provider_id && booking?.net_payout) {
    await supabase.rpc("increment_wallet", {
      p_provider_id: booking.provider_id,
      p_amount: booking.net_payout,
    });
  }

  return NextResponse.json({ received: true });
}