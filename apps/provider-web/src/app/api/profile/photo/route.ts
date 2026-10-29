import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase, createServerSupabase } from "@/lib/supabase-server";
import { readImage, removeImage, saveImage } from "@/lib/images";

// POST /api/profile/photo: the signed in provider sets the photo patients see
// (providers.photo_url, mirrored to users.photo_url; avatars bucket).
// DELETE removes it.
async function currentProvider() {
  const { data: { user } } = await (await createServerSupabase()).auth.getUser();
  if (!user) return null;
  const { data } = await createAdminSupabase().from("providers").select("id, user_id, photo_url").eq("user_id", user.id).maybeSingle();
  return data;
}

export async function POST(req: NextRequest) {
  const provider = await currentProvider();
  if (!provider) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const img = await readImage(req);
  if ("error" in img) return NextResponse.json({ error: img.error }, { status: 400 });

  const admin = createAdminSupabase();
  try {
    const url = await saveImage(admin, "avatars", `providers/${provider.id}`, img.file);
    const { error } = await admin.from("providers").update({ photo_url: url }).eq("id", provider.id);
    if (error) throw new Error(error.message);
    await admin.from("users").update({ photo_url: url }).eq("id", provider.user_id);
    await removeImage(admin, "avatars", provider.photo_url);
    return NextResponse.json({ url });
  } catch {
    return NextResponse.json({ error: "Couldn't upload the picture. Please try again." }, { status: 500 });
  }
}

export async function DELETE() {
  const provider = await currentProvider();
  if (!provider) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminSupabase();
  await admin.from("providers").update({ photo_url: null }).eq("id", provider.id);
  await admin.from("users").update({ photo_url: null }).eq("id", provider.user_id);
  await removeImage(admin, "avatars", provider.photo_url);
  return NextResponse.json({ ok: true });
}
