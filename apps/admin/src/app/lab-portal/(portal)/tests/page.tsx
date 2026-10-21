import { createAdminSupabase } from "@/lib/supabase-server";
import { requirePortalAccess } from "@/components/portal/access";
import TestMenuClient, { type TestRow } from "./TestMenuClient";

export const dynamic = "force-dynamic";

export default async function LabTestMenuPage() {
  const access = await requirePortalAccess("lab");

  let tests: TestRow[] = [];
  let loadError: string | null = null;
  if (access.partnerId) {
    // Includes inactive rows, which catalogue RLS hides from lab staff
    const { data, error } = await createAdminSupabase()
      .from("investigation_catalogue")
      .select("id, test_name, test_code, price, turnaround_hours, sample_type, home_collection, active")
      .eq("lab_partner_id", access.partnerId)
      .order("test_name");
    tests = (data ?? []) as TestRow[];
    if (error) loadError = "We couldn't load your test menu. Refresh the page, or contact support if this keeps happening.";
  }

  return <TestMenuClient tests={tests} canEdit={!!access.partnerId} loadError={loadError} />;
}
