import { createAdminSupabase } from "@/lib/supabase-server";
import { requirePortalAccess } from "@/components/portal/access";
import LabOrdersClient, { type LabOrderRow } from "./LabOrdersClient";

export const dynamic = "force-dynamic";

export default async function LabPortalDashboard() {
  const access = await requirePortalAccess("lab");
  const admin = createAdminSupabase();

  // Read with the service role, always scoped to this staff member's lab
  // (admins see every lab). Patient names aren't readable by lab staff under
  // users RLS, which is why this isn't a browser query.
  let q = admin
    .from("investigation_orders")
    .select("id, status, ordered_at, tests, clinical_notes, requested_by, users!patient_id(name), providers(name)")
    .order("ordered_at", { ascending: false })
    .limit(300);
  if (access.partnerId) q = q.eq("lab_partner_id", access.partnerId);

  const [{ data: orders, error }, testCount] = await Promise.all([
    q,
    access.partnerId
      ? admin.from("investigation_catalogue").select("id", { count: "exact", head: true })
          .eq("lab_partner_id", access.partnerId).eq("active", true).then(r => r.count ?? 0)
      : Promise.resolve(null),
  ]);

  const rows: LabOrderRow[] = (orders ?? []).map((o: any) => ({
    id: o.id,
    status: o.status,
    ordered_at: o.ordered_at,
    tests: Array.isArray(o.tests) ? o.tests.map((t: any) => t?.test_name).filter(Boolean) : [],
    clinical_notes: o.clinical_notes ?? null,
    patient_name: o.users?.name ?? "Patient",
    source: o.requested_by === "patient" ? "Requested by patient" : `Dr ${o.providers?.name ?? "—"}`,
  }));

  return (
    <LabOrdersClient
      orders={rows}
      loadError={error ? "We couldn't load your orders. Refresh the page, or contact support if this keeps happening." : null}
      partnerId={access.partnerId}
      activeTestCount={testCount}
      facilityName={(access.partner?.name as string | undefined) ?? null}
    />
  );
}
