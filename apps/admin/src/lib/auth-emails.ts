import type { createAdminSupabase } from "@/lib/supabase-server";

/**
 * Looks up login emails from Supabase Auth for a set of user ids. Used instead
 * of selecting users.email, which isn't guaranteed to exist in the live schema
 * (a missing column makes the whole PostgREST query fail).
 */
export async function getAuthEmails(
  admin: ReturnType<typeof createAdminSupabase>,
  userIds: (string | null | undefined)[]
): Promise<Map<string, string>> {
  const ids = Array.from(new Set(userIds.filter((id): id is string => !!id)));
  const entries = await Promise.all(
    ids.map(async (id) => {
      const { data } = await admin.auth.admin.getUserById(id).catch(() => ({ data: { user: null } }));
      return [id, data.user?.email ?? ""] as const;
    })
  );
  return new Map(entries.filter(([, email]) => !!email));
}

/** Adds `users.email` (from Auth) onto staff rows shaped `{ user_id, users: { name, phone } }`. */
export async function withStaffEmails<T extends { user_id: string; users: unknown }>(
  admin: ReturnType<typeof createAdminSupabase>,
  rows: T[]
): Promise<T[]> {
  const emails = await getAuthEmails(admin, rows.map((r) => r.user_id));
  return rows.map((r) => {
    const u = (Array.isArray(r.users) ? r.users[0] : r.users) as Record<string, unknown> | null;
    return { ...r, users: { ...(u ?? {}), email: emails.get(r.user_id) ?? null } };
  });
}
