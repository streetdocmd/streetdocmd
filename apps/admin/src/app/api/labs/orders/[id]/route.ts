import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase, createServerSupabase } from "@/lib/supabase-server";

// PATCH /api/labs/orders/:id { action: "reassign" | "cancel", note? }
// Admins resolve an investigation order no lab could take (migration 067):
// try the matching again from scratch, or cancel it and mark the payment as
// due for a refund (handled in Finance, like visit refunds).
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { data: { user } } = await (await createServerSupabase()).auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminSupabase();
  const { data: profile } = await admin.from("users").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const note = typeof body.note === "string" ? body.note.trim().slice(0, 300) : "";
  const { data: order } = await admin.from("investigation_orders").select("id, status, payment_status").eq("id", params.id).maybeSingle();
  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });
  if (order.status !== "exception") return NextResponse.json({ error: "This order no longer needs attention." }, { status: 409 });

  if (body.action === "reassign") {
    // A fresh round: previous attempts no longer block those labs
    await admin.from("investigation_lab_attempts").delete().eq("order_id", order.id).neq("outcome", "accepted");
    await admin.from("investigation_orders").update({ lab_attempts: 0 }).eq("id", order.id);
    const { data, error } = await admin.rpc("investigation_request_lab", { p_order: order.id, p_use_current: false, p_reason: "Retried by StreetdocMD operations" });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (data === "exception") return NextResponse.json({ error: "Still no partner lab can take this order." }, { status: 409 });
    return NextResponse.json({ ok: true });
  }

  if (body.action === "cancel") {
    if (!note) return NextResponse.json({ error: "Give a reason for cancelling." }, { status: 400 });
    const { data, error } = await admin.rpc("investigation_transition", {
      p_order: order.id, p_to: "cancelled", p_actor: user.id, p_role: "admin", p_note: note, p_data: {},
    });
    if (error || data !== "ok") return NextResponse.json({ error: error?.message ?? "Couldn't cancel the order." }, { status: 409 });
    if (order.payment_status === "paid") await admin.from("investigation_orders").update({ refund_status: "due" }).eq("id", order.id);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Invalid request" }, { status: 400 });
}
