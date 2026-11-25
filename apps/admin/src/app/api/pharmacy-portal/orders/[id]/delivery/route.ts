import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase-server";
import { getPortalApiAccess, ownsRecord } from "@/components/portal/access";
import { signUpload, verifyUpload } from "@/lib/direct-upload";

export const dynamic = "force-dynamic";

const MAX_FILE_BYTES = 10 * 1024 * 1024; // matches the pharmacy-deliveries bucket limit
const FILE_TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "application/pdf": "pdf" };
const BUCKET = "pharmacy-deliveries";

// The photo goes straight to storage (lib/direct-upload.ts), so a large
// phone photo isn't rejected by Vercel's ~4.5 MB request limit:
//   POST ?step=prepare  { mime, size } -> { path, token }
//   POST                { path }       -> records it and marks the order delivered

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await getPortalApiAccess("pharmacy");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const prepare = req.nextUrl.searchParams.get("step") === "prepare";
  const ext = FILE_TYPES[String(body?.mime ?? "")];
  if (prepare) {
    if (!Number(body?.size)) return NextResponse.json({ error: "Choose a photo or PDF to upload." }, { status: 400 });
    if (!ext) return NextResponse.json({ error: "Proof of delivery must be a JPG, PNG, WebP or PDF file." }, { status: 400 });
    if (Number(body?.size) > MAX_FILE_BYTES) return NextResponse.json({ error: "The file must be smaller than 10 MB." }, { status: 400 });
  }

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

  if (prepare) {
    const signed = await signUpload(admin, BUCKET, `proof/${params.id}/${Date.now()}.${ext}`);
    if (!signed) return NextResponse.json({ error: "Couldn't start the upload. Please try again." }, { status: 500 });
    return NextResponse.json(signed);
  }

  const path = String(body?.path ?? "");
  if (!path) return NextResponse.json({ error: "Choose a photo or PDF to upload." }, { status: 400 });
  const pattern = new RegExp(`^proof/${params.id}/[0-9]+[.](jpg|png|webp|pdf)$`);
  const bad = await verifyUpload(admin, BUCKET, path, pattern, MAX_FILE_BYTES);
  if (bad) return NextResponse.json({ error: bad }, { status: 400 });

  const { data: urlData } = admin.storage.from(BUCKET).getPublicUrl(path);
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

  return NextResponse.json({ ok: true, proofUrl });
}
