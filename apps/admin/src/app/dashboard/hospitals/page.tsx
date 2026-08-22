export const dynamic = "force-dynamic";
import { createAdminSupabase } from "@/lib/supabase-server";
import HospitalsClient from "./HospitalsClient";

export default async function HospitalsPage() {
  const admin = createAdminSupabase();

  const [{ data: referrals }, { data: partners }, { data: affiliatedProviders }] = await Promise.all([
    admin
      .from("hospital_referrals")
      .select(`
        id, status, urgency, reason, referred_at, pdf_url,
        users!patient_id(name),
        providers(name),
        hospital_partners(name)
      `)
      .order("referred_at", { ascending: false })
      .limit(200),
    admin
      .from("hospital_partners")
      .select("id, name, address, phone, email, hospital_level, emergency_available, ambulance_available, bed_count, specialties, active, lat, lng")
      .order("name"),
    admin
      .from("providers")
      .select("id, name, specialty, license_body, license_number, verification_status, hospital_partner_id, hospital_partners(name)")
      .not("hospital_partner_id", "is", null)
      .order("name"),
  ]);

  const totalReferrals    = (referrals ?? []).length;
  const pendingCount      = (referrals ?? []).filter(r => r.status === "pending").length;
  const inProgressCount   = (referrals ?? []).filter(r => ["acknowledged", "in_progress"].includes(r.status)).length;
  const completedCount    = (referrals ?? []).filter(r => r.status === "completed").length;
  const emergencyCount    = (referrals ?? []).filter(r => r.urgency === "emergency").length;

  return (
    <HospitalsClient
      referrals={(referrals ?? []) as any}
      partners={(partners ?? []) as any}
      affiliatedProviders={(affiliatedProviders ?? []) as any}
      stats={{ totalReferrals, pendingCount, inProgressCount, completedCount, emergencyCount }}
    />
  );
}
