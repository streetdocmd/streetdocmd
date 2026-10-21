import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase-server";
import { getPortalApiAccess, ownsRecord } from "@/components/portal/access";
import { LAB_FLOW } from "@/components/portal/statuses";

export const dynamic = "force-dynamic";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await getPortalApiAccess("lab");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { status } = await req.json().catch(() => ({}));
  if (!LAB_FLOW.includes(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }
  if (status === "resulted") {
    return NextResponse.json({ error: "Upload the results to mark this order as resulted." }, { status: 400 });
  }

  const admin = createAdminSupabase();
  const { data: order } = await admin
    .from("investigation_orders")
    .select("id, status, lab_partner_id")
    .eq("id", params.id)
    .maybeSingle();
  if (!order || !ownsRecord(auth.access, order.lab_partner_id)) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  // Orders only move one step forward at a time
  if (LAB_FLOW.indexOf(status) !== LAB_FLOW.indexOf(order.status) + 1) {
    return NextResponse.json({ error: "This order has already moved on. Refresh the page to see its latest status." }, { status: 409 });
  }

  const { error } = await admin
    .from("investigation_orders")
    .update({ status })
    .eq("id", params.id)
    .eq("status", order.status);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
