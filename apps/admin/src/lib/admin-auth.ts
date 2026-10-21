import { NextResponse } from "next/server";
import type { User } from "@supabase/supabase-js";
import { createAdminSupabase, createServerSupabase } from "@/lib/supabase-server";

export type AdminSession = {
  user: User | null;
  isAdmin: boolean;
  name: string | null;
};

/**
 * Resolves the signed-in user and whether they hold the `admin` role.
 * The role is read with the service-role client so it can't be hidden by RLS,
 * but only for the id Supabase Auth has already verified from the session.
 */
export async function getAdminSession(): Promise<AdminSession> {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { user: null, isAdmin: false, name: null };

  const { data: profile } = await createAdminSupabase()
    .from("users")
    .select("role, name")
    .eq("id", user.id)
    .maybeSingle();

  return {
    user,
    isAdmin: profile?.role === "admin",
    name: (profile?.name as string | undefined) ?? null,
  };
}

/**
 * Guard for admin-only API route handlers. Returns the admin user, or a
 * ready-made 401/403 response to return as-is.
 *
 *   const auth = await requireAdminApi();
 *   if ("response" in auth) return auth.response;
 */
export async function requireAdminApi(): Promise<{ user: User } | { response: NextResponse }> {
  const { user, isAdmin } = await getAdminSession();
  if (!user) {
    return { response: NextResponse.json({ error: "Your session has expired. Please sign in again." }, { status: 401 }) };
  }
  if (!isAdmin) {
    return { response: NextResponse.json({ error: "Your account does not have admin permissions to perform this action." }, { status: 403 }) };
  }
  return { user };
}
