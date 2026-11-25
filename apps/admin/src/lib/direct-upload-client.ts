"use client";
import { createClient } from "@/lib/supabase";

/** Some phones give picked files no type; fall back to the extension. */
export function mimeOf(file: File) {
  if (file.type) return file.type;
  const ext = file.name.split(".").pop()?.toLowerCase();
  return ext === "pdf" ? "application/pdf" : ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg";
}

/**
 * Uploads a file straight to Supabase Storage. `prepare` is our API call
 * that checks the request and returns a one-time signed upload URL
 * (see lib/direct-upload.ts). Returns the stored path to send to the final
 * API call, or the error to show.
 */
export async function uploadDirect(
  bucket: string,
  file: File,
  prepare: (info: { mime: string; size: number; file_name: string }) => Promise<Response | null>,
): Promise<{ path: string } | { error: string }> {
  try {
    const mime = mimeOf(file);
    const res = await prepare({ mime, size: file.size, file_name: file.name });
    const json = res ? await res.json().catch(() => ({})) : {};
    if (!res?.ok) return { error: json.error ?? "Couldn't start the upload. Please try again." };
    const { error } = await createClient().storage.from(bucket).uploadToSignedUrl(json.path, json.token, file, { contentType: mime });
    if (error) return { error: "The upload didn't finish. Check your connection and try again." };
    return { path: json.path as string };
  } catch {
    return { error: "The upload didn't finish. Check your connection and try again." };
  }
}
