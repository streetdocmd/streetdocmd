import { redirect } from "next/navigation";
import Link from "next/link";
import { createServerSupabase } from "@/lib/supabase-server";
import { CARE_EPISODE_STATUS_LABELS, PROFESSION_LABELS, CARE_TASK_TYPE_LABELS, FOLLOW_UP_TYPE_LABELS } from "@/lib/shared";
import type { Profession, ServiceType } from "@/lib/shared";
import ContinueCareButton from "./ContinueCareButton";

// A follow-up books via the same profession-based service types every
// other visit does — see the matching map in api/bookings/route.ts.
const DEFAULT_SERVICE_BY_PROFESSION: Record<Profession, ServiceType> = {
  doctor: "general_consultation",
  nurse: "nursing_care",
  physiotherapist: "physiotherapy_session",
  lab_scientist: "general_consultation",
};

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

const PROGRESS_STEPS = ["active", "monitoring", "follow_up_due", "resolved"];

export default async function MyCarePage() {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: episodes } = await supabase
    .from("care_episodes")
    .select("*")
    .eq("patient_id", user.id)
    .order("updated_at", { ascending: false });

  const activeEpisode = (episodes ?? []).find(e => !["closed", "resolved"].includes(e.status)) ?? null;

  if (!activeEpisode) {
    return (
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">My Care</h1>
        <div className="card p-12 text-center">
          <p className="text-4xl mb-3">🌿</p>
          <p className="font-semibold text-gray-700">No active care episode</p>
          <p className="text-sm text-gray-400 mt-1">
            You don't have any ongoing coordinated care right now — your visits so far have each stood on their own.
            If a provider starts a care plan with you, it'll show up here.
          </p>
        </div>
      </div>
    );
  }

  const [{ data: team }, { data: plan }, { data: tasks }, { data: pendingFollowUp }] = await Promise.all([
    supabase
      .from("care_team_members")
      .select("id, is_lead, provider:providers(id, name, profession, credentials, available)")
      .eq("care_episode_id", activeEpisode.id)
      .eq("active", true),
    supabase.from("care_plans").select("*").eq("care_episode_id", activeEpisode.id).maybeSingle(),
    supabase.from("care_tasks").select("*").eq("care_episode_id", activeEpisode.id).order("due_date", { ascending: true, nullsFirst: false }),
    supabase
      .from("follow_ups")
      // follow_ups has two FKs to providers (continuing_provider_id and
      // created_by) — PostgREST can't infer which one "providers(...)"
      // means without the explicit !constraint_name hint, and errors
      // (silently, from this call site's point of view) without it.
      .select("id, reason, follow_up_date, follow_up_type, continuing_provider:providers!follow_ups_continuing_provider_id_fkey(id, name, profession, available)")
      .eq("care_episode_id", activeEpisode.id)
      .eq("status", "scheduled")
      .order("follow_up_date", { ascending: true })
      .limit(1)
      .maybeSingle(),
  ]);

  const teamList = (team ?? []) as any[];
  const lead = teamList.find(t => t.is_lead)?.provider ?? teamList[0]?.provider ?? null;
  const openTasks = (tasks ?? []).filter(t => t.status !== "completed" && t.status !== "cancelled");
  const nextTask = openTasks[0] ?? null;
  const progressIndex = PROGRESS_STEPS.indexOf(activeEpisode.status);
  const followUp = pendingFollowUp as any;
  const followUpProvider = followUp?.continuing_provider;
  const followUpBookHref = followUp && followUpProvider
    ? `/dashboard/book/${DEFAULT_SERVICE_BY_PROFESSION[followUpProvider.profession as Profession]}?follow_up_id=${followUp.id}`
    : null;

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <h1 className="text-2xl font-bold text-gray-900">My Care</h1>

      {/* Episode summary */}
      <div className="card p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-bold text-gray-900 text-lg">{activeEpisode.title}</h2>
            {activeEpisode.reason && <p className="text-sm text-gray-500 mt-0.5">{activeEpisode.reason}</p>}
          </div>
          <span className={`badge ${STATUS_STYLES[activeEpisode.status] ?? ""} shrink-0`}>
            {(CARE_EPISODE_STATUS_LABELS as Record<string, string>)[activeEpisode.status]}
          </span>
        </div>

        {progressIndex >= 0 && (
          <div className="flex items-center gap-1.5 mt-4">
            {PROGRESS_STEPS.map((step, i) => (
              <div key={step} className={`h-1.5 flex-1 rounded-full ${i <= progressIndex ? "bg-blue-brand" : "bg-gray-100"}`} />
            ))}
          </div>
        )}
      </div>

      {/* Care team + continuity */}
      <div className="card p-5">
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Your Care Team</h3>
        <div className="space-y-3">
          {teamList.map((t: any) => (
            <div key={t.id} className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-900">
                  {t.provider?.name}
                  {t.is_lead && <span className="ml-1.5 text-xs text-amber-600 font-medium">Lead</span>}
                </p>
                <p className="text-xs text-gray-400">{(PROFESSION_LABELS as Record<string, string>)[t.provider?.profession]}</p>
              </div>
              {t.provider?.available && (
                <span className="text-xs text-green-600 font-medium">● Available</span>
              )}
            </div>
          ))}
          {teamList.length === 0 && <p className="text-sm text-gray-400">No team members yet.</p>}
        </div>

        {lead && (
          <ContinueCareButton
            providerName={lead.name}
            profession={lead.profession}
            available={!!lead.available}
            careEpisodeId={activeEpisode.id}
          />
        )}
      </div>

      {/* Current tasks */}
      {openTasks.length > 0 && (
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Current Tasks</h3>
          <div className="space-y-2">
            {openTasks.map((t: any) => (
              <div key={t.id} className="flex items-center justify-between text-sm">
                <span className="text-gray-700">{t.description}</span>
                <span className="text-xs text-gray-400">
                  {(CARE_TASK_TYPE_LABELS as Record<string, string>)[t.task_type]}
                  {t.due_date && ` · ${new Date(t.due_date).toLocaleDateString("en-NG", { day: "numeric", month: "short" })}`}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Next step / follow-up */}
      <div className="card p-5">
        <h3 className="text-sm font-semibold text-gray-900 mb-2">What's Next</h3>
        {followUp ? (
          <div>
            <p className="text-sm text-gray-700">
              Follow-up with {followUpProvider?.name ?? "your care team"}
              {followUp.follow_up_type && (
                <span className="text-gray-400"> · {(FOLLOW_UP_TYPE_LABELS as Record<string, string>)[followUp.follow_up_type]}</span>
              )}
            </p>
            <p className="text-sm font-semibold text-gray-900 mt-0.5">
              {new Date(followUp.follow_up_date).toLocaleDateString("en-NG", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
            </p>
            {followUp.reason && <p className="text-xs text-gray-500 mt-1">{followUp.reason}</p>}
            {followUpBookHref && (
              <Link href={followUpBookHref} className="btn-primary inline-flex mt-4 text-sm">
                Book Follow-up
              </Link>
            )}
          </div>
        ) : nextTask ? (
          <p className="text-sm text-gray-700">{nextTask.description}</p>
        ) : (
          <p className="text-sm text-gray-400">Nothing scheduled right now — your care team will let you know when there's a next step.</p>
        )}
        {plan?.instructions && (
          <div className="mt-3 pt-3 border-t border-gray-100">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Instructions</p>
            <p className="text-sm text-gray-700">{plan.instructions}</p>
          </div>
        )}
      </div>
    </div>
  );
}
