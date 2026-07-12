export const dynamic = "force-dynamic";
import { createAdminSupabase } from "@/lib/supabase-server";
import PharmacyClient from "./PharmacyClient";

export default async function PharmacyPage() {
  const admin = createAdminSupabase();

  const [{ data: orders }, { data: partners }, { data: staffRows }] = await Promise.all([
    admin
      .from("prescription_orders")
      .select(`
        id, status, total_amount, commission_amount, payment_status,
        requires_review, created_at, drugs,
        users!patient_id(name, phone),
        providers(name),
        pharmacy_partners(name)
      `)
      .order("created_at", { ascending: false })
      .limit(200),
    admin
      .from("pharmacy_partners")
      .select("id, name, phone, email, address, active, created_at")
      .order("created_at", { ascending: false }),
    admin
      .from("pharmacy_staff")
      .select("id, user_id, pharmacy_partner_id, users(name, email, phone)")
      .order("created_at", { ascending: false }),
  ]);

  const totalCommission = (orders ?? []).reduce((sum, o) => sum + (o.commission_amount ?? 0), 0);
  const totalRevenue    = (orders ?? []).reduce((sum, o) => sum + (o.total_amount ?? 0), 0);
  const deliveredCount  = (orders ?? []).filter(o => o.status === "delivered").length;
  const flaggedCount    = (orders ?? []).filter(o => o.requires_review).length;

  return (
    <PharmacyClient
      orders={orders ?? []}
      partners={partners ?? []}
      staff={(staffRows ?? []) as any}
      stats={{ totalCommission, totalRevenue, deliveredCount, flaggedCount }}
    />
  );
}
