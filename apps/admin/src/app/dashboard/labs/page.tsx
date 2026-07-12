export const dynamic = "force-dynamic";
import { createAdminSupabase } from "@/lib/supabase-server";
import LabsClient from "./LabsClient";

export default async function LabsPage() {
  const admin = createAdminSupabase();

  const [{ data: orders }, { data: partners }, { data: staffRows }] = await Promise.all([
    admin
      .from("investigation_orders")
      .select(`
        id, status, ordered_at, resulted_at, tests,
        users!patient_id(name),
        providers(name),
        lab_partners(name)
      `)
      .order("ordered_at", { ascending: false })
      .limit(100),
    admin
      .from("lab_partners")
      .select("id, name, address, phone, email, active, home_collection_available, lat, lng")
      .order("name"),
    admin
      .from("lab_staff")
      .select("id, user_id, lab_partner_id, users(name, email, phone)")
      .order("created_at", { ascending: false }),
  ]);

  // Revenue report: 15% commission on all resulted orders
  const resultedOrders = (orders ?? []).filter(o => o.status === "resulted");
  const totalRevenue = resultedOrders.reduce((sum, o) => {
    const testTotal = (o.tests as any[])?.reduce((s: number, t: any) => s + (t.price ?? 0), 0) ?? 0;
    return sum + testTotal;
  }, 0);
  const commission = totalRevenue * 0.15;

  return (
    <LabsClient
      orders={(orders ?? []) as any}
      partners={(partners ?? []) as any}
      staff={(staffRows ?? []) as any}
      stats={{ totalOrders: (orders ?? []).length, resulted: resultedOrders.length, commission }}
    />
  );
}
