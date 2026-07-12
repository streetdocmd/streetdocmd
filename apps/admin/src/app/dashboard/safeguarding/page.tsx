export const dynamic = "force-dynamic";
import { createAdminSupabase } from "@/lib/supabase-server";
import SafeguardingClient from "./SafeguardingClient";

export default async function SafeguardingPage() {
  const admin = createAdminSupabase();

  const { data: alerts } = await admin
    .from("safeguarding_alerts")
    .select(`
      id, resolved, resolved_at, resolved_by, created_at,
      clinical_notes!clinical_note_id(id, booking_id),
      users!patient_id(id, name, phone, date_of_birth),
      providers!provider_id(id, name)
    `)
    .order("created_at", { ascending: false });

  const unresolvedCount = (alerts ?? []).filter(a => !a.resolved).length;

  return <SafeguardingClient alerts={(alerts ?? []) as any} unresolvedCount={unresolvedCount} />;
}
