import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase, getRequestSupabase } from "@/lib/supabase-server";
import { transition } from "@/lib/investigations";

// POST /api/investigations/:id/decline { reason? }: the patient declines tests
// their doctor requested, before paying. Paid orders can't be cancelled.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { user } = await getRequestSupabase(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const reason = typeof body.reason === "string" ? body.reason.trim().slice(0, 500) : "";

  const admin = createAdminSupabase();
  const { data: order } = await admin.from("investigation_orders").select("id, patient_id, status, provider_id").eq("id", params.id).maybeSingle();
  if (!order || order.patient_id !== user.id) return NextResponse.json({ error: "Order not found" }, { status: 404 });

  // A doctor's request is declined; any other unpaid order is just cancelled
  const to = order.status === "awaiting_patient_approval" ? "declined_by_patient"
    : ["draft", "awaiting_payment", "payment_failed"].includes(order.status) ? "cancelled"
    : null;
  if (!to) return NextResponse.json({ error: "This order can't be declined now." }, { status: 409 });

  const err = await transition(admin, order.id, to, user.id, "patient", reason || (to === "cancelled" ? "Patient cancelled before paying" : "Patient declined"));
  if (err) return NextResponse.json({ error: "This order can't be declined now." }, { status: 409 });
  return NextResponse.json({ ok: true });
}
