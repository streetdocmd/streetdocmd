import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

const clean = (s: string) => s.replace(/[^\x00-\xFF]/g, "").trim();

export async function createServerSupabase() {
  const cookieStore = await cookies();
  return createServerClient(
    clean(process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""),
    clean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ""),
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(cookiesToSet) {
          try { cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options)); } catch {}
        },
      },
    }
  );
}

export function createAdminSupabase() {
  return createServerClient(
    clean(process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""),
    clean(process.env.SUPABASE_SERVICE_ROLE_KEY ?? ""),
    { cookies: { getAll: () => [], setAll: () => {} } }
  );
}
/**
 * Supabase client + signed-in user for an API route, for both clients:
 * the web app (session cookie) and the patient mobile app, which sends its
 * access token as `Authorization: Bearer <jwt>`. Queries on the returned
 * client run as that user, so RLS applies exactly as it does on the web.
 */
export async function getRequestSupabase(req: Request) {
  const auth = req.headers.get("authorization") ?? "";
  const token = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : "";
  if (!token) {
    const supabase = await createServerSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    return { supabase, user };
  }
  const supabase = createServerClient(
    clean(process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""),
    clean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ""),
    {
      cookies: { getAll: () => [], setAll: () => {} },
      global: { headers: { Authorization: `Bearer ${token}` } },
    }
  );
  const { data: { user } } = await supabase.auth.getUser(token);
  return { supabase, user };
}
