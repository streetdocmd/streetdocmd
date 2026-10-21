export const dynamic = "force-dynamic";
import { redirect } from "next/navigation";
import { createServerSupabase, createAdminSupabase } from "@/lib/supabase-server";
import OrderDetail from "./OrderDetail";

export default async function LabOrderPage({ params }: { params: { id: string } }) {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/lab-portal/login");

  const { data: profile } = await supabase.from("users").select("role").eq("id", user.id).single();
  if (!profile || !["lab_staff", "admin"].includes(profile.role)) redirect("/lab-portal");

  const admin = createAdminSupabase();

  const { data: order } = await admin
    .from("investigation_orders")
    .select(`
      id, status, ordered_at, resulted_at, tests, clinical_notes, lab_partner_id,
      users!patient_id(id, name, phone),
      providers(name, credentials),
      investigation_results(id, test_name, result_value, unit, reference_range, flag, result_pdf_url)
    `)
    .eq("id", params.id)
    .single();

  if (!order) redirect("/lab-portal/dashboard");

  return <OrderDetail order={order as any} />;
}
