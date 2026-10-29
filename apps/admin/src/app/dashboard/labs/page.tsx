export const dynamic = "force-dynamic";
import { createAdminSupabase } from "@/lib/supabase-server";
import { withStaffEmails } from "@/lib/auth-emails";
import LabsClient from "./LabsClient";
import ExceptionsQueue from "./ExceptionsQueue";
import { RESULT_STATUSES } from "@/lib/investigation-status";

export default async function LabsPage() {
  const admin = createAdminSupabase();

  const [{ data: orders }, { data: partners }, { data: staffRows }, { data: wellnessPackages }, { data: catalogue }] = await Promise.all([
    admin
      .from("investigation_orders")
      .select(`
        id, status, ordered_at, resulted_at, tests, payment_status, amount_paid, lab_price_total, collection_fee,
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
      .select("id, user_id, lab_partner_id, users(name, phone)")
      .order("created_at", { ascending: false }),
    admin
      .from("wellness_packages")
      .select("id, name, price, description, included_tests, sort_order, active")
      .order("sort_order"),
    admin
      .from("investigation_catalogue")
      .select("id, test_name, test_code, price, turnaround_hours, sample_type, active")
      .eq("scope", "platform")
      .order("test_name"),
  ]);

  // Revenue: StreetdocMD's service charge on paid orders, plus what's kept
  // when a fallback lab fulfils for less than the patient paid (migration 067)
  const resultedOrders = (orders ?? []).filter(o => (RESULT_STATUSES as string[]).includes(o.status));
  const commission = (orders ?? []).filter((o: any) => o.payment_status === "paid").reduce((sum, o: any) =>
    sum + Number(o.amount_paid ?? 0) - Number(o.lab_price_total ?? 0) - Number(o.collection_fee ?? 0), 0);

  // Operations queue: orders no lab could take
  const { data: exceptions } = await admin
    .from("investigation_orders")
    .select("id, exception_reason, updated_at, amount_paid, lab_attempts, collection_address, tests, users!patient_id(name, phone)")
    .eq("status", "exception")
    .order("updated_at", { ascending: true });

  const staffWithEmails = await withStaffEmails(admin, (staffRows ?? []) as { user_id: string; users: unknown }[]);

  return (
    <div className="space-y-8">
    <ExceptionsQueue orders={(exceptions ?? []) as any} />
    <LabsClient
      orders={(orders ?? []) as any}
      partners={(partners ?? []) as any}
      staff={staffWithEmails as any}
      wellnessPackages={(wellnessPackages ?? []) as any}
      catalogue={(catalogue ?? []) as any}
      stats={{ totalOrders: (orders ?? []).length, resulted: resultedOrders.length, commission }}
    />
    </div>
  );
}
