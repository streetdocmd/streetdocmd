import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase-server";
import { getPortalApiAccess } from "@/components/portal/access";

export const dynamic = "force-dynamic";

// POST /api/lab-portal/orders/:id/respond { accept, reason? }
// The lab accepts or declines a test request within 30 minutes. A decline
// moves the order to the next best lab at once (investigation_lab_respond,
// migration 067).
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await getPortalApiAccess("lab");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  if (!auth.access.partnerId) return NextResponse.json({ error: "Only the lab's own staff can respond." }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  if (typeof body.accept !== "boolean") return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  const reason = typeof body.reason === "string" ? body.reason.trim().slice(0, 300) : "";
  if (!body.accept && !reason) return NextResponse.json({ error: "Say why you can't take this order." }, { status: 400 });

  const { data, error } = await createAdminSupabase().rpc("investigation_lab_respond", {
    p_order: params.id, p_lab: auth.access.partnerId, p_accept: body.accept, p_actor: auth.access.user.id, p_reason: reason || null,
  });
  if (error) return NextResponse.json({ error: "Couldn't save your answer. Please try again." }, { status: 500 });
  if (data === "not_found") return NextResponse.json({ error: "Order not found" }, { status: 404 });
  if (typeof data === "string" && data.startsWith("not_allowed")) {
    return NextResponse.json({ error: "This request has already been answered or has moved to another lab." }, { status: 409 });
  }
  return NextResponse.json({ ok: true });
}
