import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase, getRequestSupabase } from "@/lib/supabase-server";
import { isFacilityType, loadRateableOrder } from "@/lib/facility-reviews";

// POST /api/reviews/facility: the patient rates a delivered pharmacy order, a
// resulted lab order or a completed hospital referral (facility_reviews,
// migration 064). There is no client write policy; this route checks the
// order is the patient's own and finished, and takes the facility from it.
export async function POST(req: NextRequest) {
  const { user } = await getRequestSupabase(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const type = body.type;
  const orderId = typeof body.order_id === "string" ? body.order_id : "";
  const rating = Number(body.rating);
  const comment = typeof body.comment === "string" ? body.comment.trim().slice(0, 2000) : "";

  if (!isFacilityType(type) || !orderId) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return NextResponse.json({ error: "Please select a star rating." }, { status: 400 });
  }

  const admin = createAdminSupabase();
  const order = await loadRateableOrder(admin, type, orderId, user.id);
  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });
  if (!order.done) return NextResponse.json({ error: "You can rate this once it's complete." }, { status: 409 });

  const { error } = await admin.from("facility_reviews").insert({
    patient_id: user.id,
    facility_type: type,
    facility_id: order.facilityId,
    order_id: orderId,
    rating,
    comment: comment || null,
  });
  if (error) {
    if (error.code === "23505") return NextResponse.json({ error: "You've already rated this." }, { status: 409 });
    return NextResponse.json({ error: "Could not submit your rating. Please try again." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
