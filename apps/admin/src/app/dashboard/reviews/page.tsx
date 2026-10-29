export const dynamic = "force-dynamic";
import { createAdminSupabase } from "@/lib/supabase-server";
import ReviewsClient, { type AdminReview } from "./ReviewsClient";

const FACILITY_PARTNER: Record<string, string> = {
  pharmacy: "pharmacy_partners",
  lab: "lab_partners",
  hospital: "hospital_partners",
};

export default async function AdminReviewsPage() {
  const admin = createAdminSupabase();

  const [{ data: visit }, { data: facility }] = await Promise.all([
    admin.from("reviews")
      .select("*, users!patient_id(name), providers!provider_id(name)")
      .order("created_at", { ascending: false }).limit(300),
    admin.from("facility_reviews")
      .select("*, users!patient_id(name)")
      .order("created_at", { ascending: false }).limit(300),
  ]);

  // facility_reviews has no foreign key per facility type, so look the names up
  const names = new Map<string, string>();
  await Promise.all(Object.entries(FACILITY_PARTNER).map(async ([type, table]) => {
    const ids = Array.from(new Set(((facility ?? []) as any[]).filter(r => r.facility_type === type).map(r => r.facility_id)));
    if (!ids.length) return;
    const { data } = await admin.from(table).select("id, name").in("id", ids);
    for (const p of (data ?? []) as any[]) names.set(`${type}:${p.id}`, p.name);
  }));

  const reviews: AdminReview[] = [
    ...((visit ?? []) as any[]).map(r => ({
      id: r.id, kind: "provider" as const, subjectType: "Provider" as const, subject: r.providers?.name ?? "Provider",
      patient: r.users?.name ?? "Patient", rating: r.rating, comment: r.comment, reply: r.reply ?? null,
      hidden: !!r.hidden, hiddenReason: r.hidden_reason ?? null, createdAt: r.created_at,
    })),
    ...((facility ?? []) as any[]).map(r => ({
      id: r.id, kind: "facility" as const,
      subjectType: (r.facility_type === "lab" ? "Lab" : r.facility_type === "hospital" ? "Hospital" : "Pharmacy") as AdminReview["subjectType"],
      subject: names.get(`${r.facility_type}:${r.facility_id}`) ?? "Facility",
      patient: r.users?.name ?? "Patient", rating: r.rating, comment: r.comment, reply: r.reply ?? null,
      hidden: !!r.hidden, hiddenReason: r.hidden_reason ?? null, createdAt: r.created_at,
    })),
  ].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return <ReviewsClient reviews={reviews} />;
}
