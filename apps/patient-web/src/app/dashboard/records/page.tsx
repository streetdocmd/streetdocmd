import { createServerSupabase } from "@/lib/supabase-server";
import { SERVICE_LABELS } from "@streetdocmd/shared";
import RecordCard from "./RecordCard";

export default async function RecordsPage() {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: bookings } = await supabase
    .from("bookings")
    .select("id, service_type, completed_at, providers(name)")
    .eq("patient_id", user.id)
    .eq("status", "completed")
    .order("completed_at", { ascending: false });

  const list = bookings ?? [];
  const bookingIds = list.map((b: any) => b.id);

  let visitsMap: Record<string, any> = {};
  let prescriptionsMap: Record<string, any> = {};
  let summariesMap: Record<string, any> = {};

  if (bookingIds.length > 0) {
    // Old path: visits table (created by complete-visit API)
    const { data: visits } = await supabase
      .from("visits")
      .select("id, booking_id, diagnosis, treatment, follow_up_plan, prescription_url")
      .in("booking_id", bookingIds);

    for (const v of visits ?? []) visitsMap[v.booking_id] = v;

    const visitIds = (visits ?? []).map((v: any) => v.id);
    if (visitIds.length > 0) {
      const { data: prescriptions } = await supabase
        .from("prescriptions")
        .select("id, visit_id, pdf_url, drugs")
        .in("visit_id", visitIds);
      for (const p of prescriptions ?? []) prescriptionsMap[p.visit_id] = p;
    }

    // New path: visit_summaries generated from submitted clinical notes.
    // Bridge through clinical_notes to get booking_id → summary.
    const { data: clinicalNotes } = await supabase
      .from("clinical_notes")
      .select("id, booking_id")
      .in("booking_id", bookingIds)
      .eq("status", "submitted");

    const noteIds = (clinicalNotes ?? []).map((cn: any) => cn.id);
    const noteToBooking = Object.fromEntries(
      (clinicalNotes ?? []).map((cn: any) => [cn.id, cn.booking_id])
    );

    if (noteIds.length > 0) {
      const { data: summaries } = await supabase
        .from("visit_summaries")
        .select(
          "clinical_note_id, plain_diagnosis, reason_for_visit, what_was_done, " +
          "medications, investigations, recommendations, follow_up_date, abnormal_vitals"
        )
        .in("clinical_note_id", noteIds)
        .eq("visible_to_patient", true);

      for (const s of summaries ?? []) {
        const bookingId = noteToBooking[s.clinical_note_id];
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
          <p className="text-4xl mb-4">📁</p>
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
