import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

const clean = (s: string) => s.replace(/[^\x00-\xFF]/g, "").trim();

// Next keeps fetch responses for a year unless told otherwise, even on
// force-dynamic pages. Supabase data must always be live.
const liveFetch: typeof fetch = (input, init) => fetch(input, { ...init, cache: "no-store" });

export function createServerSupabase() {
  const cookieStore = cookies();
  return createServerClient(
    clean(process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""),
    clean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ""),
    {
      global: { fetch: liveFetch },
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Server Component context - cookie writes handled by middleware.
          }
        },
      },
    }
  );
}

export function createAdminSupabase() {
  return createServerClient(
    clean(process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""),
    clean(process.env.SUPABASE_SERVICE_ROLE_KEY ?? ""),
    { cookies: { getAll: () => [], setAll: () => {} }, global: { fetch: liveFetch } }
  );
}