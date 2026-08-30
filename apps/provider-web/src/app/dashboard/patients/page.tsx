import { redirect } from "next/navigation";
import Link from "next/link";
import { createServerSupabase, createAdminSupabase } from "@/lib/supabase-server";
import { CARE_EPISODE_STATUS_LABELS } from "@streetdocmd/shared";

const STATUS_STYLES: Record<string, string> = {
  active: "bg-blue-100 text-blue-700",
  monitoring: "bg-teal-100 text-teal-700",
  follow_up_due: "bg-amber-100 text-amber-700",
  overdue: "bg-red-100 text-red-700",
  referred: "bg-purple-100 text-purple-700",
  resolved: "bg-green-100 text-green-700",
  closed: "bg-gray-100 text-gray-500",
  escalated: "bg-red-100 text-red-700",
};

export default async function MyPatientsPage() {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: provider } = await supabase.from("providers").select("id").eq("user_id", user.id).single();
  if (!provider) redirect("/dashboard");

  // Who is this provider authorized to see? Two independent routes to a
  // relationship: patients from bookings they've personally handled, and
  // patients on any care episode they're a team member of. Both queries run
  // through the caller's own RLS-scoped session — this is the
  // authorization check. `users` itself has no provider-read RLS policy at
  // all (pre-existing, not something Pass 2 changed), so patient identity
  // is read afterwards via the service-role client, the same workaround
  // the rest of this app already relies on for that.
  const [{ data: myBookings }, { data: myTeamMemberships }] = await Promise.all([
    supabase.from("bookings").select("patient_id, status, completed_at, created_at").eq("provider_id", provider.id).order("created_at", { ascending: false }),
    supabase.from("care_team_members").select("care_episode_id").eq("provider_id", provider.id).eq("active", true),
  ]);

  const admin = createAdminSupabase();

  const episodeIds = (myTeamMemberships ?? []).map(m => m.care_episode_id);
  let episodes: any[] = [];
  if (episodeIds.length > 0) {
    const { data } = await admin
      .from("care_episodes")
      .select("id, patient_id, title, status, updated_at")
      .in("id", episodeIds)
      .order("updated_at", { ascending: false });
    episodes = data ?? [];
  }

  // Merge: one row per patient, most recent episode (if any) + most recent booking
  const patientIds = new Set<string>();
  const lastBookingByPatient: Record<string, any> = {};
  for (const b of myBookings ?? []) {
    patientIds.add(b.patient_id);
    if (!lastBookingByPatient[b.patient_id]) lastBookingByPatient[b.patient_id] = b;
  }
  const episodeByPatient: Record<string, any> = {};
  for (const e of episodes) {
    patientIds.add(e.patient_id);
    if (!episodeByPatient[e.patient_id]) episodeByPatient[e.patient_id] = e;
  }

  let patientsById: Record<string, any> = {};
  if (patientIds.size > 0) {
    const { data: patientRows } = await admin.from("users").select("id, name, phone").in("id", Array.from(patientIds));
    for (const p of patientRows ?? []) patientsById[p.id] = p;
  }

  // Pending task counts per episode
  let taskCountByEpisode: Record<string, number> = {};
  if (episodeIds.length > 0) {
    const { data: tasks } = await admin.from("care_tasks").select("care_episode_id").in("care_episode_id", episodeIds).in("status", ["pending", "in_progress"]);
    for (const t of tasks ?? []) taskCountByEpisode[t.care_episode_id] = (taskCountByEpisode[t.care_episode_id] ?? 0) + 1;
  }

  const rows = Array.from(patientIds).map(id => ({
    patient: patientsById[id],
    episode: episodeByPatient[id] ?? null,
    lastBooking: lastBookingByPatient[id] ?? null,
    pendingTasks: episodeByPatient[id] ? (taskCountByEpisode[episodeByPatient[id].id] ?? 0) : 0,
  })).filter(r => r.patient);

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">My Patients</h1>

      {rows.length === 0 ? (
        <div className="card p-12 text-center">
          <p className="text-4xl mb-3">🧑‍🤝‍🧑</p>
          <p className="font-semibold text-gray-700">No patients yet</p>
          <p className="text-sm text-gray-400 mt-1">Patients you've treated will appear here.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map(({ patient, episode, lastBooking, pendingTasks }) => (
            <Link
              key={patient.id}
              href={`/dashboard/patients/${patient.id}`}
              className="card p-4 flex items-center justify-between gap-3 hover:shadow-card-md transition-shadow"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-full bg-teal-brand flex items-center justify-center text-white font-bold shrink-0">
                  {patient.name?.[0] ?? "?"}
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-gray-900 truncate">{patient.name ?? "Patient"}</p>
                  <p className="text-xs text-gray-400">
                    {lastBooking ? `Last visit ${new Date(lastBooking.created_at).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" })}` : "No completed visit yet"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {pendingTasks > 0 && (
                  <span className="badge bg-amber-100 text-amber-700">{pendingTasks} task{pendingTasks !== 1 ? "s" : ""}</span>
                )}
                {episode ? (
                  <span className={`badge ${STATUS_STYLES[episode.status] ?? ""}`}>
                    {CARE_EPISODE_STATUS_LABELS[episode.status as keyof typeof CARE_EPISODE_STATUS_LABELS] ?? episode.status}
                  </span>
                ) : (
                  <span className="badge bg-gray-100 text-gray-400">No active care episode</span>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
