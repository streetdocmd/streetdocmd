export const dynamic = "force-dynamic";
import { redirect } from "next/navigation";
import { createServerSupabase, createAdminSupabase } from "@/lib/supabase-server";
import PharmacyOrderActions from "./PharmacyOrderActions";

export default async function PharmacyOrderPage({ params }: { params: { id: string } }) {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/pharmacy-portal/login");

  const { data: profile } = await supabase.from("users").select("role").eq("id", user.id).single();
  if (!profile || !["pharmacy_staff", "admin"].includes(profile.role)) redirect("/pharmacy-portal");

  const admin = createAdminSupabase();
  const { data: order } = await admin
    .from("prescription_orders")
    .select(`
      id, status, total_amount, commission_amount, payment_status,
      prescription_pdf_url, drugs, requires_review, created_at,
      users!patient_id(id, name, phone),
      providers(name, credentials, specialty),
      pharmacy_partners(name, phone),
      delivery_tracking(id, rider_name, rider_phone, dispatched_at, estimated_arrival, delivered_at, proof_of_delivery_url)
    `)
    .eq("id", params.id)
    .single();

  if (!order) redirect("/pharmacy-portal/dashboard");
  return <PharmacyOrderActions order={order as any} />;
}
