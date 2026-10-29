import { createAdminSupabase } from "@/lib/supabase-server";
import { requirePortalAccess } from "@/components/portal/access";
import { PRE_LAB_STATUSES } from "@/lib/investigation-status";
import LabOrdersClient, { type LabOrderRow } from "./LabOrdersClient";

export const dynamic = "force-dynamic";

export default async function LabPortalDashboard() {
  const access = await requirePortalAccess("lab");
  const admin = createAdminSupabase();

  // Read with the service role, always scoped to this staff member's lab
  // (admins see every lab). Orders appear once the lab has been asked;
  // before payment they aren't the lab's business (migration 067).
  let q = admin
    .from("investigation_orders")
    .select("id, status, ordered_at, tests, requested_by, collection_method, lab_deadline, preferred_date, preferred_window, collection_scheduled_at, has_critical, users!patient_id(name), providers(name)")
    .not("status", "in", `(${PRE_LAB_STATUSES.join(",")})`)
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
    // First name only until the lab has accepted
    patient_name: o.status === "lab_requested" ? (o.users?.name ?? "Patient").split(" ")[0] : (o.users?.name ?? "Patient"),
    source: o.requested_by === "patient" ? "Patient request" : `Dr ${o.providers?.name ?? ""}`.trim(),
    doctor_collected: o.collection_method === "doctor",
    deadline: o.lab_deadline,
    preferred_date: o.preferred_date,
    preferred_window: o.preferred_window,
    scheduled_at: o.collection_scheduled_at,
    critical: !!o.has_critical,
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
