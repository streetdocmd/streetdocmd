import { notFound } from "next/navigation";
import { createAdminSupabase } from "@/lib/supabase-server";
import { ownsRecord, requirePortalAccess } from "@/components/portal/access";
import { PRE_LAB_STATUSES } from "@/lib/investigation-status";
import OrderDetail from "./OrderDetail";

export const dynamic = "force-dynamic";

export default async function LabOrderPage({ params }: { params: { id: string } }) {
  const access = await requirePortalAccess("lab");
  const admin = createAdminSupabase();

  const { data: order } = await admin
    .from("investigation_orders")
    .select(`
      *,
      users!patient_id(id, name, phone, dob),
      providers(name, credentials),
      investigation_results(id, test_name, result_value, unit, reference_range, flag, result_pdf_url)
    `)
    .eq("id", params.id)
    .maybeSingle();

  // Another lab's order, or one the lab hasn't been asked about yet, looks
  // exactly like a missing one
  if (!order || !ownsRecord(access, order.lab_partner_id) || (PRE_LAB_STATUSES as string[]).includes(order.status)) notFound();

  const { data: events } = await admin
    .from("investigation_order_events")
    .select("to_status, actor_role, note, created_at")
    .eq("order_id", order.id)
    .order("created_at");

  // Contact details and the full address only once the lab has accepted
  const accepted = order.status !== "lab_requested";
  const patient = order.users as any;
  const safe = {
    ...order,
    users: accepted ? patient : { name: (patient?.name ?? "Patient").split(" ")[0], dob: patient?.dob ?? null },
    collection_address: accepted ? order.collection_address : null,
    contact_phone: accepted ? order.contact_phone : null,
  };

  return <OrderDetail order={safe} events={events ?? []} canAct={!!access.partnerId} />;
}
