import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase-server";
import { getPortalApiAccess } from "@/components/portal/access";
import { PORTALS, type PortalType } from "@/components/portal/config";
import { readImage, removeImage, saveImage } from "@/lib/images";

export const dynamic = "force-dynamic";

// POST /api/facility/logo?type=pharmacy|lab|hospital: facility staff set the
// logo patients see (logo_url on the partner row, avatars bucket). DELETE
// removes it. Always the caller's own facility.
async function facility(req: NextRequest) {
  const type = req.nextUrl.searchParams.get("type") as PortalType;
  if (!(type in PORTALS)) return { error: NextResponse.json({ error: "Invalid request" }, { status: 400 }) };
  const auth = await getPortalApiAccess(type);
  if (!auth.ok) return { error: NextResponse.json({ error: auth.error }, { status: auth.status }) };
  if (!auth.access.partnerId) return { error: NextResponse.json({ error: "Only a facility's own staff can change its logo." }, { status: 403 }) };
  return { type, table: PORTALS[type].partnerTable, id: auth.access.partnerId };
}

export async function POST(req: NextRequest) {
  const f = await facility(req);
  if ("error" in f) return f.error;

  const img = await readImage(req);
  if ("error" in img) return NextResponse.json({ error: img.error }, { status: 400 });

  const admin = createAdminSupabase();
  const { data: before } = await admin.from(f.table).select("logo_url").eq("id", f.id).maybeSingle();
  try {
    const url = await saveImage(admin, "avatars", `${f.type}/${f.id}`, img.file);
    const { error } = await admin.from(f.table).update({ logo_url: url }).eq("id", f.id);
    if (error) throw new Error(error.message);
    await removeImage(admin, "avatars", (before as { logo_url?: string } | null)?.logo_url);
    return NextResponse.json({ url });
  } catch {
    return NextResponse.json({ error: "Couldn't upload the logo. Please try again." }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const f = await facility(req);
  if ("error" in f) return f.error;

  const admin = createAdminSupabase();
  const { data: before } = await admin.from(f.table).select("logo_url").eq("id", f.id).maybeSingle();
  await admin.from(f.table).update({ logo_url: null }).eq("id", f.id);
  await removeImage(admin, "avatars", (before as { logo_url?: string } | null)?.logo_url);
  return NextResponse.json({ ok: true });
}
