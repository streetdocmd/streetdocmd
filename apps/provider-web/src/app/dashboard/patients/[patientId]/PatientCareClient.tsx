"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import {
  CARE_EPISODE_STATUS_LABELS, CARE_TASK_TYPE_LABELS, CARE_TASK_STATUS_LABELS,
  PROFESSION_LABELS, SERVICE_LABELS, FOLLOW_UP_TYPE_LABELS,
} from "@streetdocmd/shared";

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

export default function PatientCareClient({
  patient, currentProvider, episodes, activeEpisode, team, plan, tasks, timeline, contextBooking,
  pendingFollowUp, lastEncounter, diagnoses, labs,
}: {
  patient: any; currentProvider: { id: string; profession: string };
  episodes: any[]; activeEpisode: any; team: any[]; plan: any; tasks: any[];
  timeline: { at: string; label: string; icon: string }[];
  contextBooking: { id: string; care_episode_id: string | null } | null;
  pendingFollowUp: any; lastEncounter: any; diagnoses: any[]; labs: any[];
}) {
  const router = useRouter();
  const supabase = createClient();

  const isOnTeam = team.some(t => t.provider_id === currentProvider.id);

  async function linkContextBooking(episodeId: string) {
    if (!contextBooking) return;
    await supabase.from("bookings").update({ care_episode_id: episodeId }).eq("id", contextBooking.id);
    router.refresh();
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{patient.name ?? "Patient"}</h1>
        <p className="text-sm text-gray-500">{patient.phone}</p>
      </div>

      {!activeEpisode ? (
        <NoEpisodeState patientId={patient.id} providerId={currentProvider.id} contextBooking={contextBooking} supabase={supabase} router={router} />
      ) : (
        <>
          {contextBooking && contextBooking.care_episode_id !== activeEpisode.id && (
            <button
              onClick={() => linkContextBooking(activeEpisode.id)}
              className="w-full card p-3 text-sm text-teal-700 border border-teal-200 bg-teal-50 hover:bg-teal-100 transition-colors text-left"
            >
              + Link today's visit to this care episode
            </button>
          )}
          <EpisodeHeader episode={activeEpisode} />
          {pendingFollowUp && (
            <FollowUpContextSection
              followUp={pendingFollowUp}
              lastEncounter={lastEncounter}
              diagnoses={diagnoses}
              labs={labs}
            />
          )}
          <CareTeamSection episodeId={activeEpisode.id} team={team} isOnTeam={isOnTeam} currentProvider={currentProvider} supabase={supabase} router={router} />
          <CarePlanSection episodeId={activeEpisode.id} plan={plan} providerId={currentProvider.id} canEdit={isOnTeam} supabase={supabase} router={router} />
          <CareTasksSection episodeId={activeEpisode.id} tasks={tasks} providerId={currentProvider.id} canEdit={isOnTeam} supabase={supabase} router={router} />
          <TimelineSection timeline={timeline} />
        </>
      )}

      {episodes.length > 1 && (
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Other Episodes</h3>
          <div className="space-y-2">
            {episodes.filter(e => e.id !== activeEpisode?.id).map(e => (
              <div key={e.id} className="flex items-center justify-between text-sm">
                <span className="text-gray-700">{e.title}</span>
                <span className={`badge ${STATUS_STYLES[e.status] ?? ""}`}>
                  {CARE_EPISODE_STATUS_LABELS[e.status as keyof typeof CARE_EPISODE_STATUS_LABELS] ?? e.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function NoEpisodeState({ patientId, providerId, contextBooking, supabase, router }: any) {
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function createEpisode(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) { setError("Please give this care episode a title."); return; }
    setSaving(true);
    setError("");

    const { data: episode, error: err } = await supabase
      .from("care_episodes")
      .insert({ patient_id: patientId, title: title.trim(), reason: reason.trim() || null, created_by: providerId, lead_provider_id: providerId })
      .select("id")
      .single();

    if (err || !episode) {
      setError(err?.message ?? "Could not create care episode.");
      setSaving(false);
      return;
    }

    await supabase.from("care_team_members").insert({ care_episode_id: episode.id, provider_id: providerId, is_lead: true });

    // If we arrived here from a specific visit, that visit becomes the
    // episode's first piece of history rather than starting empty.
    if (contextBooking) {
      await supabase.from("bookings").update({ care_episode_id: episode.id }).eq("id", contextBooking.id);
    }

    setSaving(false);
    router.refresh();
  }

  if (!showForm) {
    return (
      <div className="card p-8 text-center">
        <p className="text-3xl mb-2">📋</p>
        <p className="font-semibold text-gray-700">No active care episode</p>
        <p className="text-sm text-gray-400 mt-1 mb-4">This patient has only had standalone visits so far.</p>
        <button onClick={() => setShowForm(true)} className="btn-primary">Start a care episode</button>
      </div>
    );
  }

  return (
    <form onSubmit={createEpisode} className="card p-5 space-y-3">
      <h3 className="text-sm font-semibold text-gray-900">New care episode</h3>
      <div>
        <label className="label">Title</label>
        <input className="input" placeholder="e.g. Hypertension management" value={title} onChange={e => setTitle(e.target.value)} required />
      </div>
      <div>
        <label className="label">Reason (optional)</label>
        <textarea className="input" rows={2} placeholder="Why is this patient starting coordinated care?" value={reason} onChange={e => setReason(e.target.value)} />
      </div>
      {error && <p className="text-red-600 text-sm">{error}</p>}
      <div className="flex gap-2">
        <button type="button" onClick={() => setShowForm(false)} className="flex-1 border border-gray-200 rounded-lg py-2 text-sm font-medium text-gray-600">Cancel</button>
        <button type="submit" disabled={saving} className="btn-primary flex-1 text-sm">{saving ? "Creating…" : "Create episode"}</button>
      </div>
    </form>
  );
}

function EpisodeHeader({ episode }: { episode: any }) {
  return (
    <div className="card p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-bold text-gray-900">{episode.title}</h2>
          {episode.reason && <p className="text-sm text-gray-500 mt-0.5">{episode.reason}</p>}
        </div>
        <span className={`badge ${STATUS_STYLES[episode.status] ?? ""} shrink-0`}>
          {CARE_EPISODE_STATUS_LABELS[episode.status as keyof typeof CARE_EPISODE_STATUS_LABELS] ?? episode.status}
        </span>
      </div>
      <p className="text-xs text-gray-400 mt-2">
        Started {new Date(episode.start_date).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" })}
      </p>
    </div>
  );
}

// "Before a provider starts a follow-up encounter, show..." — everything
// they'd otherwise have to go dig up manually. Medications are
// deliberately not shown here at all (not just gated by profession) —
// prescriptions live behind their own doctor-only RLS policy and this
// page reads with the service-role client, so surfacing them here would
// require re-deriving that permission check rather than relying on it;
// out of scope for Tier 1, noted as a limitation.
function FollowUpContextSection({ followUp, lastEncounter, diagnoses, labs }: any) {
  const booking = lastEncounter?.booking;
  return (
    <div className="card p-5 border-2 border-amber-200 bg-amber-50/40">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <h3 className="text-sm font-semibold text-gray-900">Follow-up Context</h3>
        <div className="flex items-center gap-2">
          <span className="badge bg-gray-100 text-gray-600">
            {(FOLLOW_UP_TYPE_LABELS as Record<string, string>)[followUp.follow_up_type] ?? followUp.follow_up_type}
          </span>
          <span className="badge bg-amber-100 text-amber-800">
            Due {new Date(followUp.follow_up_date).toLocaleDateString("en-NG", { day: "numeric", month: "short" })}
          </span>
        </div>
      </div>

      {followUp.reason && (
        <div className="mb-3">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Follow-up Reason</p>
          <p className="text-sm text-gray-700">{followUp.reason}</p>
        </div>
      )}

      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Last Encounter</p>
          {booking ? (
            <p className="text-sm text-gray-700">
              {(SERVICE_LABELS as Record<string, string>)[booking.service_type] ?? booking.service_type}
              {booking.completed_at && ` · ${new Date(booking.completed_at).toLocaleDateString("en-NG", { day: "numeric", month: "short" })}`}
            </p>
          ) : (
            <p className="text-sm text-gray-400">No prior completed visit on record.</p>
          )}
        </div>

        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Relevant Diagnoses</p>
          {diagnoses.length > 0 ? (
            <ul className="text-sm text-gray-700 space-y-0.5">
              {diagnoses.map((d: any, i: number) => (
                <li key={i}>{d.plain_language_diagnosis || d.clinical_description}</li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-gray-400">None recorded.</p>
          )}
        </div>

        <div className="sm:col-span-2">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Relevant Labs</p>
          {labs.length > 0 ? (
            <ul className="text-sm text-gray-700 space-y-0.5">
              {labs.map((l: any) => (
                <li key={l.id}>
                  {(l.tests as any[])?.map((t: any) => t.test_name).join(", ") || "Investigation"} — {l.status}
                  {l.resulted_at && ` (resulted ${new Date(l.resulted_at).toLocaleDateString("en-NG", { day: "numeric", month: "short" })})`}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-gray-400">None ordered.</p>
          )}
        </div>
      </div>
    </div>
  );
}

function CareTeamSection({ episodeId, team, isOnTeam, currentProvider, supabase, router }: any) {
  const [showForm, setShowForm] = useState(false);
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function joinTeam() {
    setSaving(true);
    await supabase.from("care_team_members").insert({ care_episode_id: episodeId, provider_id: currentProvider.id });
    setSaving(false);
    router.refresh();
  }

  async function addColleague(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);

    const { data: colleague } = await supabase.from("providers").select("id").eq("phone", phone.trim()).maybeSingle();
    if (!colleague) {
      setError("No verified provider found with that phone number.");
      setSaving(false);
      return;
    }

    const { error: err } = await supabase.from("care_team_members").insert({ care_episode_id: episodeId, provider_id: colleague.id });
    setSaving(false);
    if (err) { setError(err.message); return; }
    setPhone("");
    setShowForm(false);
    router.refresh();
  }

  return (
    <div className="card p-5">
      <h3 className="text-sm font-semibold text-gray-900 mb-3">Care Team</h3>
      <div className="space-y-2 mb-3">
        {team.map((t: any) => (
          <div key={t.id} className="flex items-center justify-between text-sm">
            <span className="text-gray-700">
              {t.provider?.name ?? "Provider"}
              {t.is_lead && <span className="ml-1.5 text-xs text-amber-600 font-medium">(Lead)</span>}
            </span>
            <span className="text-xs text-gray-400">{PROFESSION_LABELS[t.provider?.profession as keyof typeof PROFESSION_LABELS] ?? t.provider?.profession}</span>
          </div>
        ))}
        {team.length === 0 && <p className="text-sm text-gray-400">No team members yet.</p>}
      </div>

      {!isOnTeam && (
        <button onClick={joinTeam} disabled={saving} className="text-sm text-teal-brand font-medium hover:underline mr-4">
          + Join this care team
        </button>
      )}

      {!showForm ? (
        <button onClick={() => setShowForm(true)} className="text-sm text-teal-brand font-medium hover:underline">
          + Add a colleague
        </button>
      ) : (
        <form onSubmit={addColleague} className="flex gap-2 mt-2">
          <input className="input flex-1" placeholder="Colleague's phone number" value={phone} onChange={e => setPhone(e.target.value)} />
          <button type="submit" disabled={saving} className="btn-teal px-4 text-sm">Add</button>
        </form>
      )}
      {error && <p className="text-red-600 text-sm mt-2">{error}</p>}
    </div>
  );
}

function CarePlanSection({ episodeId, plan, providerId, canEdit, supabase, router }: any) {
  const [editing, setEditing] = useState(false);
  const [instructions, setInstructions] = useState(plan?.instructions ?? "");
  const [notes, setNotes] = useState(plan?.notes ?? "");
  const [followUpPlan, setFollowUpPlan] = useState(plan?.follow_up_plan ?? "");
  const [followUpDate, setFollowUpDate] = useState(plan?.follow_up_date ?? "");
  const [saving, setSaving] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const payload = {
      care_episode_id: episodeId,
      instructions: instructions || null,
      notes: notes || null,
      follow_up_plan: followUpPlan || null,
      follow_up_date: followUpDate || null,
      created_by: providerId,
      updated_by: providerId,
      updated_at: new Date().toISOString(),
    };
    if (plan) {
      await supabase.from("care_plans").update(payload).eq("id", plan.id);
    } else {
      await supabase.from("care_plans").insert(payload);
    }
    setSaving(false);
    setEditing(false);
    router.refresh();
  }

  if (!plan && !editing) {
    return (
      <div className="card p-5">
        <h3 className="text-sm font-semibold text-gray-900 mb-2">Care Plan</h3>
        <p className="text-sm text-gray-400 mb-3">No care plan yet.</p>
        {canEdit && <button onClick={() => setEditing(true)} className="btn-primary text-sm">Create care plan</button>}
      </div>
    );
  }

  if (editing) {
    return (
      <form onSubmit={save} className="card p-5 space-y-3">
        <h3 className="text-sm font-semibold text-gray-900">Care Plan</h3>
        <div>
          <label className="label">Instructions</label>
          <textarea className="input" rows={2} value={instructions} onChange={e => setInstructions(e.target.value)} />
        </div>
        <div>
          <label className="label">Notes</label>
          <textarea className="input" rows={2} value={notes} onChange={e => setNotes(e.target.value)} />
        </div>
        <div>
          <label className="label">Follow-up plan</label>
          <textarea className="input" rows={2} value={followUpPlan} onChange={e => setFollowUpPlan(e.target.value)} />
        </div>
        <div>
          <label className="label">Next follow-up date</label>
          <input type="date" className="input" value={followUpDate} onChange={e => setFollowUpDate(e.target.value)} />
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => setEditing(false)} className="flex-1 border border-gray-200 rounded-lg py-2 text-sm font-medium text-gray-600">Cancel</button>
          <button type="submit" disabled={saving} className="btn-primary flex-1 text-sm">{saving ? "Saving…" : "Save"}</button>
        </div>
      </form>
    );
  }

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-900">Care Plan</h3>
        {canEdit && <button onClick={() => setEditing(true)} className="text-xs text-teal-brand font-medium hover:underline">Edit</button>}
      </div>
      {plan.instructions && <Field label="Instructions" value={plan.instructions} />}
      {plan.notes && <Field label="Notes" value={plan.notes} />}
      {plan.follow_up_plan && <Field label="Follow-up plan" value={plan.follow_up_plan} />}
      {plan.follow_up_date && (
        <Field label="Next follow-up" value={new Date(plan.follow_up_date).toLocaleDateString("en-NG", { day: "numeric", month: "long", year: "numeric" })} />
      )}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="mb-2 last:mb-0">
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{label}</p>
      <p className="text-sm text-gray-700">{value}</p>
    </div>
  );
}

function CareTasksSection({ episodeId, tasks, providerId, canEdit, supabase, router }: any) {
  const [showForm, setShowForm] = useState(false);
  const [description, setDescription] = useState("");
  const [taskType, setTaskType] = useState<keyof typeof CARE_TASK_TYPE_LABELS>("other");
  const [dueDate, setDueDate] = useState("");
  const [saving, setSaving] = useState(false);

  async function addTask(e: React.FormEvent) {
    e.preventDefault();
    if (!description.trim()) return;
    setSaving(true);
    await supabase.from("care_tasks").insert({
      care_episode_id: episodeId, description: description.trim(), task_type: taskType,
      due_date: dueDate || null, created_by: providerId,
    });
    setSaving(false);
    setDescription(""); setDueDate(""); setShowForm(false);
    router.refresh();
  }

  async function toggleComplete(task: any) {
    const nowCompleted = task.status !== "completed";
    await supabase.from("care_tasks").update({
      status: nowCompleted ? "completed" : "pending",
      completed_at: nowCompleted ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    }).eq("id", task.id);
    router.refresh();
  }

  return (
    <div className="card p-5">
      <h3 className="text-sm font-semibold text-gray-900 mb-3">Care Tasks</h3>
      <div className="space-y-2 mb-3">
        {tasks.map((t: any) => (
          <div key={t.id} className="flex items-center justify-between gap-3 text-sm">
            <label className="flex items-center gap-2 min-w-0">
              <input type="checkbox" checked={t.status === "completed"} onChange={() => canEdit && toggleComplete(t)} disabled={!canEdit} />
              <span className={`truncate ${t.status === "completed" ? "line-through text-gray-400" : "text-gray-700"}`}>{t.description}</span>
            </label>
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-xs text-gray-400">{CARE_TASK_TYPE_LABELS[t.task_type as keyof typeof CARE_TASK_TYPE_LABELS]}</span>
              {t.due_date && (
                <span className="text-xs text-gray-400">
                  {new Date(t.due_date).toLocaleDateString("en-NG", { day: "numeric", month: "short" })}
                </span>
              )}
            </div>
          </div>
        ))}
        {tasks.length === 0 && <p className="text-sm text-gray-400">No tasks yet.</p>}
      </div>

      {canEdit && (!showForm ? (
        <button onClick={() => setShowForm(true)} className="text-sm text-teal-brand font-medium hover:underline">+ Add task</button>
      ) : (
        <form onSubmit={addTask} className="space-y-2">
          <input className="input" placeholder="e.g. Take medication, Monitor BP" value={description} onChange={e => setDescription(e.target.value)} />
          <div className="grid grid-cols-2 gap-2">
            <select className="input" value={taskType} onChange={e => setTaskType(e.target.value as any)}>
              {Object.entries(CARE_TASK_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <input type="date" className="input" value={dueDate} onChange={e => setDueDate(e.target.value)} />
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => setShowForm(false)} className="flex-1 border border-gray-200 rounded-lg py-2 text-sm font-medium text-gray-600">Cancel</button>
            <button type="submit" disabled={saving} className="btn-teal flex-1 text-sm">{saving ? "Adding…" : "Add"}</button>
          </div>
        </form>
      ))}
    </div>
  );
}

function TimelineSection({ timeline }: { timeline: { at: string; label: string; icon: string }[] }) {
  if (timeline.length === 0) return null;
  return (
    <div className="card p-5">
      <h3 className="text-sm font-semibold text-gray-900 mb-3">Timeline</h3>
      <div className="space-y-3">
        {timeline.map((event, i) => (
          <div key={i} className="flex items-start gap-2.5 text-sm">
            <span className="shrink-0">{event.icon}</span>
            <div className="min-w-0 flex-1">
              <p className="text-gray-700">{event.label}</p>
              <p className="text-xs text-gray-400">
                {new Date(event.at).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" })}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
