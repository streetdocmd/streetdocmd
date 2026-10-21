import { notFound } from "next/navigation";
import { createAdminSupabase } from "@/lib/supabase-server";
import { ownsRecord, requirePortalAccess } from "@/components/portal/access";
import OrderDetail from "./OrderDetail";

export const dynamic = "force-dynamic";

export default async function LabOrderPage({ params }: { params: { id: string } }) {
  const access = await requirePortalAccess("lab");

  const { data: order } = await createAdminSupabase()
    .from("investigation_orders")
    .select(`
      id, status, ordered_at, resulted_at, tests, clinical_notes, lab_partner_id, requested_by,
      users!patient_id(id, name, phone),
      providers(name, credentials),
      investigation_results(id, test_name, result_value, unit, reference_range, flag, result_pdf_url)
    `)
    .eq("id", params.id)
    .maybeSingle();

  // Another lab's order looks exactly like a missing one
  if (!order || !ownsRecord(access, order.lab_partner_id)) notFound();

  return <OrderDetail order={order as any} />;
}
