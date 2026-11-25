import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase, createServerSupabase } from "@/lib/supabase-server";
import { requiredDocTypes } from "@/lib/onboarding";
import { PROVIDER_DOCS_BUCKET as BUCKET, PROVIDER_DOC_MAX_SIZE as MAX_SIZE, PROVIDER_DOC_TYPES as ALLOWED_TYPES, matchesSignature } from "@/lib/doc-files";

const err = (error: string, status: number) => NextResponse.json({ error }, { status });

// Two JSON steps, so the file itself never passes through this server
// (Vercel rejects request bodies over about 4.5 MB, which most phone
// photos of documents exceed). See lib/upload-document.ts for the client.
//   { action: "prepare", doc_type, size, mime } -> { path, token }, a
//     one-time signed upload URL inside this provider's folder
//   { action: "complete", doc_type, path }      -> checks the stored file
//     and records it
export async function POST(req: NextRequest) {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return err("Unauthorized", 401);

  const { data: provider } = await supabase
    .from("providers")
    .select("id, specialty, verification_status")
    .eq("user_id", user.id)
    .single();
  if (!provider) return err("Provider not found", 404);

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const docType = typeof body?.doc_type === "string" ? body.doc_type : null;
  if (!docType) return err("Missing doc_type", 400);
  // Only the documents this provider's specialty actually asks for — anything
  // else would also trip provider_documents_document_type_check.
  if (!requiredDocTypes(provider.specialty).includes(docType)) return err("Unexpected document type", 400);
  if (["verified", "under_review", "test"].includes(provider.verification_status)) {
    return err("Your documents are already with our team. Contact contact@streetdocmd.com to change them.", 409);
  }

  const admin = createAdminSupabase();

  if (body?.action === "prepare") {
    const size = Number(body.size);
    const mime = String(body.mime ?? "");
    if (!size) return err("This file is empty. Please choose another.", 400);
    if (size > MAX_SIZE) return err("File too large (max 10 MB)", 400);
    if (!ALLOWED_TYPES.includes(mime)) return err("Only PDF, JPG, or PNG files are allowed", 400);

    // Create bucket if it doesn't exist yet — private, since these are
    // credential documents (licences, degree certificates). Viewing a document
    // (e.g. from the admin review screen) requires generating a short-lived
    // signed URL on demand rather than linking to it directly.
    await admin.storage.createBucket(BUCKET, { public: false, fileSizeLimit: MAX_SIZE, allowedMimeTypes: ALLOWED_TYPES });

    const ext = mime === "application/pdf" ? "pdf" : mime === "image/png" ? "png" : "jpg";
    const { data, error } = await admin.storage.from(BUCKET).createSignedUploadUrl(`${provider.id}/${docType}_${Date.now()}.${ext}`);
    if (error || !data) return err("We couldn't start your upload. Please try again.", 500);
    return NextResponse.json({ path: data.path, token: data.token });
  }

  if (body?.action !== "complete") return err("Missing file", 400);

  const path = String(body.path ?? "");
  // Only a file this provider's own prepare step could have created
  if (!new RegExp(`^${provider.id}/${docType}_\\d+\\.(pdf|png|jpg)$`).test(path)) return err("Upload not recognised. Please try again.", 400);

  const { data: blob, error: dlErr } = await admin.storage.from(BUCKET).download(path);
  if (dlErr || !blob) return err("We couldn't find your upload. Please try again.", 400);
  const ext = path.split(".").pop();
  const mime = ext === "pdf" ? "application/pdf" : ext === "png" ? "image/png" : "image/jpeg";
  const head = new Uint8Array(await blob.slice(0, 8).arrayBuffer());
  if (blob.size === 0 || blob.size > MAX_SIZE || !matchesSignature(head, mime)) {
    await admin.storage.from(BUCKET).remove([path]);
    return err(blob.size > MAX_SIZE ? "File too large (max 10 MB)" : "This file doesn't look like a valid PDF, JPG or PNG. Please choose another.", 400);
  }

  // `file_url` stores the storage path (not a public URL) now that the
  // bucket is private — readers must exchange it for a signed URL.
  const { error: dbErr } = await admin.from("provider_documents").insert({
    provider_id: provider.id,
    document_type: docType,
    file_url: path,
  });

  if (dbErr) {
    await admin.storage.from(BUCKET).remove([path]);
    return err(dbErr.message, 500);
  }

  // Re-applying after a rejection is completed by /api/onboarding/submit
  // once every required document is in — not on the first upload, which
  // would put a half-finished application back into the review queue.

  return NextResponse.json({ ok: true });
}
