import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase, createServerSupabase } from "@/lib/supabase-server";

const BUCKET = "provider-docs";
const MAX_SIZE = 10 * 1024 * 1024; // 10 MB
const ALLOWED_TYPES = ["application/pdf", "image/jpeg", "image/jpg", "image/png"];

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: provider } = await supabase
    .from("providers")
    .select("id")
    .eq("user_id", user.id)
    .single();
  if (!provider) return NextResponse.json({ error: "Provider not found" }, { status: 404 });

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const docType = formData.get("doc_type") as string | null;

  if (!file || !docType) return NextResponse.json({ error: "Missing file or doc_type" }, { status: 400 });
  if (file.size > MAX_SIZE) return NextResponse.json({ error: "File too large (max 10 MB)" }, { status: 400 });
  if (!ALLOWED_TYPES.includes(file.type)) return NextResponse.json({ error: "Only PDF, JPG, or PNG allowed" }, { status: 400 });

  const admin = createAdminSupabase();

  // Create bucket if it doesn't exist yet
  await admin.storage.createBucket(BUCKET, {
    public: true,
    fileSizeLimit: MAX_SIZE,
    allowedMimeTypes: ALLOWED_TYPES,
  });

  const ext = file.name.split(".").pop();
  const path = `${provider.id}/${docType}_${Date.now()}.${ext}`;
  const bytes = await file.arrayBuffer();

  const { error: uploadErr } = await admin.storage
    .from(BUCKET)
    .upload(path, bytes, { contentType: file.type, upsert: true });

  if (uploadErr) return NextResponse.json({ error: uploadErr.message }, { status: 500 });

  const { data: { publicUrl } } = admin.storage.from(BUCKET).getPublicUrl(path);

  const { error: dbErr } = await admin.from("provider_documents").insert({
    provider_id: provider.id,
    document_type: docType,
    file_url: publicUrl,
  });

  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 });

  return NextResponse.json({ url: publicUrl });
}