import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase-server";
import { getPortalApiAccess, ownsRecord } from "@/components/portal/access";

export const dynamic = "force-dynamic";

// GET /api/lab-portal/orders/:id/file?kind=report|request
// The assigned lab (or an admin) opens the uploaded result report or the
// patient's outside doctor's request through a 10 minute link.
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await getPortalApiAccess("lab");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const admin = createAdminSupabase();
  const { data: order } = await admin
    .from("investigation_orders")
    .select("id, lab_partner_id, external_request, investigation_results(result_pdf_url)")
    .eq("id", params.id)
    .maybeSingle();
  if (!order || !ownsRecord(auth.access, order.lab_partner_id)) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const request = req.nextUrl.searchParams.get("kind") === "request";
  const bucket = request ? "investigation-requests" : "lab-results";
  const path = request
    ? (order.external_request as any)?.file_path
    : ((order.investigation_results as any[]) ?? []).find(r => r.result_pdf_url)?.result_pdf_url;
  if (!path) return NextResponse.json({ error: "File not found" }, { status: 404 });

  const { data } = await admin.storage.from(bucket).createSignedUrl(path, 600);
  if (!data?.signedUrl) return NextResponse.json({ error: "File not found" }, { status: 404 });
  return NextResponse.redirect(data.signedUrl);
}
