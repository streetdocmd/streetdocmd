// Server side of direct-to-storage uploads. Vercel rejects request bodies
// over about 4.5 MB, so files never pass through our API: a "prepare" call
// hands the browser a one-time signed upload URL for a path we choose, the
// browser uploads straight to Supabase Storage (lib/direct-upload-client.ts),
// and the final call checks what actually landed before using it.
import type { createAdminSupabase } from "@/lib/supabase-server";

type Admin = ReturnType<typeof createAdminSupabase>;

export const EXT_BY_MIME: Record<string, string> = {
  "application/pdf": "pdf", "image/jpeg": "jpg", "image/jpg": "jpg", "image/png": "png", "image/webp": "webp",
};
const MIME_BY_EXT: Record<string, string> = { pdf: "application/pdf", jpg: "image/jpeg", png: "image/png", webp: "image/webp" };

/** Checks a file's first bytes really are the type its name says. */
export function matchesSignature(b: Uint8Array, mime: string) {
  if (mime === "application/pdf") return b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46; // %PDF
  if (mime === "image/png") return b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47;
  if (mime === "image/webp") return b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50; // RIFF....WEBP
  return b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff; // JPEG
}

/** A one-time upload URL for `path`, or null if storage refused. */
export async function signUpload(admin: Admin, bucket: string, path: string) {
  const { data, error } = await admin.storage.from(bucket).createSignedUploadUrl(path);
  if (error || !data) {
    console.error(`direct upload: couldn't sign ${bucket}/${path}:`, error);
    return null;
  }
  return { path: data.path, token: data.token };
}

/**
 * Checks an uploaded file: the path must match `pattern` (a path only our
 * own prepare step could have produced), the file must exist, be within
 * `maxBytes`, and start with the right bytes for its extension. A file that
 * fails is deleted. Returns the error message to show, or null if it's fine.
 */
export async function verifyUpload(admin: Admin, bucket: string, path: string, pattern: RegExp, maxBytes: number): Promise<string | null> {
  if (!pattern.test(path)) return "Upload not recognised. Please try again.";
  const { data: blob, error } = await admin.storage.from(bucket).download(path);
  if (error || !blob) return "We couldn't find your upload. Please try again.";
  const mime = MIME_BY_EXT[path.split(".").pop() ?? ""] ?? "";
  const head = new Uint8Array(await blob.slice(0, 12).arrayBuffer());
  if (blob.size === 0 || blob.size > maxBytes || !matchesSignature(head, mime)) {
    await admin.storage.from(bucket).remove([path]);
    return blob.size > maxBytes
      ? `The file must be smaller than ${Math.round(maxBytes / 1024 / 1024)} MB.`
      : "This file doesn't look like a valid PDF or image. Please choose another.";
  }
  return null;
}
