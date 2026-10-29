import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase-server";
import { getPortalApiAccess, ownsRecord } from "@/components/portal/access";

export const dynamic = "force-dynamic";

// The steps a lab records itself (results go through ./results)
const LAB_STEPS = ["collection_scheduled", "sample_collected", "in_transit", "received_at_lab", "analysis_in_progress"];

// PATCH /api/lab-portal/orders/:id/status { status, ... }
//   collection_scheduled  { scheduled_at }  booking or rebooking the home visit
//   sample_collected      { identity_checked: true, collected_by, sample_notes? }
//   in_transit, received_at_lab, analysis_in_progress
// Only the assigned lab, and only moves investigation_can_move() allows
// (migration 067); each one is recorded with who made it.
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await getPortalApiAccess("lab");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = await req.json().catch(() => ({}));
  const to = String(body.status ?? "");
  if (!LAB_STEPS.includes(to)) return NextResponse.json({ error: "Invalid status" }, { status: 400 });

  const admin = createAdminSupabase();
  const { data: order } = await admin
    .from("investigation_orders")
    .select("id, status, lab_partner_id, collection_method")
    .eq("id", params.id)
    .maybeSingle();
  if (!order || !ownsRecord(auth.access, order.lab_partner_id)) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  const patch: Record<string, unknown> = {};
  const data: Record<string, unknown> = {};
  if (to === "collection_scheduled") {
    const at = new Date(String(body.scheduled_at ?? ""));
    if (Number.isNaN(at.getTime()) || at.getTime() < Date.now() - 3_600_000) {
      return NextResponse.json({ error: "Choose a collection time from now onwards." }, { status: 400 });
    }
    patch.collection_scheduled_at = at.toISOString();
    data.scheduled_at = patch.collection_scheduled_at;
  }
  if (to === "sample_collected" && order.collection_method !== "doctor") {
    const collectedBy = String(body.collected_by ?? "").trim().slice(0, 120);
    if (body.identity_checked !== true) {
      return NextResponse.json({ error: "Confirm you checked the patient's identity against the order." }, { status: 400 });
    }
    if (!collectedBy) return NextResponse.json({ error: "Enter who collected the sample." }, { status: 400 });
    patch.identity_checked = true;
    patch.collected_by = collectedBy;
    patch.collected_at = new Date().toISOString();
    patch.sample_notes = String(body.sample_notes ?? "").trim().slice(0, 500) || null;
    data.collected_by = collectedBy;
  }

  const { data: res, error } = await admin.rpc("investigation_transition", {
    p_order: order.id, p_to: to, p_actor: auth.access.user.id, p_role: "lab", p_note: null, p_data: data,
  });
  if (error) return NextResponse.json({ error: "Couldn't update the order. Please try again." }, { status: 500 });
  if (res !== "ok") {
    return NextResponse.json({ error: "This order has already moved on. Refresh the page to see its latest status." }, { status: 409 });
  }
  if (Object.keys(patch).length) await admin.from("investigation_orders").update(patch).eq("id", order.id);
  return NextResponse.json({ ok: true });
}
