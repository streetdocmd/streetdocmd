import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase, getRequestSupabase } from "@/lib/supabase-server";
import { signedLink, transition } from "@/lib/investigations";

// GET /api/investigations/:id/file?kind=report|request
// Opens the lab's result report, or the outside doctor's request the patient
// uploaded, through a link that expires in 10 minutes. Only the patient's own
// order. Opening the report of a self-service order completes it.
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const { user } = await getRequestSupabase(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminSupabase();
  const { data: order } = await admin
    .from("investigation_orders")
    .select("id, patient_id, status, requested_by, external_request, patient_viewed_at, investigation_results(result_pdf_url)")
    .eq("id", params.id)
    .maybeSingle();
  if (!order || order.patient_id !== user.id) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const kind = req.nextUrl.searchParams.get("kind");
  let url: string | null = null;
  if (kind === "request") {
    url = await signedLink(admin, "investigation-requests", (order.external_request as any)?.file_path);
  } else {
    const path = ((order.investigation_results as any[]) ?? []).find(r => r.result_pdf_url)?.result_pdf_url;
    url = await signedLink(admin, "lab-results", path);
    if (url && !order.patient_viewed_at) {
      await admin.from("investigation_orders").update({ patient_viewed_at: new Date().toISOString() }).eq("id", order.id);
      if (order.requested_by === "patient" && order.status === "results_uploaded") {
        await transition(admin, order.id, "completed", user.id, "patient", "Patient opened the results");
      }
    }
  }
  if (!url) return NextResponse.json({ error: "File not found" }, { status: 404 });
  return NextResponse.redirect(url);
}
