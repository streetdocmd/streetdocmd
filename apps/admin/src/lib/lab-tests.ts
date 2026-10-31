import type { createAdminSupabase } from "@/lib/supabase-server";

type Admin = ReturnType<typeof createAdminSupabase>;

// The test's name is what matches it to orders: it finds the shared test with
// that name or alias, or adds a new one (migrations 073 and 074).
// sameAs: the lab confirmed its test is one already on the list, under another
// name. That name is remembered, so the next lab using it is matched directly.
export async function sharedTestId(admin: Admin, name: string, sameAs?: unknown): Promise<string | null> {
  if (typeof sameAs === "string" && sameAs) {
    const { data: test } = await admin.from("investigation_catalogue").select("id").eq("id", sameAs).eq("scope", "platform").maybeSingle();
    if (test) {
      await admin.rpc("investigation_add_alias", { p_test: test.id, p_alias: name, p_source: "lab" });
      return test.id;
    }
  }
  const { data, error } = await admin.rpc("investigation_platform_test", { p_name: name });
  return error ? null : (data as string | null);
}

export interface TestMatch { id: string; test_name: string; matched: string; exact: boolean }

/** Shared tests whose name, or another name for them, is close to this one, best first */
export async function matchTests(admin: Admin, name: string, limit = 5): Promise<TestMatch[]> {
  const { data } = await admin.rpc("investigation_match_tests_ranked", { p_query: name, p_limit: limit });
  return ((data ?? []) as any[]).map(m => ({ id: m.id, test_name: m.test_name, matched: m.matched, exact: Number(m.score) >= 1 }));
}
