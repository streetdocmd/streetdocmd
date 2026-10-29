export const dynamic = "force-dynamic";
import { createAdminSupabase } from "@/lib/supabase-server";
import ReportsClient, { type ReportRequest } from "./ReportsClient";

// Medical report requests from patients and providers (migration 068).
// Nothing is released until an admin approves it.
export default async function ReportsPage() {
  const admin = createAdminSupabase();
  const { data } = await admin
    .from("care_report_requests")
    .select("id, care_episode_id, requester_role, reason, status, review_note, created_at, reviewed_at, requester:users!care_report_requests_requested_by_fkey(name), care_episodes(title, users!patient_id(name))")
    .order("created_at", { ascending: false })
    .limit(200);

  const rows: ReportRequest[] = ((data ?? []) as any[]).map(r => ({
    id: r.id,
    episodeId: r.care_episode_id,
    requester: r.requester?.name ?? "Unknown",
    role: r.requester_role,
    reason: r.reason,
    status: r.status,
    note: r.review_note,
    createdAt: r.created_at,
    journey: `${r.care_episodes?.users?.name ?? "Patient"} · ${r.care_episodes?.title ?? "Care journey"}`,
  }));
  return <ReportsClient requests={rows} />;
}
