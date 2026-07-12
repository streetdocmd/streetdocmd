import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, createAdminSupabase } from "@/lib/supabase-server";

async function sendExpoPush(token: string, title: string, body: string) {
  if (!token?.startsWith("ExponentPushToken")) return;
  await fetch("https://exp.host/--/api/v2/push/send", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ to: token, title, body, sound: "default" }),
  }).catch(() => {});
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase.from("users").select("role").eq("id", user.id).single();
  if (!profile || !["lab_staff", "admin"].includes(profile.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const admin = createAdminSupabase();

  // Fetch the order to get patient + provider
  const { data: order } = await admin
    .from("investigation_orders")
    .select("id, patient_id, provider_id, tests, providers(user_id)")
    .eq("id", params.id)
    .single();

  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });

  const formData = await req.formData();
  const resultsJson = formData.get("results") as string;
  const pdfFile = formData.get("pdf") as File | null;

  const results: {
    test_name: string;
    result_value: string;
    unit: string;
    reference_range: string;
    flag: string;
  }[] = JSON.parse(resultsJson ?? "[]");

  // Upload PDF to storage if provided
  let pdfUrl: string | null = null;
  if (pdfFile && pdfFile.size > 0) {
    const ext = pdfFile.type === "application/pdf" ? "pdf" : pdfFile.type.split("/")[1];
    const fileName = `${params.id}.${ext}`;
    const buffer = Buffer.from(await pdfFile.arrayBuffer());

    const { error: uploadErr } = await admin.storage
      .from("lab-results")
      .upload(fileName, buffer, { contentType: pdfFile.type, upsert: true });

    if (!uploadErr) {
      const { data: urlData } = admin.storage.from("lab-results").getPublicUrl(fileName);
      pdfUrl = urlData.publicUrl;
    }
  }

  // Upsert result rows (one per test)
  const rows = results.map(r => ({
    order_id:        params.id,
    test_name:       r.test_name,
    result_value:    r.result_value || null,
    unit:            r.unit || null,
    reference_range: r.reference_range || null,
    flag:            r.flag || "normal",
    result_pdf_url:  pdfUrl,
  }));

  // Delete old results and re-insert (full replace on upload)
  await admin.from("investigation_results").delete().eq("order_id", params.id);
  const { error: insertErr } = await admin.from("investigation_results").insert(rows);
  if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 });

  // Mark order as resulted
  await admin
    .from("investigation_orders")
    .update({ status: "resulted", resulted_at: new Date().toISOString() })
    .eq("id", params.id);

  // Push notification to patient
  const { data: patientUser } = await admin
    .from("users")
    .select("push_token, name")
    .eq("id", order.patient_id)
    .single();

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
      .single();

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
