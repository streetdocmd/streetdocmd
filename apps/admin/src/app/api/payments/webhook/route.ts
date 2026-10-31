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
    } else if (metadata?.type === "investigation_order" && Array.isArray(metadata.order_ids) && metadata.order_ids.length > 1) {
      await confirmSplitInvestigationOrder(admin, (metadata.order_ids as unknown[]).map(String), paidNaira, String((event.data as any).reference ?? ""));
    } else if (metadata?.type === "investigation_order" && metadata.order_id) {
      await confirmInvestigationOrder(admin, String(metadata.order_id), paidNaira, String((event.data as any).reference ?? ""));
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
    .select("*") // fee, status and (after migration 056) service_charge
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

  // Patients pay the fee plus the service charge (migration 056; 0 for older bookings)
  const expected = Number(booking.fee) + Number(booking.service_charge ?? 0);
  if (paidNaira !== expected) {
    // Amount mismatch — do not confirm. Leave at pending_payment; it'll either
    // get a correct follow-up webhook or expire and show up for admin review.
    console.warn(`[payments/webhook] amount mismatch for booking ${bookingId}: paid ₦${paidNaira}, expected ₦${expected}`);
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

// Lab tests (migration 067). investigation_confirm_payment() is idempotent:
// a repeated webhook for a paid order does nothing, and only an amount equal
// to the order total confirms it. It then asks the lab chosen at checkout.
async function confirmInvestigationOrder(admin: ReturnType<typeof createAdminSupabase>, orderId: string, paidNaira: number, reference: string) {
  const { data, error } = await admin.rpc("investigation_confirm_payment", {
    p_order: orderId, p_amount: paidNaira, p_reference: reference,
  });
  if (error) {
    console.error(`[payments/webhook] failed to confirm investigation order ${orderId}`, error);
  } else if (data !== "ok" && data !== "already_paid") {
    console.warn(`[payments/webhook] investigation order ${orderId} not confirmed: ${data}`);
  }
}

// One payment for an order split between labs (migration 073). Each part is
// confirmed for its own total, but only when the amount paid is exactly the
// sum of the parts; otherwise nothing is confirmed and the mismatch is logged
// on the first part.
async function confirmSplitInvestigationOrder(admin: ReturnType<typeof createAdminSupabase>, orderIds: string[], paidNaira: number, reference: string) {
  const { data: parts } = await admin.from("investigation_orders").select("id, total_amount").in("id", orderIds);
  const sum = (parts ?? []).reduce((a, p: any) => a + Number(p.total_amount ?? 0), 0);
  if ((parts ?? []).length !== orderIds.length || Math.round(sum * 100) !== Math.round(paidNaira * 100)) {
    await confirmInvestigationOrder(admin, orderIds[0], paidNaira, reference);
    return;
  }
  for (const p of parts as any[]) await confirmInvestigationOrder(admin, p.id, Number(p.total_amount), reference);
}
