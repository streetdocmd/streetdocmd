import { randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase, getRequestSupabase } from "@/lib/supabase-server";
import { RESULT_STATUSES } from "@/lib/investigation-status";

// POST /api/investigations/:id/share: the patient creates a link to send their
// results to a doctor of their choice. It works for 7 days and can be revoked
// (DELETE ?token=). Only results that have been published can be shared.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { user } = await getRequestSupabase(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminSupabase();
  const { data: order } = await admin.from("investigation_orders").select("id, patient_id, status").eq("id", params.id).maybeSingle();
  if (!order || order.patient_id !== user.id) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!(RESULT_STATUSES as string[]).includes(order.status)) {
    return NextResponse.json({ error: "Results can be shared once they're ready." }, { status: 409 });
  }

  const token = randomBytes(24).toString("base64url");
  const expires = new Date(Date.now() + 7 * 86_400_000).toISOString();
  const { error } = await admin.from("investigation_shares").insert({ order_id: order.id, token, created_by: user.id, expires_at: expires });
  if (error) return NextResponse.json({ error: "Couldn't create the link. Please try again." }, { status: 500 });
  await admin.from("investigation_order_events").insert({
    order_id: order.id, from_status: order.status, to_status: order.status, actor_id: user.id, actor_role: "patient",
    note: "Patient created a share link", data: { expires_at: expires },
  });

  const base = process.env.NEXT_PUBLIC_APP_URL ?? new URL(req.url).origin;
  return NextResponse.json({ url: `${base}/share/results/${token}`, expires_at: expires });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const { user } = await getRequestSupabase(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const token = req.nextUrl.searchParams.get("token");
  if (!token) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  const admin = createAdminSupabase();
  await admin.from("investigation_shares").update({ revoked_at: new Date().toISOString() })
    .eq("order_id", params.id).eq("token", token).eq("created_by", user.id);
  return NextResponse.json({ ok: true });
}
