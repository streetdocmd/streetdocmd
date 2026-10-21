import { createAdminSupabase } from "@/lib/supabase-server";
import { requirePortalAccess } from "@/components/portal/access";
import ReferralsClient, { type ReferralRow } from "./ReferralsClient";

export const dynamic = "force-dynamic";

const REVEALED = ["acknowledged", "in_progress", "completed"];

function ageFrom(dob: string | null | undefined) {
  if (!dob) return null;
  const d = new Date(dob);
  if (Number.isNaN(d.getTime())) return null;
  return Math.floor((Date.now() - d.getTime()) / (365.25 * 24 * 3600 * 1000));
}

export default async function HospitalPortalDashboard() {
  const access = await requirePortalAccess("hospital");
  const admin = createAdminSupabase();

  let q = admin
    .from("hospital_referrals")
    .select("id, status, urgency, reason, clinical_summary, referred_at, pdf_url, patient_id, providers(name)")
    .order("referred_at", { ascending: false })
    .limit(300);
  if (access.partnerId) q = q.eq("hospital_partner_id", access.partnerId);
  const { data, error } = await q;
  const referrals = (data ?? []) as any[];

  // Privacy rule: first name + age only until the hospital acknowledges the
  // referral. Applied here on the server, so nothing more reaches the browser.
  const patientIds = [...new Set(referrals.map(r => r.patient_id).filter(Boolean))];
  const patients = new Map<string, { name: string | null; dob: string | null; phone: string | null }>();
  if (patientIds.length > 0) {
    const { data: rows } = await admin.from("users").select("id, name, dob, phone").in("id", patientIds);
    for (const p of rows ?? []) patients.set(p.id, { name: p.name, dob: p.dob, phone: p.phone });
  }

  const rows: ReferralRow[] = referrals.map(r => {
    const p = patients.get(r.patient_id);
    const revealed = REVEALED.includes(r.status);
    const age = ageFrom(p?.dob);
    const name = revealed ? (p?.name ?? "Patient") : ((p?.name ?? "").split(" ")[0] || "Patient");
    return {
      id: r.id,
      status: r.status,
      urgency: r.urgency,
      reason: r.reason ?? null,
      referred_at: r.referred_at,
      pdf_url: r.pdf_url ?? null, // unchanged from before: the letter is needed to triage the referral
      clinical_summary: revealed ? r.clinical_summary ?? null : null,
      patient_label: age != null ? `${name}, ${age} yrs` : name,
      patient_phone: revealed ? p?.phone ?? null : null,
      referred_by: r.providers?.name ? `Dr ${r.providers.name}` : null,
      revealed,
    };
  });

  return (
    <ReferralsClient
      referrals={rows}
      partnerId={access.partnerId}
      facilityName={(access.partner?.name as string | undefined) ?? null}
      loadError={error ? "We couldn't load your referrals. Refresh the page, or contact support if this keeps happening." : null}
    />
  );
}
