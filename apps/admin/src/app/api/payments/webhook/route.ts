import { NextRequest, NextResponse } from "next/server";
import { createHmac } from "crypto";
import { createAdminSupabase } from "@/lib/supabase-server";

// Single source of truth for payment confirmation. Client-side /verify
// endpoints are read-only status checks — only this webhook, verified via
// Paystack's HMAC signature, is allowed to mark a booking or prescription
// order as paid.
export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const signature = req.headers.get("x-paystack-signature") ?? "";

    if (!process.env.PAYSTACK_SECRET_KEY) {
      console.error("[payments/webhook] PAYSTACK_SECRET_KEY is not configured — cannot verify signature");
      return NextResponse.json({ error: "Webhook is not configured" }, { status: 500 });
    }

    const expected = createHmac("sha512", process.env.PAYSTACK_SECRET_KEY)
      .update(rawBody)
      .digest("hex");

    if (signature !== expected) {
      console.warn("[payments/webhook] signature mismatch — rejecting");
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    let event: any;
    try {
      event = JSON.parse(rawBody);
    } catch {
      console.error("[payments/webhook] malformed JSON payload");
      return NextResponse.json({ error: "Malformed payload" }, { status: 400 });
    }

    if (event.event !== "charge.success") return NextResponse.json({ received: true });

    const { amount, metadata } = event.data as { amount: number; metadata?: Record<string, unknown> };
    const paidNaira = amount / 100;
    const admin = createAdminSupabase();

    if (metadata?.type === "prescription_order" && metadata.order_id) {
      await confirmPrescriptionOrder(admin, String(metadata.order_id), paidNaira);
    } else if (metadata?.booking_id) {
      await confirmBooking(admin, String(metadata.booking_id), paidNaira);
    } else {
      console.warn("[payments/webhook] charge.success with unrecognized metadata shape", metadata);
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error("[payments/webhook] unhandled error", err);
    return NextResponse.json({ error: "Internal error processing webhook" }, { status: 500 });
  }
}

async function confirmBooking(admin: ReturnType<typeof createAdminSupabase>, bookingId: string, paidNaira: number) {
  const { data: booking, error: fetchError } = await admin
    .from("bookings")
    .select("fee, status")
    .eq("id", bookingId)
    .single();

  if (fetchError) {
    console.error(`[payments/webhook] failed to look up booking ${bookingId}`, fetchError);
    return;
  }

  // Not found, or not awaiting payment (already paid, expired, cancelled) — no-op.
  // This is the idempotency guard: a duplicate webhook delivery finds status
  // already flipped and does nothing.
  if (!booking || booking.status !== "pending_payment") return;

  if (paidNaira !== booking.fee) {
    // Amount mismatch — do not confirm. Leave at pending_payment; it'll either
    // get a correct follow-up webhook or expire and show up for admin review.
    console.warn(`[payments/webhook] amount mismatch for booking ${bookingId}: paid ₦${paidNaira}, expected ₦${booking.fee}`);
    return;
  }

  // Guarded by status = 'pending_payment': this is the compare-and-swap that
  // prevents a race with a concurrent duplicate delivery, and is what fires
  // the bookings_initial_dispatch trigger (AFTER UPDATE ... WHEN status -> paid).
  const { error: updateError } = await admin
    .from("bookings")
    .update({ status: "paid", payment_status: "successful" })
    .eq("id", bookingId)
    .eq("status", "pending_payment");

  if (updateError) {
    console.error(`[payments/webhook] failed to mark booking ${bookingId} as paid`, updateError);
  }
}

async function confirmPrescriptionOrder(admin: ReturnType<typeof createAdminSupabase>, orderId: string, paidNaira: number) {
  const { data: order, error: fetchError } = await admin
    .from("prescription_orders")
    .select("total_amount, status")
    .eq("id", orderId)
    .single();

  if (fetchError) {
    console.error(`[payments/webhook] failed to look up prescription order ${orderId}`, fetchError);
    return;
  }

  if (!order || order.status !== "pending_payment") return;
  if (paidNaira !== order.total_amount) {
    console.warn(`[payments/webhook] amount mismatch for order ${orderId}: paid ₦${paidNaira}, expected ₦${order.total_amount}`);
    return;
  }

  const { error: updateError } = await admin
    .from("prescription_orders")
    .update({ status: "confirmed", payment_status: "paid" })
    .eq("id", orderId)
    .eq("status", "pending_payment");

  if (updateError) {
    console.error(`[payments/webhook] failed to confirm prescription order ${orderId}`, updateError);
  }
}
