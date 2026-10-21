import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase-server";
import { getPortalApiAccess, ownsRecord } from "@/components/portal/access";

export const dynamic = "force-dynamic";

const FLAGS = ["normal", "high", "low", "critical"];
const FILE_TYPES: Record<string, string> = { "application/pdf": "pdf", "image/jpeg": "jpg", "image/png": "png" };
const MAX_FILE_BYTES = 10 * 1024 * 1024; // matches the lab-results bucket limit

async function sendExpoPush(token: string, title: string, body: string) {
  if (!token?.startsWith("ExponentPushToken")) return;
  await fetch("https://exp.host/--/api/v2/push/send", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ to: token, title, body, sound: "default" }),
  }).catch(() => {});
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await getPortalApiAccess("lab");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const admin = createAdminSupabase();

  const { data: order } = await admin
    .from("investigation_orders")
    .select("id, status, patient_id, provider_id, lab_partner_id, tests, providers(user_id)")
    .eq("id", params.id)
    .maybeSingle();

  if (!order || !ownsRecord(auth.access, order.lab_partner_id)) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }
  if (order.status === "resulted") {
    return NextResponse.json({ error: "Results for this order have already been uploaded." }, { status: 409 });
  }

  const formData = await req.formData();
  const resultsJson = formData.get("results");
  const pdfFile = formData.get("pdf") as File | null;

  let results: { test_name: string; result_value: string; unit: string; reference_range: string; flag: string }[];
  try {
    results = JSON.parse(typeof resultsJson === "string" ? resultsJson : "[]");
    if (!Array.isArray(results)) throw new Error();
  } catch {
    return NextResponse.json({ error: "Invalid results payload" }, { status: 400 });
  }

  const hasFile = !!pdfFile && pdfFile.size > 0;
  if (results.length === 0 && !hasFile) {
    return NextResponse.json({ error: "Add at least one result or attach the result report." }, { status: 400 });
  }
  if (!hasFile && results.some(r => !String(r.result_value ?? "").trim())) {
    return NextResponse.json({ error: "Enter a result for every test, or attach the result report." }, { status: 400 });
  }

  // Upload the report first, so a failed upload never leaves the order "resulted" without it
  let pdfUrl: string | null = null;
  if (hasFile) {
    const ext = FILE_TYPES[pdfFile!.type];
    if (!ext) return NextResponse.json({ error: "The report must be a PDF, JPG or PNG file." }, { status: 400 });
    if (pdfFile!.size > MAX_FILE_BYTES) return NextResponse.json({ error: "The report must be smaller than 10 MB." }, { status: 400 });
    const fileName = `${params.id}.${ext}`;
    const buffer = Buffer.from(await pdfFile!.arrayBuffer());
    const { error: uploadErr } = await admin.storage
      .from("lab-results")
      .upload(fileName, buffer, { contentType: pdfFile!.type, upsert: true });
    if (uploadErr) {
      console.error("lab result upload failed:", uploadErr);
      return NextResponse.json({ error: `Couldn't upload the report: ${uploadErr.message}` }, { status: 500 });
    }
    pdfUrl = admin.storage.from("lab-results").getPublicUrl(fileName).data.publicUrl;
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

  const { error: statusErr } = await admin
    .from("investigation_orders")
    .update({ status: "resulted", resulted_at: new Date().toISOString() })
    .eq("id", params.id);
  if (statusErr) return NextResponse.json({ error: `Results saved, but the order status didn't update: ${statusErr.message}` }, { status: 500 });

  // Push notification to patient
  const { data: patientUser } = await admin
    .from("users")
    .select("push_token, name")
    .eq("id", order.patient_id)
    .maybeSingle();

  if (patientUser?.push_token) {
    await sendExpoPush(
      patientUser.push_token,
      "Your lab results are ready",
      "Your investigation results are now available. Open the Lab Tests tab to view them."
    );
  }

  // Push notification to provider
  const providerUserId = (order.providers as any)?.user_id;
  if (providerUserId) {
    const { data: providerUser } = await admin
      .from("users")
      .select("push_token")
      .eq("id", providerUserId)
      .maybeSingle();

    if (providerUser?.push_token) {
      await sendExpoPush(
        providerUser.push_token,
        "Investigation results ready",
        `Results for your patient ${patientUser?.name ?? ""} are now available.`
      );
    }
  }

  return NextResponse.json({ ok: true, pdfUrl });
}
