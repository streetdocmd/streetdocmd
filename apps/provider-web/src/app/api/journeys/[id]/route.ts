import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase, createServerSupabase } from "@/lib/supabase-server";

// POST /api/journeys/:id { action: "close" | "request_report", reason? }
// close: a clinician on the care team closes the journey (usually after the
// patient confirmed recovery). Unreviewed results block it (migration 067).
// request_report: ask StreetdocMD for the journey's report; an admin
// approves it before it can be downloaded (migration 068).
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: allowed } = await supabase.rpc("care_chat_access", { p_episode: params.id });
  const admin = createAdminSupabase();
  const { data: provider } = await admin.from("providers").select("id").eq("user_id", user.id).maybeSingle();
  if (!allowed || !provider) return NextResponse.json({ error: "Journey not found" }, { status: 404 });

  const body = await req.json().catch(() => ({}));

  if (body.action === "close") {
    const { data: ep } = await admin.from("care_episodes").select("status").eq("id", params.id).maybeSingle();
    if (!ep || ["closed", "resolved"].includes(ep.status)) return NextResponse.json({ error: "This journey is already closed." }, { status: 409 });
    const { error } = await admin.from("care_episodes")
      .update({ status: "closed", closed_at: new Date().toISOString(), end_date: new Date().toISOString().slice(0, 10), updated_at: new Date().toISOString() })
      .eq("id", params.id);
    if (error) {
      // The review guard explains what's still open
      return NextResponse.json({ error: error.message.includes("investigations") ? error.message : "Couldn't close the journey. Please try again." }, { status: 409 });
    }
    return NextResponse.json({ ok: true });
  }

  if (body.action === "request_report") {
    const reason = typeof body.reason === "string" ? body.reason.trim().slice(0, 500) : "";
    const { data: open } = await admin.from("care_report_requests").select("id")
      .eq("care_episode_id", params.id).eq("requested_by", user.id).eq("status", "pending").maybeSingle();
    if (open) return NextResponse.json({ error: "You already have a request waiting for approval." }, { status: 409 });
    const { error } = await admin.from("care_report_requests").insert({
      care_episode_id: params.id, requested_by: user.id, requester_role: "provider", reason: reason || null,
    });
    if (error) return NextResponse.json({ error: "Couldn't send the request. Please try again." }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Invalid request" }, { status: 400 });
}
