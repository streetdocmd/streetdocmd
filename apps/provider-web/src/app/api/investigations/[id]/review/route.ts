import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase, createServerSupabase } from "@/lib/supabase-server";

const NEXT_STEPS = ["none", "treatment", "repeat_test", "referral", "follow_up"];

// POST /api/investigations/:id/review { interpretation, next_step, notes? } or { complete: true }
// The requesting doctor records what the results mean and the next step
// (migration 067). A follow up step leaves the order "follow up needed";
// otherwise it's "reviewed". The patient is notified to read the notes.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { data: { user } } = await (await createServerSupabase()).auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));

  // { complete: true }: follow up has been done, the order is complete
  if (body.complete === true) {
    const admin = createAdminSupabase();
    const { data: provider } = await admin.from("providers").select("id").eq("user_id", user.id).maybeSingle();
    const { data: order } = await admin.from("investigation_orders").select("id, provider_id, status").eq("id", params.id).maybeSingle();
    if (!order || !provider || order.provider_id !== provider.id) return NextResponse.json({ error: "Order not found" }, { status: 404 });
    const { data, error } = await admin.rpc("investigation_transition", {
      p_order: order.id, p_to: "completed", p_actor: user.id, p_role: "doctor", p_note: "Follow up done", p_data: {},
    });
    if (error || data !== "ok") return NextResponse.json({ error: "This order can't be completed yet." }, { status: 409 });
    return NextResponse.json({ ok: true });
  }

  const interpretation = typeof body.interpretation === "string" ? body.interpretation.trim().slice(0, 3000) : "";
  const nextStep = String(body.next_step ?? "");
  const notes = typeof body.notes === "string" ? body.notes.trim().slice(0, 2000) : "";
  if (!interpretation) return NextResponse.json({ error: "Write your interpretation of the results." }, { status: 400 });
  if (!NEXT_STEPS.includes(nextStep)) return NextResponse.json({ error: "Choose the next step." }, { status: 400 });

  const admin = createAdminSupabase();
  const { data: provider } = await admin.from("providers").select("id").eq("user_id", user.id).maybeSingle();
  const { data: order } = await admin.from("investigation_orders").select("id, provider_id, status").eq("id", params.id).maybeSingle();
  if (!order || !provider || order.provider_id !== provider.id) return NextResponse.json({ error: "Order not found" }, { status: 404 });
  if (order.status !== "doctor_review_pending") return NextResponse.json({ error: "These results have already been reviewed." }, { status: 409 });

  const { error: upErr } = await admin.from("investigation_orders").update({
    review_interpretation: interpretation, review_next_step: nextStep, review_notes: notes || null,
  }).eq("id", order.id);
  if (upErr) return NextResponse.json({ error: "Couldn't save your review. Please try again." }, { status: 500 });

  const to = nextStep === "follow_up" || nextStep === "repeat_test" || nextStep === "referral" ? "follow_up_required" : "reviewed";
  const { data, error } = await admin.rpc("investigation_transition", {
    p_order: order.id, p_to: to, p_actor: user.id, p_role: "doctor", p_note: null, p_data: { next_step: nextStep },
  });
  if (error || data !== "ok") return NextResponse.json({ error: "Couldn't save your review. Refresh and try again." }, { status: 409 });
  return NextResponse.json({ ok: true });
}
