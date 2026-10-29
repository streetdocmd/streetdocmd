import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase-server";
import { getPortalApiAccess, ownsRecord } from "@/components/portal/access";
import { readImage, removeImage, saveImage } from "@/lib/images";

export const dynamic = "force-dynamic";

// POST /api/pharmacy-portal/products/:id/image: a pharmacy adds a picture to
// one of its own products (drug_catalogue.image_url, product-images bucket).
// DELETE removes it.
async function product(id: string) {
  const auth = await getPortalApiAccess("pharmacy");
  if (!auth.ok) return { error: NextResponse.json({ error: auth.error }, { status: auth.status }) };
  const { data } = await createAdminSupabase()
    .from("drug_catalogue").select("id, pharmacy_partner_id, image_url").eq("id", id).maybeSingle();
  if (!data || !auth.access.partnerId || !ownsRecord(auth.access, data.pharmacy_partner_id)) {
    return { error: NextResponse.json({ error: "Product not found" }, { status: 404 }) };
  }
  return { row: data };
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const p = await product(params.id);
  if ("error" in p) return p.error;

  const img = await readImage(req);
  if ("error" in img) return NextResponse.json({ error: img.error }, { status: 400 });

  const admin = createAdminSupabase();
  try {
    const url = await saveImage(admin, "product-images", `${p.row.pharmacy_partner_id}/${p.row.id}`, img.file);
    const { error } = await admin.from("drug_catalogue").update({ image_url: url, updated_at: new Date().toISOString() }).eq("id", p.row.id);
    if (error) throw new Error(error.message);
    await removeImage(admin, "product-images", p.row.image_url);
    return NextResponse.json({ url });
  } catch {
    return NextResponse.json({ error: "Couldn't upload the picture. Please try again." }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const p = await product(params.id);
  if ("error" in p) return p.error;

  const admin = createAdminSupabase();
  await admin.from("drug_catalogue").update({ image_url: null }).eq("id", p.row.id);
  await removeImage(admin, "product-images", p.row.image_url);
  return NextResponse.json({ ok: true });
}
