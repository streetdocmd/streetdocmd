import { redirect } from "next/navigation";
import { createServerSupabase, createAdminSupabase } from "@/lib/supabase-server";
import { SERVICE_LABELS } from "@streetdocmd/shared";
import PatientCareClient from "./PatientCareClient";

export default async function PatientCarePage({
  params, searchParams,
}: {
  params: { patientId: string };
  searchParams: { booking?: string };
}) {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: provider } = await supabase.from("providers").select("id, profession").eq("user_id", user.id).single();
  if (!provider) redirect("/dashboard");

  // Authorization check, via the caller's own RLS-scoped session: this
  // provider must have actually treated this patient, or be on a care
  // team for one of their episodes. Only after this passes do we switch
  // to the service-role client to read cross-referenced data — same
  // pattern as the list page.
  const [{ data: sharedBooking }, { data: myTeamEpisodeIds }] = await Promise.all([
    supabase.from("bookings").select("id").eq("provider_id", provider.id).eq("patient_id", params.patientId).limit(1),
    supabase.from("care_team_members").select("care_episode_id").eq("provider_id", provider.id).eq("active", true),
  ]);

  const admin = createAdminSupabase();

  let sharedEpisode = false;
  if ((myTeamEpisodeIds ?? []).length > 0) {
    const { count } = await admin
      .from("care_episodes")
      .select("id", { count: "exact", head: true })
      .eq("patient_id", params.patientId)
      .in("id", myTeamEpisodeIds!.map(m => m.care_episode_id));
    sharedEpisode = (count ?? 0) > 0;
  }

  if (!(sharedBooking && sharedBooking.length > 0) && !sharedEpisode) {
    redirect("/dashboard/patients");
  }

  const { data: patient } = await admin.from("users").select("id, name, phone, dob, gender").eq("id", params.patientId).single();
  if (!patient) redirect("/dashboard/patients");

  // If we arrived here from an active booking ("view care context before
  // you start"), validate it's actually this provider+patient's booking
  // before trusting it for anything (e.g. linking it to a new episode).
  let contextBooking: { id: string; care_episode_id: string | null } | null = null;
  if (searchParams.booking) {
    const { data } = await supabase
      .from("bookings")
      .select("id, care_episode_id")
      .eq("id", searchParams.booking)
      .eq("provider_id", provider.id)
      .eq("patient_id", params.patientId)
      .maybeSingle();
    contextBooking = data ?? null;
  }

  const { data: episodes } = await admin
    .from("care_episodes")
    .select("*")
    .eq("patient_id", params.patientId)
    .order("updated_at", { ascending: false });

  const episodeList = episodes ?? [];
  const activeEpisode = episodeList.find(e => e.status !== "closed" && e.status !== "resolved") ?? episodeList[0] ?? null;

  let team: any[] = [];
  let plan: any = null;
  let tasks: any[] = [];
  let recentBookings: any[] = [];
  let pendingFollowUp: any = null;
  let lastEncounter: any = null;
  let diagnoses: any[] = [];
  let labs: any[] = [];

  if (activeEpisode) {
    const [{ data: teamRows }, { data: planRow }, { data: taskRows }, { data: bookingRows }, { data: followUpRows }] = await Promise.all([
      admin.from("care_team_members").select("id, provider_id, is_lead, active, joined_at").eq("care_episode_id", activeEpisode.id).eq("active", true),
      admin.from("care_plans").select("*").eq("care_episode_id", activeEpisode.id).maybeSingle(),
      admin.from("care_tasks").select("*").eq("care_episode_id", activeEpisode.id).order("due_date", { ascending: true, nullsFirst: false }),
      admin.from("bookings").select("id, service_type, profession, status, completed_at, created_at").eq("care_episode_id", activeEpisode.id).order("created_at", { ascending: false }),
      // 'scheduled' = planned but not yet booked; 'booked' = the patient
      // has booked it — the provider is now about to conduct exactly this
      // encounter, which is precisely when this context matters most.
      admin.from("follow_ups").select("id, reason, follow_up_date, follow_up_type, status").eq("care_episode_id", activeEpisode.id).in("status", ["scheduled", "booked"]).order("follow_up_date", { ascending: true }).limit(1),
    ]);

    const providerIds = (teamRows ?? []).map(t => t.provider_id);
    let providersById: Record<string, any> = {};
    if (providerIds.length > 0) {
      const { data: providerRows } = await admin.from("providers").select("id, name, profession, specialty, available").in("id", providerIds);
      for (const p of providerRows ?? []) providersById[p.id] = p;
    }

    team = (teamRows ?? []).map(t => ({ ...t, provider: providersById[t.provider_id] }));
    plan = planRow;
    tasks = taskRows ?? [];
    recentBookings = bookingRows ?? [];
    pendingFollowUp = followUpRows?.[0] ?? null;

    // "Before a provider starts a follow-up encounter" context — last
    // completed visit in this episode, its diagnoses (doctor visits
    // only — clinical_note_diagnoses has no nurse/physio equivalent
    // yet), and any resulted labs ordered within the episode.
    const lastCompletedBooking = recentBookings.find(b => b.status === "completed");
    if (lastCompletedBooking) {
      const { data: note } = await admin
        .from("clinical_notes")
        .select("id, submitted_at")
        .eq("booking_id", lastCompletedBooking.id)
        .maybeSingle();
      lastEncounter = { booking: lastCompletedBooking, clinicalNoteId: note?.id ?? null };

      if (note?.id) {
        const { data: diagRows } = await admin
          .from("clinical_note_diagnoses")
          .select("plain_language_diagnosis, clinical_description, diagnosis_type")
          .eq("clinical_note_id", note.id);
        diagnoses = diagRows ?? [];
      }
    }

    // Labs ordered directly against the episode (patient-initiated
    // requests) OR via one of the episode's own bookings (a doctor
    // ordering labs during a visit doesn't separately tag care_episode_id
    // — the booking link already implies it).
    const bookingIds = recentBookings.map(b => b.id);
    const { data: labRows } = await admin
      .from("investigation_orders")
      .select("id, tests, status, ordered_at, resulted_at")
      .or(`care_episode_id.eq.${activeEpisode.id}${bookingIds.length ? `,booking_id.in.(${bookingIds.join(",")})` : ""}`)
      .order("ordered_at", { ascending: false })
      .limit(5);
    labs = labRows ?? [];
  }

  // Timeline: merged from existing tables, not a duplicate event log — a
  // booking's own created_at/completed_at, a task's created_at/completed_at,
  // and the plan's created_at/updated_at are the timeline, just re-sorted
  // into one feed rather than re-recorded anywhere.
  const timeline: { at: string; label: string; icon: string }[] = [];
  if (activeEpisode) {
    timeline.push({ at: activeEpisode.created_at, label: `Care episode "${activeEpisode.title}" started`, icon: "📋" });
    for (const b of recentBookings) {
      const label = (SERVICE_LABELS as Record<string, string>)[b.service_type] ?? b.service_type;
      timeline.push({ at: b.created_at, label: `${label} booked`, icon: "🩺" });
      if (b.status === "completed" && b.completed_at) timeline.push({ at: b.completed_at, label: `${label} completed`, icon: "✅" });
    }
    if (plan) {
      timeline.push({ at: plan.created_at, label: "Care plan created", icon: "🗒️" });
      if (plan.updated_at && plan.updated_at !== plan.created_at) timeline.push({ at: plan.updated_at, label: "Care plan updated", icon: "🗒️" });
    }
    for (const t of tasks) {
      timeline.push({ at: t.created_at, label: `Task added: ${t.description}`, icon: "☑️" });
      if (t.completed_at) timeline.push({ at: t.completed_at, label: `Task completed: ${t.description}`, icon: "✔️" });
    }

    const { data: allFollowUps } = await admin
      .from("follow_ups")
      .select("created_at, updated_at, status, follow_up_date")
      .eq("care_episode_id", activeEpisode.id);
    for (const f of allFollowUps ?? []) {
      timeline.push({ at: f.created_at, label: `Follow-up scheduled for ${new Date(f.follow_up_date).toLocaleDateString("en-NG", { day: "numeric", month: "short" })}`, icon: "📅" });
      if (f.status === "completed") timeline.push({ at: f.updated_at, label: "Follow-up completed", icon: "✅" });
    }

    timeline.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
  }

  return (
    <PatientCareClient
      patient={patient}
      currentProvider={provider}
      episodes={episodeList}
      activeEpisode={activeEpisode}
      team={team}
      plan={plan}
      timeline={timeline}
      tasks={tasks}
      contextBooking={contextBooking}
      pendingFollowUp={pendingFollowUp}
      lastEncounter={lastEncounter}
      diagnoses={diagnoses}
      labs={labs}
    />
  );
}
