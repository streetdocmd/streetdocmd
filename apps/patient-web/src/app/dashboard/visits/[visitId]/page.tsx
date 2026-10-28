import { redirect, notFound } from "next/navigation";
import { createAdminSupabase, createServerSupabase } from "@/lib/supabase-server";
import VisitSummaryClient, { type VisitExtras } from "./VisitSummaryClient";

export default async function VisitSummaryPage({ params }: { params: { visitId: string } }) {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: summary } = await supabase
    .from("visit_summaries")
    .select("*")
    .eq("id", params.visitId)
    .eq("patient_id", user.id)
    .eq("visible_to_patient", true)
    .single();

  if (!summary) notFound();

  // Everything below belongs to this patient's visit (ownership checked above),
  // so the service role reads the related rows the design shows.
  const admin = createAdminSupabase();
  const source = summary.clinical_note_id
    ? { table: "clinical_notes", id: summary.clinical_note_id }
    : summary.nursing_encounter_id
      ? { table: "nursing_encounters", id: summary.nursing_encounter_id }
      : summary.physiotherapy_encounter_id
        ? { table: "physiotherapy_encounters", id: summary.physiotherapy_encounter_id }
        : null;
  const { data: note } = source
    ? await admin.from(source.table).select("booking_id").eq("id", source.id).maybeSingle()
    : { data: null };
  const bookingId: string | null = note?.booking_id ?? null;

  const [bookingRes, vitalsRes, referralsRes, reviewRes, orderRes] = await Promise.all([
    bookingId
      ? admin.from("bookings")
          .select("id, service_type, status, provider_id, providers!bookings_provider_id_fkey(name, specialty, photo_url, referral_code)")
          .eq("id", bookingId).eq("patient_id", user.id).maybeSingle()
      : Promise.resolve({ data: null }),
    summary.clinical_note_id
      ? admin.from("vitals")
          .select("bp_systolic, bp_diastolic, pulse_rate, temperature, temp_unit, spo2")
          .eq("clinical_note_id", summary.clinical_note_id).maybeSingle()
      : Promise.resolve({ data: null }),
    bookingId
      ? admin.from("hospital_referrals").select("id, status, reason, hospital_partners(name)").eq("booking_id", bookingId)
      : Promise.resolve({ data: [] }),
    bookingId
      ? admin.from("reviews").select("rating").eq("booking_id", bookingId).maybeSingle()
      : Promise.resolve({ data: null }),
    // Prescription orders link to the visit row, which links to the booking
    bookingId
      ? admin.from("visits").select("id").eq("booking_id", bookingId).limit(1).maybeSingle()
          .then(async ({ data: visit }) => visit
            ? admin.from("prescription_orders").select("id").eq("visit_id", visit.id).eq("patient_id", user.id).limit(1).maybeSingle()
            : { data: null })
      : Promise.resolve({ data: null }),
  ]);

  const booking = bookingRes.data as any;
  const provider = booking?.providers ?? null;
  const v = vitalsRes.data as any;
  const vitals: VisitExtras["vitals"] = v
    ? [
        v.bp_systolic && v.bp_diastolic ? { label: "Blood pressure", value: `${v.bp_systolic}/${v.bp_diastolic}`, unit: "mmHg" } : null,
        v.pulse_rate ? { label: "Pulse", value: String(v.pulse_rate), unit: "bpm" } : null,
        v.temperature ? { label: "Temperature", value: String(v.temperature), unit: v.temp_unit === "F" ? "°F" : "°C" } : null,
        v.spo2 ? { label: "Oxygen", value: String(v.spo2), unit: "%" } : null,
      ].filter(Boolean) as VisitExtras["vitals"]
    : [];

  const extras: VisitExtras = {
    bookingId,
    serviceType: booking?.service_type ?? null,
    providerId: booking?.provider_id ?? null,
    providerSpecialty: provider?.specialty ?? null,
    providerPhoto: provider?.photo_url ?? null,
    completed: booking ? booking.status === "completed" : true,
    vitals,
    referrals: ((referralsRes.data ?? []) as any[]).map(r => ({
      id: r.id, hospital: r.hospital_partners?.name ?? "Partner hospital", reason: r.reason ?? null, status: r.status,
    })),
    myRating: (reviewRes.data as any)?.rating ?? null,
    prescriptionOrderId: (orderRes.data as any)?.id ?? null,
    followUpHref: provider?.referral_code
      ? `/dashboard/book/preferred-provider?code=${encodeURIComponent(provider.referral_code)}`
      : booking?.service_type
        ? `/dashboard/book/${booking.service_type}`
        : "/dashboard",
    patientId: user.id,
  };

  return <VisitSummaryClient summary={summary} extras={extras} />;
}
