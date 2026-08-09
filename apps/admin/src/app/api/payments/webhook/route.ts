import { NextRequest, NextResponse } from "next/server";
import { createHmac } from "crypto";
import { createAdminSupabase } from "@/lib/supabase-server";

// Single source of truth for payment confirmation. Client-side /verify
// endpoints are read-only status checks — only this webhook, verified via
// Paystack's HMAC signature, is allowed to mark a booking or prescription
// order as paid.
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

  const { amount, metadata } = event.data as { amount: number; metadata?: Record<string, unknown> };
  const paidNaira = amount / 100;
  const admin = createAdminSupabase();

  if (metadata?.type === "prescription_order" && metadata.order_id) {
    await confirmPrescriptionOrder(admin, String(metadata.order_id), paidNaira);
  } else if (metadata?.booking_id) {
    await confirmBooking(admin, String(metadata.booking_id), paidNaira);
  }
  // Unrecognized metadata shape: nothing to reconcile against — ack and ignore.

  return NextResponse.json({ received: true });
}

async function confirmBooking(admin: ReturnType<typeof createAdminSupabase>, bookingId: string, paidNaira: number) {
  const { data: booking } = await admin
    .from("bookings")
    .select("fee, status")
    .eq("id", bookingId)
    .single();

  // Not found, or not awaiting payment (already paid, expired, cancelled) — no-op.
  // This is the idempotency guard: a duplicate webhook delivery finds status
  // already flipped and does nothing.
  if (!booking || booking.status !== "pending_payment") return;

  if (paidNaira !== booking.fee) {
    // Amount mismatch — do not confirm. Leave at pending_payment; it'll either
    // get a correct follow-up webhook or expire and show up for admin review.
    return;
  }

  // Guarded by status = 'pending_payment': this is the compare-and-swap that
  // prevents a race with a concurrent duplicate delivery, and is what fires
  // the bookings_initial_dispatch trigger (AFTER UPDATE ... WHEN status -> paid).
  await admin
    .from("bookings")
    .update({ status: "paid", payment_status: "successful" })
    .eq("id", bookingId)
    .eq("status", "pending_payment");
}

async function confirmPrescriptionOrder(admin: ReturnType<typeof createAdminSupabase>, orderId: string, paidNaira: number) {
  const { data: order } = await admin
    .from("prescription_orders")
    .select("total_amount, status")
    .eq("id", orderId)
    .single();

  if (!order || order.status !== "pending_payment") return;
  if (paidNaira !== order.total_amount) return;

  await admin
    .from("prescription_orders")
    .update({ status: "confirmed", payment_status: "paid" })
    .eq("id", orderId)
    .eq("status", "pending_payment");
}
