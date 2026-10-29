// Server side of picture uploads (migration 066). Callers check who owns the
// record first; this validates the file and stores it with the service role.
import type { SupabaseClient } from "@supabase/supabase-js";

const TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
const MAX_BYTES = 2 * 1024 * 1024;

export type ImageBucket = "avatars" | "product-images";

/** Reads the "file" field of a multipart request; an error message when it isn't a usable image */
export async function readImage(req: Request): Promise<{ file: File } | { error: string }> {
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return { error: "Choose a picture to upload." };
  if (!TYPES[file.type]) return { error: "Use a JPG, PNG or WebP picture." };
  if (file.size > MAX_BYTES) return { error: "That picture is too large. Use one under 2 MB." };
  return { file };
}

/** Stores the picture at `${folder}/...` and returns its public URL */
export async function saveImage(admin: SupabaseClient, bucket: ImageBucket, folder: string, file: File) {
  const path = `${folder}/${Date.now()}.${TYPES[file.type]}`;
  const { error } = await admin.storage.from(bucket).upload(path, file, { contentType: file.type, upsert: false });
  if (error) throw new Error(error.message);
  return admin.storage.from(bucket).getPublicUrl(path).data.publicUrl;
}

/** Removes a picture this app stored earlier; ignores other URLs */
export async function removeImage(admin: SupabaseClient, bucket: ImageBucket, url: string | null | undefined) {
  const marker = `/storage/v1/object/public/${bucket}/`;
  const i = url?.indexOf(marker) ?? -1;
  if (!url || i < 0) return;
  await admin.storage.from(bucket).remove([url.slice(i + marker.length)]);
}
