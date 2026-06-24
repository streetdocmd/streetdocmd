import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  // Strip non-ISO-8859-1 chars (e.g. BOM U+FEFF) that PowerShell can prepend when piping env vars via CLI
  const clean = (s: string) => s.replace(/[^\x00-\xFF]/g, "").trim();
  const url = clean(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "");
  const key = clean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "");
  return createBrowserClient(url, key, {
    global: { headers: { "X-Client-Info": "streetdocmd-admin/1.0" } },
  });
}