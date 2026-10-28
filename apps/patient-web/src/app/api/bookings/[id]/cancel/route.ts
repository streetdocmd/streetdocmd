import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase, getRequestSupabase } from "@/lib/supabase-server";

// Statuses a patient can still cancel: before a provider has accepted
const CANCELLABLE = ["pending_payment", "pending", "paid"];

// POST /api/bookings/:id/cancel: the patient cancels their request.
// Open dispatch offers are closed; a booking that was already paid is
// marked refund_status = 'due' for finance (migration 059).
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { user } = await getRequestSupabase(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminSupabase();
  const { data: booking } = await admin
    .from("bookings")
    .select("id, patient_id, status, payment_status")
    .eq("id", params.id)
    .maybeSingle();

  if (!booking || booking.patient_id !== user.id) {
    return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  }
  if (!CANCELLABLE.includes(booking.status)) {
    return NextResponse.json({ error: "A provider has already accepted this visit, so it can't be cancelled here. Email us and we'll help." }, { status: 409 });
  }

  const paid = booking.payment_status === "successful";
  const update = { status: "cancelled", cancelled_at: new Date().toISOString(), refund_status: paid ? "due" : null };

  // The status guard makes this a compare and swap against a provider accepting at the same moment
  let { data: updated, error } = await admin
    .from("bookings").update(update).eq("id", booking.id).in("status", CANCELLABLE).select("id");
  if (error && /cancelled_at|refund_status/.test(error.message ?? "")) {
    // Migration 059 not applied yet: cancel without the refund bookkeeping
    ({ data: updated, error } = await admin
      .from("bookings").update({ status: "cancelled" }).eq("id", booking.id).in("status", CANCELLABLE).select("id"));
  }
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!updated?.length) {
    return NextResponse.json({ error: "A provider accepted this visit just now, so it can't be cancelled here." }, { status: 409 });
  }

  // Close any offer still waiting on a provider
  await admin
    .from("dispatch_queue")
    .update({ response: "expired", responded_at: new Date().toISOString() })
    .eq("booking_id", booking.id)
    .is("response", null);

  return NextResponse.json({ cancelled: true, refund_due: paid });
}
