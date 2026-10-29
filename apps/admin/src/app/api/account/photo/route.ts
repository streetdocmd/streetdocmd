import { NextResponse } from "next/server";
import { createAdminSupabase, createServerSupabase } from "@/lib/supabase-server";
import { readImage, removeImage, saveImage } from "@/lib/images";

// POST /api/account/photo: any signed in admin or facility staff member sets
// their own profile photo (users.photo_url, avatars bucket). DELETE removes it.
async function currentUserId() {
  const { data: { user } } = await (await createServerSupabase()).auth.getUser();
  return user?.id ?? null;
}

export async function POST(req: Request) {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const img = await readImage(req);
  if ("error" in img) return NextResponse.json({ error: img.error }, { status: 400 });

  const admin = createAdminSupabase();
  const { data: before } = await admin.from("users").select("photo_url").eq("id", userId).maybeSingle();
  try {
    const url = await saveImage(admin, "avatars", `users/${userId}`, img.file);
    const { error } = await admin.from("users").update({ photo_url: url }).eq("id", userId);
    if (error) throw new Error(error.message);
    await removeImage(admin, "avatars", before?.photo_url);
    return NextResponse.json({ url });
  } catch {
    return NextResponse.json({ error: "Couldn't upload the picture. Please try again." }, { status: 500 });
  }
}

export async function DELETE() {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminSupabase();
  const { data: before } = await admin.from("users").select("photo_url").eq("id", userId).maybeSingle();
  await admin.from("users").update({ photo_url: null }).eq("id", userId);
  await removeImage(admin, "avatars", before?.photo_url);
  return NextResponse.json({ ok: true });
}
