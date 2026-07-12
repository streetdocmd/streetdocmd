import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, createAdminSupabase } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase.from("users").select("role").eq("id", user.id).single();
  if (!profile || !["pharmacy_staff", "admin"].includes(profile.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const form = await req.formData();
  const file = form.get("proof") as File | null;
  if (!file) return NextResponse.json({ error: "No file" }, { status: 400 });

  const admin = createAdminSupabase();

  const ext   = file.name.split(".").pop() ?? "jpg";
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
    .single();

  const deliveredAt = new Date().toISOString();
  const trackingUpdate = { proof_of_delivery_url: proofUrl, delivered_at: deliveredAt };

  if (existing) {
    await admin.from("delivery_tracking").update(trackingUpdate).eq("id", existing.id);
  } else {
    await admin.from("delivery_tracking").insert({ prescription_order_id: params.id, ...trackingUpdate });
  }

  // Mark order as delivered
  await admin.from("prescription_orders").update({ status: "delivered" }).eq("id", params.id);

  // Notify patient
  const { data: order } = await admin.from("prescription_orders").select("patient_id").eq("id", params.id).single();
  if (order?.patient_id) {
    await notifyUser(admin, order.patient_id, "Medication delivered!", "Your medications have been delivered. Please confirm receipt in the app.");
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
