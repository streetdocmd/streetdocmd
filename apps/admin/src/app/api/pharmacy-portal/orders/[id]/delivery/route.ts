import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase-server";
import { getPortalApiAccess, ownsRecord } from "@/components/portal/access";

export const dynamic = "force-dynamic";

const MAX_FILE_BYTES = 10 * 1024 * 1024; // matches the pharmacy-deliveries bucket limit
const FILE_TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "application/pdf": "pdf" };

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await getPortalApiAccess("pharmacy");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const form = await req.formData();
  const file = form.get("proof") as File | null;
  if (!file || file.size === 0) return NextResponse.json({ error: "Choose a photo or PDF to upload." }, { status: 400 });
  const ext = FILE_TYPES[file.type];
  if (!ext) return NextResponse.json({ error: "Proof of delivery must be a JPG, PNG, WebP or PDF file." }, { status: 400 });
  if (file.size > MAX_FILE_BYTES) return NextResponse.json({ error: "The file must be smaller than 10 MB." }, { status: 400 });

  const admin = createAdminSupabase();

  const { data: current } = await admin
    .from("prescription_orders")
    .select("id, status, patient_id, pharmacy_partner_id")
    .eq("id", params.id)
    .maybeSingle();
  if (!current || !ownsRecord(auth.access, current.pharmacy_partner_id)) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }
  if (current.status !== "dispatched") {
    return NextResponse.json({ error: "Proof of delivery can only be added once the order is out for delivery." }, { status: 409 });
  }

  const path  = `proof/${params.id}/${Date.now()}.${ext}`;
  const bytes = Buffer.from(await file.arrayBuffer());

  const { error: uploadError } = await admin.storage
    .from("pharmacy-deliveries")
    .upload(path, bytes, { contentType: file.type, upsert: true });

  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 });

  const { data: urlData } = admin.storage.from("pharmacy-deliveries").getPublicUrl(path);
  const proofUrl = urlData.publicUrl;

  // Update delivery_tracking row
  const { data: existing } = await admin
    .from("delivery_tracking")
    .select("id")
    .eq("prescription_order_id", params.id)
    .maybeSingle();

  const deliveredAt = new Date().toISOString();
  const trackingUpdate = { proof_of_delivery_url: proofUrl, delivered_at: deliveredAt };

  const { error: trackErr } = existing
    ? await admin.from("delivery_tracking").update(trackingUpdate).eq("id", existing.id)
    : await admin.from("delivery_tracking").insert({ prescription_order_id: params.id, ...trackingUpdate });
  if (trackErr) return NextResponse.json({ error: trackErr.message }, { status: 500 });

  // Mark order as delivered
  const { error: statusErr } = await admin.from("prescription_orders").update({ status: "delivered" }).eq("id", params.id);
  if (statusErr) return NextResponse.json({ error: statusErr.message }, { status: 500 });

  // Notify patient
  if (current.patient_id) {
    await notifyUser(admin, current.patient_id, "Medication delivered!", "Your medications have been delivered. Please confirm receipt in the app.");
  }

  return NextResponse.json({ ok: true, proofUrl });
}

async function notifyUser(admin: any, userId: string, title: string, body: string) {
  const { data: u } = await admin.from("users").select("push_token").eq("id", userId).single();
  const token = u?.push_token;
  if (!token?.startsWith("ExponentPushToken")) return;
  await fetch("https://exp.host/--/api/v2/push/send", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ to: token, title, body, sound: "default" }),
  }).catch(() => {});
}
