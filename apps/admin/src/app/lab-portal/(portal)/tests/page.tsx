import { createAdminSupabase } from "@/lib/supabase-server";
import { requirePortalAccess } from "@/components/portal/access";
import TestMenuClient, { type PlatformTest, type TestRow } from "./TestMenuClient";

export const dynamic = "force-dynamic";

export default async function LabTestMenuPage() {
  const access = await requirePortalAccess("lab");

  let tests: TestRow[] = [];
  let loadError: string | null = null;
  if (access.partnerId) {
    // Includes inactive rows, which catalogue RLS hides from lab staff
    const { data, error } = await createAdminSupabase()
      .from("investigation_catalogue")
      .select("*")
      .eq("lab_partner_id", access.partnerId)
      .order("test_name");
    tests = (data ?? []) as TestRow[];
    if (error) loadError = "We couldn't load your test menu. Refresh the page, or contact support if this keeps happening.";
  }

  const { data: platformTests } = await createAdminSupabase()
    .from("investigation_catalogue")
    .select("*")
    .eq("scope", "platform")
    .eq("active", true)
    .order("test_name");

  const mine = new Set(tests.map(t => t.platform_test_id));
  const requested = ((platformTests ?? []) as any[]).filter(p => p.requested_only && !mine.has(p.id)).map(p => p.test_name as string);

  return <TestMenuClient tests={tests} canEdit={!!access.partnerId} loadError={loadError} platformTests={(platformTests ?? []) as PlatformTest[]} requested={requested} />;
}
