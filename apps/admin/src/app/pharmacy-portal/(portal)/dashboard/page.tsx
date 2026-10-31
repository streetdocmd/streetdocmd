import { createAdminSupabase } from "@/lib/supabase-server";
import { requirePortalAccess } from "@/components/portal/access";
import PharmacyOrdersClient, { type PharmacyOrderRow } from "./PharmacyOrdersClient";

export const dynamic = "force-dynamic";

const STALE_INVENTORY_DAYS = 14;

export default async function PharmacyDashboard() {
  const access = await requirePortalAccess("pharmacy");
  const admin = createAdminSupabase();

  // Service-role read, always scoped to this staff member's pharmacy (admins see all)
  let q = admin
    .from("prescription_orders")
    .select("id, status, total_amount, commission_amount, payment_status, requires_review, created_at, drugs, requested_by, users!patient_id(name), providers(name)")
    .order("created_at", { ascending: false })
    .limit(300);
  if (access.partnerId) q = q.eq("pharmacy_partner_id", access.partnerId);
  const { data: orders, error } = await q;

  let inventoryNudge: { kind: "empty" | "stale"; days?: number } | null = null;
  if (access.partnerId) {
    const { data: catalogue } = await admin
      .from("drug_catalogue")
      .select("updated_at")
      .eq("pharmacy_partner_id", access.partnerId)
      .eq("active", true)
      .order("updated_at", { ascending: false })
      .limit(1);
    if (!catalogue || catalogue.length === 0) inventoryNudge = { kind: "empty" };
    else {
      const days = Math.floor((Date.now() - new Date(catalogue[0].updated_at).getTime()) / 86_400_000);
      if (days > STALE_INVENTORY_DAYS) inventoryNudge = { kind: "stale", days };
    }
  }

  const rows: PharmacyOrderRow[] = (orders ?? []).map((o: any) => ({
    id: o.id,
    status: o.status,
    // The item price, which is what the pharmacy is paid
    total_amount: Number(o.total_amount ?? 0) - Number(o.commission_amount ?? 0),
    requires_review: !!o.requires_review,
    created_at: o.created_at,
    drugs: Array.isArray(o.drugs) ? o.drugs.map((d: any) => d?.drug_name).filter(Boolean) : [],
    patient_name: o.users?.name ?? "Patient",
    source: o.requested_by === "patient" ? "Requested by patient" : `Dr ${o.providers?.name ?? "—"}`,
  }));

  return (
    <PharmacyOrdersClient
      orders={rows}
      loadError={error ? "We couldn't load your orders. Refresh the page, or contact support if this keeps happening." : null}
      partnerId={access.partnerId}
      inventoryNudge={inventoryNudge}
      facilityName={(access.partner?.name as string | undefined) ?? null}
    />
  );
}
