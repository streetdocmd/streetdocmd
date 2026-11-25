import { createClient } from "@/lib/supabase";
import { PROVIDER_DOCS_BUCKET } from "@/lib/doc-files";


/** Some phones give picked files no type; fall back to the extension. */
function mimeOf(file: File) {
  if (file.type) return file.type;
  const ext = file.name.split(".").pop()?.toLowerCase();
  return ext === "pdf" ? "application/pdf" : ext === "png" ? "image/png" : "image/jpeg";
}

/**
 * Uploads one onboarding document. The file goes straight to storage through
 * a one-time signed URL from /api/upload-document, which then checks and
 * records it: sending it through the API would hit Vercel's ~4.5 MB limit.
 */
export async function uploadProviderDocument(file: File, docType: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const post = async (body: object) => {
    const res = await fetch("/api/upload-document", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    }).catch(() => null);
    const json = res ? await res.json().catch(() => ({})) : {};
    return { ok: !!res?.ok, json: json as Record<string, any> };
  };
  try {
    const mime = mimeOf(file);
    const prep = await post({ action: "prepare", doc_type: docType, size: file.size, mime });
    if (!prep.ok) return { ok: false, error: prep.json.error ?? "Upload failed. Please try again." };
    const { error } = await createClient().storage
      .from(PROVIDER_DOCS_BUCKET)
      .uploadToSignedUrl(prep.json.path, prep.json.token, file, { contentType: mime });
    if (error) return { ok: false, error: "Upload failed. Check your connection and try again." };
    const done = await post({ action: "complete", doc_type: docType, path: prep.json.path });
    if (!done.ok) return { ok: false, error: done.json.error ?? "Upload failed. Please try again." };
    return { ok: true };
  } catch {
    return { ok: false, error: "Upload failed. Check your connection and try again." };
  }
}
