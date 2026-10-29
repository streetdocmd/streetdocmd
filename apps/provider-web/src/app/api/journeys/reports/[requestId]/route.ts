import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase, createServerSupabase } from "@/lib/supabase-server";

// GET /api/journeys/reports/:requestId: download a report StreetdocMD
// approved for you, through a 10 minute link (care-reports is private).
export async function GET(_req: NextRequest, { params }: { params: { requestId: string } }) {
  const { data: { user } } = await (await createServerSupabase()).auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminSupabase();
  const { data: r } = await admin.from("care_report_requests").select("requested_by, status, file_path").eq("id", params.requestId).maybeSingle();
  if (!r || r.requested_by !== user.id || r.status !== "approved" || !r.file_path) {
    return NextResponse.json({ error: "Report not available" }, { status: 404 });
  }
  const { data } = await admin.storage.from("care-reports").createSignedUrl(r.file_path, 600, { download: true });
  if (!data?.signedUrl) return NextResponse.json({ error: "Report not available" }, { status: 404 });
  return NextResponse.redirect(data.signedUrl);
}
