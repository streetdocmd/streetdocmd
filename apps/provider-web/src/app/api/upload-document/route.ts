import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase, createServerSupabase } from "@/lib/supabase-server";
import { requiredDocTypes } from "@/lib/onboarding";

const BUCKET = "provider-docs";
const MAX_SIZE = 10 * 1024 * 1024; // 10 MB
const ALLOWED_TYPES = ["application/pdf", "image/jpeg", "image/jpg", "image/png"];

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: provider } = await supabase
    .from("providers")
    .select("id, specialty, verification_status")
    .eq("user_id", user.id)
    .single();
  if (!provider) return NextResponse.json({ error: "Provider not found" }, { status: 404 });

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const docType = formData.get("doc_type") as string | null;

  if (!file || !docType) return NextResponse.json({ error: "Missing file or doc_type" }, { status: 400 });
  if (file.size > MAX_SIZE) return NextResponse.json({ error: "File too large (max 10 MB)" }, { status: 400 });
  if (!ALLOWED_TYPES.includes(file.type)) return NextResponse.json({ error: "Only PDF, JPG, or PNG files are allowed" }, { status: 400 });
  if (file.size === 0) return NextResponse.json({ error: "This file is empty. Please choose another." }, { status: 400 });
  // Only the documents this provider's specialty actually asks for — anything
  // else would also trip provider_documents_document_type_check.
  if (!requiredDocTypes(provider.specialty).includes(docType)) {
    return NextResponse.json({ error: "Unexpected document type" }, { status: 400 });
  }
  if (provider.verification_status === "verified" || provider.verification_status === "under_review") {
    return NextResponse.json({ error: "Your documents are already with our team. Contact contact@streetdocmd.com to change them." }, { status: 409 });
  }

  const admin = createAdminSupabase();

  // Create bucket if it doesn't exist yet — private, since these are
  // credential documents (licences, degree certificates). Viewing a document
  // (e.g. from the admin review screen) requires generating a short-lived
  // signed URL on demand rather than linking to it directly.
  await admin.storage.createBucket(BUCKET, {
    public: false,
    fileSizeLimit: MAX_SIZE,
    allowedMimeTypes: ALLOWED_TYPES,
  });

  const ext = file.type === "application/pdf" ? "pdf" : file.type === "image/png" ? "png" : "jpg";
  const path = `${provider.id}/${docType}_${Date.now()}.${ext}`;
  const bytes = await file.arrayBuffer();

  const { error: uploadErr } = await admin.storage
    .from(BUCKET)
    .upload(path, bytes, { contentType: file.type, upsert: true });

  if (uploadErr) return NextResponse.json({ error: uploadErr.message }, { status: 500 });

  // `file_url` stores the storage path (not a public URL) now that the
  // bucket is private — readers must exchange it for a signed URL.
  const { error: dbErr } = await admin.from("provider_documents").insert({
    provider_id: provider.id,
    document_type: docType,
    file_url: path,
  });

  if (dbErr) {
    await admin.storage.from(BUCKET).remove([path]);
    return NextResponse.json({ error: dbErr.message }, { status: 500 });
  }

  // Re-applying after a rejection is completed by /api/onboarding/submit
  // once every required document is in — not on the first upload, which
  // would put a half-finished application back into the review queue.

  return NextResponse.json({ ok: true });
}