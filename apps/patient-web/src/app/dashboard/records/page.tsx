import { createServerSupabase, createAdminSupabase } from "@/lib/supabase-server";
import { SERVICE_LABELS } from "@/lib/shared";
import RecordCard from "./RecordCard";

export default async function RecordsPage() {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: bookings } = await supabase
    .from("bookings")
    .select("id, service_type, completed_at, providers!bookings_provider_id_fkey(name)")
    .eq("patient_id", user.id)
    .eq("status", "completed")
    .order("completed_at", { ascending: false });

  const list = bookings ?? [];
  const bookingIds = list.map((b: any) => b.id);

  let visitsMap: Record<string, any> = {};
  let prescriptionsMap: Record<string, any> = {};
  let summariesMap: Record<string, any> = {};

  if (bookingIds.length > 0) {
    // Use admin client for sub-queries — ownership is already proven via bookingIds
    // (scoped to patient_id = user.id above), so bypassing RLS here is safe.
    const admin = createAdminSupabase();

    const { data: visits } = await admin
      .from("visits")
      .select("id, booking_id, diagnosis, treatment, follow_up_plan, prescription_url")
      .in("booking_id", bookingIds);

    for (const v of visits ?? []) visitsMap[v.booking_id] = v;

    const visitIds = (visits ?? []).map((v: any) => v.id);
    if (visitIds.length > 0) {
      const { data: prescriptions } = await admin
        .from("prescriptions")
        .select("id, visit_id, pdf_url, drugs")
        .in("visit_id", visitIds);
      for (const p of prescriptions ?? []) prescriptionsMap[p.visit_id] = p;
    }

    // A completed visit's summary can live under any of the three encounter
    // types (clinical_notes for doctors, nursing_encounters, or
    // physiotherapy_encounters) — visit_summaries is polymorphic across all
    // three, so each is looked up the same way and merged into one map.
    const SUMMARY_COLUMNS =
      "clinical_note_id, nursing_encounter_id, physiotherapy_encounter_id, " +
      "plain_diagnosis, reason_for_visit, what_was_done, " +
      "medications, investigations, recommendations, follow_up_date, abnormal_vitals";

    const [clinicalNotesResult, nursingEncountersResult, physioEncountersResult] = await Promise.all([
      admin.from("clinical_notes").select("id, booking_id").in("booking_id", bookingIds).eq("status", "submitted"),
      admin.from("nursing_encounters").select("id, booking_id").in("booking_id", bookingIds).eq("status", "submitted"),
      admin.from("physiotherapy_encounters").select("id, booking_id").in("booking_id", bookingIds).eq("status", "submitted"),
    ]);

    const encounterSources: { encounters: any[]; column: string }[] = [
      { encounters: clinicalNotesResult.data ?? [], column: "clinical_note_id" },
      { encounters: nursingEncountersResult.data ?? [], column: "nursing_encounter_id" },
      { encounters: physioEncountersResult.data ?? [], column: "physiotherapy_encounter_id" },
    ];

    for (const { encounters, column } of encounterSources) {
      const ids = encounters.map((e: any) => e.id);
      if (ids.length === 0) continue;

      const encounterToBooking = Object.fromEntries(encounters.map((e: any) => [e.id, e.booking_id]));

      const { data: summaries } = await (admin as any)
        .from("visit_summaries")
        .select(SUMMARY_COLUMNS)
        .in(column, ids)
        .eq("visible_to_patient", true);

      for (const s of summaries ?? []) {
        const bookingId = encounterToBooking[s[column]];
        if (bookingId) summariesMap[bookingId] = s;
      }
    }
  }

  const enriched = list.map((b: any) => {
    const visit = visitsMap[b.id] ?? null;
    if (visit) visit.prescription = prescriptionsMap[visit.id] ?? null;
    return { ...b, visit, summary: summariesMap[b.id] ?? null };
  });

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Medical Records</h1>

      {enriched.length === 0 ? (
        <div className="card p-12 text-center">
          <p className="text-4xl mb-4">�</p>
          <p className="font-semibold text-gray-700 text-lg">No records yet</p>
          <p className="text-gray-400 text-sm mt-1">
            Your visit records will appear here after completed visits.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {enriched.map((b: any) => (
            <RecordCard
              key={b.id}
              booking={b}
              serviceLabel={(SERVICE_LABELS as Record<string, string>)[b.service_type] ?? b.service_type}
            />
          ))}
        </div>
      )}
    </div>
  );
}

