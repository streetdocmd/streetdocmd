"use client";
import { createBrowserClient } from "@supabase/ssr";

const clean = (s: string) => s.replace(/[^\x00-\xFF]/g, "").trim();

export function createClient() {
  return createBrowserClient(
    clean(process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""),
    clean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ""),
    { global: { headers: { "X-Client-Info": "streetdocmd-provider-web/1.0" } } }
  );
}