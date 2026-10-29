import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-auth";
import { createAdminSupabase } from "@/lib/supabase-server";
import { buildCareReport } from "@/lib/care-report";

export const dynamic = "force-dynamic";

// PATCH /api/admin/reports/:id { decision: "approve" | "reject", note? }
// An admin releases or refuses a requested medical report (migration 068).
// Approving generates the PDF once and stores it privately; the requester
// downloads that copy. A patient's copy leaves out the care team chat.
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAdminApi();
  if ("response" in auth) return auth.response;

  const body = await req.json().catch(() => ({}));
  const note = typeof body.note === "string" ? body.note.trim().slice(0, 500) : "";
  const admin = createAdminSupabase();
  const { data: request } = await admin.from("care_report_requests").select("*").eq("id", params.id).maybeSingle();
  if (!request) return NextResponse.json({ error: "Request not found" }, { status: 404 });
  if (request.status !== "pending") return NextResponse.json({ error: "This request has already been decided." }, { status: 409 });

  if (body.decision === "reject") {
    if (!note) return NextResponse.json({ error: "Give a reason; the requester sees it." }, { status: 400 });
    await admin.from("care_report_requests").update({
      status: "rejected", review_note: note, reviewed_by: auth.user.id, reviewed_at: new Date().toISOString(),
    }).eq("id", request.id).eq("status", "pending");
    return NextResponse.json({ ok: true });
  }

  if (body.decision !== "approve") return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  let pdf: Uint8Array;
  try {
    pdf = await buildCareReport(admin, request.care_episode_id, request.requester_role === "patient" ? "patient" : "full");
  } catch (e) {
    return NextResponse.json({ error: `Couldn't build the report: ${(e as Error).message}` }, { status: 500 });
  }
  const path = `${request.care_episode_id}/${request.id}.pdf`;
  const { error: upErr } = await admin.storage.from("care-reports").upload(path, Buffer.from(pdf), { contentType: "application/pdf", upsert: true });
  if (upErr) return NextResponse.json({ error: `Couldn't store the report: ${upErr.message}` }, { status: 500 });

  await admin.from("care_report_requests").update({
    status: "approved", file_path: path, review_note: note || null, reviewed_by: auth.user.id, reviewed_at: new Date().toISOString(),
  }).eq("id", request.id).eq("status", "pending");
  return NextResponse.json({ ok: true });
}
