import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase, getRequestSupabase } from "@/lib/supabase-server";
import { readImage, removeImage, saveImage } from "@/lib/images";

// POST /api/profile/photo: the signed in patient sets their profile photo
// (users.photo_url, avatars bucket). DELETE removes it.
export async function POST(req: NextRequest) {
  const { user } = await getRequestSupabase(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const img = await readImage(req);
  if ("error" in img) return NextResponse.json({ error: img.error }, { status: 400 });

  const admin = createAdminSupabase();
  const { data: before } = await admin.from("users").select("photo_url").eq("id", user.id).maybeSingle();
  try {
    const url = await saveImage(admin, "avatars", `users/${user.id}`, img.file);
    const { error } = await admin.from("users").update({ photo_url: url }).eq("id", user.id);
    if (error) throw new Error(error.message);
    await removeImage(admin, "avatars", before?.photo_url);
    return NextResponse.json({ url });
  } catch {
    return NextResponse.json({ error: "Couldn't upload the picture. Please try again." }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const { user } = await getRequestSupabase(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminSupabase();
  const { data: before } = await admin.from("users").select("photo_url").eq("id", user.id).maybeSingle();
  await admin.from("users").update({ photo_url: null }).eq("id", user.id);
  await removeImage(admin, "avatars", before?.photo_url);
  return NextResponse.json({ ok: true });
}
