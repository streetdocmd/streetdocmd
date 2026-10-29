import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase, getRequestSupabase } from "@/lib/supabase-server";

// POST /api/care/:id { action: "recovered", note? } | { action: "request_report", reason? }
// recovered: the patient confirms they've recovered; the care team is told
// and the lead clinician closes the journey (migration 068).
// request_report: ask for the journey's medical report; StreetdocMD reviews
// each request before it can be downloaded.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { user } = await getRequestSupabase(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminSupabase();
  const { data: ep } = await admin.from("care_episodes").select("id, patient_id, status, recovered_at").eq("id", params.id).maybeSingle();
  if (!ep || ep.patient_id !== user.id) return NextResponse.json({ error: "Care journey not found" }, { status: 404 });

  const body = await req.json().catch(() => ({}));

  if (body.action === "recovered") {
    if (["closed", "resolved"].includes(ep.status)) return NextResponse.json({ error: "This care journey is already closed." }, { status: 409 });
    if (ep.recovered_at) return NextResponse.json({ ok: true });
    const note = typeof body.note === "string" ? body.note.trim().slice(0, 500) : "";
    const { error } = await admin.from("care_episodes")
      .update({ recovered_at: new Date().toISOString(), recovery_note: note || null, updated_at: new Date().toISOString() })
      .eq("id", ep.id).is("recovered_at", null);
    if (error) return NextResponse.json({ error: "Couldn't save. Please try again." }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (body.action === "request_report") {
    const reason = typeof body.reason === "string" ? body.reason.trim().slice(0, 500) : "";
    const { data: open } = await admin.from("care_report_requests").select("id")
      .eq("care_episode_id", ep.id).eq("requested_by", user.id).eq("status", "pending").maybeSingle();
    if (open) return NextResponse.json({ error: "Your request is already waiting for approval." }, { status: 409 });
    const { error } = await admin.from("care_report_requests").insert({
      care_episode_id: ep.id, requested_by: user.id, requester_role: "patient", reason: reason || null,
    });
    if (error) return NextResponse.json({ error: "Couldn't send the request. Please try again." }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Invalid request" }, { status: 400 });
}
