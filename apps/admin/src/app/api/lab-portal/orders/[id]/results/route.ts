import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase-server";
import { getPortalApiAccess, ownsRecord } from "@/components/portal/access";
import { signUpload, verifyUpload } from "@/lib/direct-upload";

export const dynamic = "force-dynamic";

const FLAGS = ["normal", "high", "low", "critical"];
const FILE_TYPES: Record<string, string> = { "application/pdf": "pdf", "image/jpeg": "jpg", "image/png": "png" };
const MAX_FILE_BYTES = 10 * 1024 * 1024; // matches the lab-results bucket limit
const BUCKET = "lab-results";

// The report goes straight to storage (lib/direct-upload.ts), so a large
// scan isn't rejected by Vercel's ~4.5 MB request limit:
//   POST ?step=prepare  { mime, size }            -> { path, token }
//   POST                { results, report_path? } -> saves the results

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await getPortalApiAccess("lab");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const admin = createAdminSupabase();

  const { data: order } = await admin
    .from("investigation_orders")
    .select("id, status, patient_id, provider_id, requested_by, lab_partner_id, tests")
    .eq("id", params.id)
    .maybeSingle();

  if (!order || !ownsRecord(auth.access, order.lab_partner_id)) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }
  // Results come after the sample is analysed, once (migration 067)
  if (order.status !== "analysis_in_progress") {
    return NextResponse.json({
      error: ["received_at_lab", "sample_collected", "in_transit"].includes(order.status)
        ? "Start the analysis before uploading results."
        : "Results for this order have already been uploaded, or it isn't ready for results.",
    }, { status: 409 });
  }

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;

  if (req.nextUrl.searchParams.get("step") === "prepare") {
    const ext = FILE_TYPES[String(body?.mime ?? "")];
    if (!ext) return NextResponse.json({ error: "The report must be a PDF, JPG or PNG file." }, { status: 400 });
    if (!Number(body?.size)) return NextResponse.json({ error: "This file is empty. Please choose another." }, { status: 400 });
    if (Number(body?.size) > MAX_FILE_BYTES) return NextResponse.json({ error: "The report must be smaller than 10 MB." }, { status: 400 });
    // Private bucket: the path is stored and links are signed on demand
    const signed = await signUpload(admin, BUCKET, `${params.id}/report-${Date.now()}.${ext}`);
    if (!signed) return NextResponse.json({ error: "Couldn't start the upload. Please try again." }, { status: 500 });
    return NextResponse.json(signed);
  }

  const results = body?.results as { test_name: string; result_value: string; unit: string; reference_range: string; flag: string }[];
  if (!Array.isArray(results)) return NextResponse.json({ error: "Invalid results payload" }, { status: 400 });
  const reportPath = typeof body?.report_path === "string" && body.report_path ? body.report_path : null;

  const hasFile = !!reportPath;
  if (results.length === 0 && !hasFile) {
    return NextResponse.json({ error: "Add at least one result or attach the result report." }, { status: 400 });
  }
  if (!hasFile && results.some(r => !String(r.result_value ?? "").trim())) {
    return NextResponse.json({ error: "Enter a result for every test, or attach the result report." }, { status: 400 });
  }

  // The report was uploaded before this call, so a failed upload never
  // leaves the order "resulted" without it. Check it's really ours and valid.
  let pdfUrl: string | null = null;
  if (reportPath) {
    const pattern = new RegExp(`^${params.id}/report-\\d+\\.(pdf|jpg|png)$`);
    const bad = await verifyUpload(admin, BUCKET, reportPath, pattern, MAX_FILE_BYTES);
    if (bad) return NextResponse.json({ error: bad }, { status: 400 });
    pdfUrl = reportPath;
  }

  const rows = results.map(r => ({
    order_id:        params.id,
    test_name:       String(r.test_name ?? "").slice(0, 200) || "Test",
    result_value:    String(r.result_value ?? "").trim() || null,
    unit:            String(r.unit ?? "").trim() || null,
    reference_range: String(r.reference_range ?? "").trim() || null,
    flag:            FLAGS.includes(r.flag) ? r.flag : "normal",
    result_pdf_url:  pdfUrl,
  }));

  // Full replace on upload
  const { error: deleteErr } = await admin.from("investigation_results").delete().eq("order_id", params.id);
  if (deleteErr) return NextResponse.json({ error: deleteErr.message }, { status: 500 });
  if (rows.length > 0) {
    const { error: insertErr } = await admin.from("investigation_results").insert(rows);
    if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 });
  }

  const critical = rows.some(r => r.flag === "critical");
  await admin.from("investigation_orders").update({ has_critical: critical }).eq("id", params.id);

  const actor = { p_actor: auth.access.user.id, p_role: "lab" };
  const { data: moved, error: statusErr } = await admin.rpc("investigation_transition", {
    p_order: params.id, p_to: "results_uploaded", ...actor, p_note: critical ? "Includes a critical result" : null,
    p_data: { tests: rows.length, report: !!pdfUrl, critical },
  });
  if (statusErr || moved !== "ok") {
    return NextResponse.json({ error: "Results saved, but the order status didn't update. Refresh and try again." }, { status: 500 });
  }
  // A doctor's order goes to them for review; the patient sees results either way
  if (order.requested_by === "provider" && order.provider_id) {
    await admin.rpc("investigation_transition", { p_order: params.id, p_to: "doctor_review_pending", ...actor, p_note: null, p_data: {} });
  }

  // The patient and the requesting doctor are notified by the
  // investigation_orders trigger (migration 067); no result values are sent
  return NextResponse.json({ ok: true });
}
