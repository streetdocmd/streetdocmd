import { redirect } from "next/navigation";
import Link from "next/link";
import { Check, ChevronRight, CreditCard, FileText, HeartHandshake, Pill as PillIcon, Star, Video } from "lucide-react";
import { Avatar, Button, Card, Pill, cx, focusRing, type PillTone } from "@/components/ds";
import { createAdminSupabase, createServerSupabase } from "@/lib/supabase-server";
import { CARE_EPISODE_STATUS_LABELS, PROFESSION_LABELS, CARE_TASK_TYPE_LABELS, FOLLOW_UP_TYPE_LABELS } from "@/lib/shared";
import type { Profession, ServiceType } from "@/lib/shared";
import ContinueCareButton from "./ContinueCareButton";
import JourneyActions from "./JourneyActions";
import { refillItems, REFILL_SOON_DAYS } from "@/lib/refills";
import { RESULT_STATUSES, statusOf } from "@/lib/investigation-status";

// A follow-up books via the same profession-based service types every
// other visit does — see the matching map in api/bookings/route.ts.
const DEFAULT_SERVICE_BY_PROFESSION: Record<Profession, ServiceType> = {
  doctor: "general_consultation",
  nurse: "nursing_care",
  physiotherapist: "physiotherapy_session",
  lab_scientist: "general_consultation",
};

const PROGRESS_STEPS = ["active", "monitoring", "follow_up_due", "resolved"];
const STEP_LABELS: Record<string, string> = {
  active: "Assessment and treatment",
  monitoring: "Monitoring",
  follow_up_due: "Follow up",
  resolved: "Recovery",
};

const ORDER_LABELS: Record<string, [string, PillTone]> = {
  pending_payment: ["Awaiting payment", "warn"],
  sent: ["Sent to pharmacy", "info"],
  confirmed: ["Confirmed", "info"],
  dispensing: ["Being packed", "info"],
  dispatched: ["On the way", "info"],
  delivered: ["Delivered", "ok"],
  cancelled: ["Cancelled", "idle"],
};

const SOON = [
  { icon: Video, title: "Video consultation", text: "Talk to a doctor from your phone" },
  { icon: Star, title: "Ratings and reviews", text: "Read and write reviews in one place" },
  { icon: CreditCard, title: "Saved addresses and cards", text: "Faster checkout next time" },
];

const day = (iso: string) => new Date(iso).toLocaleDateString("en-NG", { day: "numeric", month: "short", timeZone: "Africa/Lagos" });

function Section({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="mt-[26px]">
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="text-[17px] font-bold text-navy">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function Row({ href, title, sub, pill }: { href?: string; title: string; sub: string; pill: React.ReactNode }) {
  const body = (
    <>
      <div className="min-w-0 flex-1">
        <b className="block truncate text-ds-sm text-ink">{title}</b>
        <small className="text-ds-xs text-muted">{sub}</small>
      </div>
      {pill}
    </>
  );
  return href ? (
    <Link href={href} className={cx("flex items-center gap-3 border-b border-line py-3.5 last:border-b-0", focusRing)}>{body}</Link>
  ) : (
    <div className="flex items-center gap-3 border-b border-line py-3.5 last:border-b-0">{body}</div>
  );
}

export default async function MyCarePage() {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: episodes }, { data: labOrders }, { data: medOrders }, { data: prescriptions }] = await Promise.all([
    supabase.from("care_episodes").select("*").eq("patient_id", user.id).order("updated_at", { ascending: false }),
    supabase
      .from("investigation_orders")
      .select("id, status, ordered_at, tests, lab_partners(name)")
      .eq("patient_id", user.id)
      .order("ordered_at", { ascending: false })
      .limit(5),
    supabase
      .from("prescription_orders")
      .select("id, status, drugs, created_at, pharmacy_partners(name)")
      .eq("patient_id", user.id)
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("prescriptions")
      .select("created_at, drugs")
      .eq("patient_id", user.id)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);
  const refills = refillItems((prescriptions ?? []) as any[]);

  // Finished orders and referrals the patient hasn't rated yet (migration 064).
  // Referrals are read with the service role, scoped to this patient.
  const admin = createAdminSupabase();
  const [{ data: rated }, { data: doneReferrals }] = await Promise.all([
    admin.from("facility_reviews").select("facility_type, order_id").eq("patient_id", user.id),
    admin.from("hospital_referrals").select("id, referred_at, hospital_partners(name)")
      .eq("patient_id", user.id).eq("status", "completed").order("referred_at", { ascending: false }).limit(5),
  ]);
  const ratedKeys = new Set(((rated ?? []) as any[]).map(r => `${r.facility_type}:${r.order_id}`));
  const toRate = [
    ...((medOrders ?? []) as any[]).filter(o => o.status === "delivered")
      .map(o => ({ type: "pharmacy", id: o.id, title: o.pharmacy_partners?.name ?? "Pharmacy", sub: `Medicine order · ${day(o.created_at)}` })),
    ...((labOrders ?? []) as any[]).filter(o => (RESULT_STATUSES as string[]).includes(o.status))
      .map(o => ({ type: "lab", id: o.id, title: o.lab_partners?.name ?? "Lab", sub: `Lab tests · ${day(o.ordered_at)}` })),
    ...((doneReferrals ?? []) as any[])
      .map(r => ({ type: "hospital", id: r.id, title: r.hospital_partners?.name ?? "Hospital", sub: `Referral · ${day(r.referred_at)}` })),
  ].filter(x => !ratedKeys.has(`${x.type}:${x.id}`)).slice(0, 4);

  const activeEpisode = (episodes ?? []).find(e => !["closed", "resolved"].includes(e.status)) ?? null;

  const [{ data: team }, { data: plan }, { data: tasks }, { data: pendingFollowUp }] = activeEpisode
    ? await Promise.all([
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
      ])
    : [{ data: [] }, { data: null }, { data: [] }, { data: null }];

  const teamList = (team ?? []) as any[];
  const lead = teamList.find(t => t.is_lead)?.provider ?? teamList[0]?.provider ?? null;
  const openTasks = ((tasks ?? []) as any[]).filter(t => t.status !== "completed" && t.status !== "cancelled");
  const nextTask = openTasks[0] ?? null;
  const progressIndex = activeEpisode ? PROGRESS_STEPS.indexOf(activeEpisode.status) : -1;

  // Medical report requests (migration 068), and recent finished journeys
  const pastEpisodes = (episodes ?? []).filter(e => ["closed", "resolved"].includes(e.status)).slice(0, 3);
  const { data: reportRequests } = await supabase
    .from("care_report_requests")
    .select("id, care_episode_id, status, review_note, created_at")
    .eq("requested_by", user.id)
    .order("created_at", { ascending: false });
  const requestsFor = (episodeId: string) => ((reportRequests ?? []) as any[]).filter(r => r.care_episode_id === episodeId);
  const followUp = pendingFollowUp as any;
  const followUpProvider = followUp?.continuing_provider;
  const followUpBookHref = followUp && followUpProvider
    ? `/dashboard/book/${DEFAULT_SERVICE_BY_PROFESSION[followUpProvider.profession as Profession]}?follow_up_id=${followUp.id}`
    : null;
  const pct = progressIndex >= 0 ? Math.round(((progressIndex + 1) / PROGRESS_STEPS.length) * 100) : 0;
  const circumference = 132;

  return (
    <div className="mx-auto max-w-2xl">
      <div className="pb-4">
        <h1 className="text-[26px] font-extrabold leading-tight tracking-[-0.02em] text-navy">Your care</h1>
        <small className="text-[13px] font-semibold text-muted">Journey, results and medicines</small>
      </div>

      <Link href="/dashboard/records" className={cx("mb-4 flex items-center gap-3 rounded-[20px] border border-line bg-surface p-3.5 shadow-ds-sm", focusRing)}>
        <span className="grid h-10 w-10 flex-none place-items-center rounded-[13px] bg-sky text-brand"><FileText size={20} aria-hidden /></span>
        <span className="min-w-0 flex-1">
          <b className="block text-ds-sm text-ink">Visit records</b>
          <span className="text-ds-xs text-muted">Notes, prescriptions and results from every visit</span>
        </span>
        <ChevronRight size={20} className="text-muted" aria-hidden />
      </Link>

      {activeEpisode ? (
        <>
          <div className="flex items-center gap-3.5 rounded-ds-lg border border-line bg-surface p-4">
            {progressIndex >= 0 && (
              <div className="relative h-[52px] w-[52px] flex-none" role="img" aria-label={`Care journey ${pct}% complete`}>
                <svg viewBox="0 0 52 52" className="h-[52px] w-[52px] -rotate-90" aria-hidden>
                  <circle cx="26" cy="26" r="21" fill="none" stroke="var(--line)" strokeWidth="5" />
                  <circle cx="26" cy="26" r="21" fill="none" stroke="var(--teal)" strokeWidth="5" strokeLinecap="round"
                    strokeDasharray={circumference} strokeDashoffset={circumference * (1 - pct / 100)} />
                </svg>
                <b className="absolute inset-0 grid place-items-center text-[13px] text-navy">{pct}%</b>
              </div>
            )}
            <div className="min-w-0 flex-1">
              <b className="block text-ds-sm text-ink">{activeEpisode.title}</b>
              <p className="text-ds-sm text-muted">
                {progressIndex >= 0
                  ? `Step ${progressIndex + 1} of ${PROGRESS_STEPS.length}: ${STEP_LABELS[activeEpisode.status]}`
                  : (CARE_EPISODE_STATUS_LABELS as Record<string, string>)[activeEpisode.status]}
              </p>
            </div>
          </div>

          {progressIndex >= 0 && (
            <Card className="mt-3.5">
              <ol>
                {PROGRESS_STEPS.map((step, i) => {
                  const state = i < progressIndex ? "done" : i === progressIndex ? "now" : "todo";
                  return (
                    <li key={step} className="relative flex items-center gap-3.5 pb-4 last:pb-0">
                      {i < PROGRESS_STEPS.length - 1 && (
                        <span aria-hidden className={`absolute left-[13px] top-7 h-[calc(100%-24px)] w-0.5 ${state === "done" ? "bg-success" : "bg-line"}`} />
                      )}
                      <span className={`relative grid h-7 w-7 flex-none place-items-center rounded-full ${
                        state === "done" ? "bg-success text-white" : state === "now" ? "bg-accent-soft ring-2 ring-accent" : "border-2 border-line bg-surface"
                      }`}>
                        {state === "done" && <Check size={14} strokeWidth={3} aria-hidden />}
                        {state === "now" && <span className="h-2.5 w-2.5 rounded-full bg-accent" aria-hidden />}
                      </span>
                      <b className={`text-ds-sm ${state === "todo" ? "text-muted" : "text-ink"}`}>{STEP_LABELS[step]}</b>
                    </li>
                  );
                })}
              </ol>
            </Card>
          )}

          <Section title="Your care team">
            <Card>
              {activeEpisode.reason && <p className="mb-3 text-ds-sm text-muted">{activeEpisode.reason}</p>}
              <div className="space-y-3">
                {teamList.map((t: any) => (
                  <div key={t.id} className="flex items-center gap-3">
                    <Avatar name={t.provider?.name ?? "Provider"} size="sm" />
                    <div className="min-w-0 flex-1">
                      <b className="block text-ds-sm text-ink">
                        {t.provider?.name}
                        {t.is_lead && <span className="ml-1.5 text-ds-xs font-bold text-warn">Lead</span>}
                      </b>
                      <small className="text-ds-xs text-muted">{(PROFESSION_LABELS as Record<string, string>)[t.provider?.profession]}</small>
                    </div>
                    {t.provider?.available && <Pill tone="ok">Available</Pill>}
                  </div>
                ))}
                {teamList.length === 0 && <p className="text-ds-sm text-muted">No team members yet.</p>}
              </div>
              {lead && (
                <ContinueCareButton
                  providerName={lead.name}
                  profession={lead.profession}
                  available={!!lead.available}
                  careEpisodeId={activeEpisode.id}
                />
              )}
              <JourneyActions episodeId={activeEpisode.id} recoveredAt={activeEpisode.recovered_at ?? null} closed={false} requests={requestsFor(activeEpisode.id)} />
            </Card>
          </Section>

          {openTasks.length > 0 && (
            <Section title="Current tasks">
              <Card padded={false} className="px-4 py-1">
                {openTasks.map((t: any) => (
                  <Row key={t.id} title={t.description}
                    sub={[(CARE_TASK_TYPE_LABELS as Record<string, string>)[t.task_type], t.due_date && day(t.due_date)].filter(Boolean).join(" · ")}
                    pill={null} />
                ))}
              </Card>
            </Section>
          )}

          <Section title="What's next">
            <Card>
              {followUp ? (
                <div>
                  <p className="text-ds-sm text-ink">
                    Follow up with {followUpProvider?.name ?? "your care team"}
                    {followUp.follow_up_type && (
                      <span className="text-muted"> · {(FOLLOW_UP_TYPE_LABELS as Record<string, string>)[followUp.follow_up_type]}</span>
                    )}
                  </p>
                  <b className="mt-0.5 block text-ds-md text-navy">
                    {new Date(followUp.follow_up_date).toLocaleDateString("en-NG", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
                  </b>
                  {followUp.reason && <p className="mt-1 text-ds-xs text-muted">{followUp.reason}</p>}
                  {followUpBookHref && <Button href={followUpBookHref} className="mt-4">Book follow up</Button>}
                </div>
              ) : nextTask ? (
                <p className="text-ds-sm text-ink">{nextTask.description}</p>
              ) : (
                <p className="text-ds-sm text-muted">Nothing scheduled right now. Your care team will let you know when there&apos;s a next step.</p>
              )}
              {plan?.instructions && (
                <div className="mt-3 border-t border-line pt-3">
                  <p className="mb-1 text-ds-xs font-bold text-muted">Instructions</p>
                  <p className="text-ds-sm text-ink">{plan.instructions}</p>
                </div>
              )}
            </Card>
          </Section>
        </>
      ) : (
        <Card className="px-5 py-6 text-center">
          <span className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-[18px] bg-sky text-brand">
            <HeartHandshake size={24} aria-hidden />
          </span>
          <b className="text-ink">No active care journey</b>
          <p className="mt-1.5 text-ds-sm text-muted">
            Your visits so far have each stood on their own. If a provider starts a care plan with you, it shows up here.
          </p>
        </Card>
      )}

      {pastEpisodes.length > 0 && (
        <Section title="Past care journeys">
          <div className="space-y-2.5">
            {pastEpisodes.map((e: any) => (
              <Card key={e.id}>
                <b className="block text-ds-sm text-ink">{e.title}</b>
                <small className="text-ds-xs text-muted">Closed{e.closed_at ? ` ${day(e.closed_at)}` : ""}</small>
                <JourneyActions episodeId={e.id} recoveredAt={e.recovered_at ?? null} closed requests={requestsFor(e.id)} />
              </Card>
            ))}
          </div>
        </Section>
      )}

      {toRate.length > 0 && (
        <Section title="Rate your care">
          <Card padded={false} className="px-4 py-1">
            {toRate.map(x => (
              <Row key={`${x.type}-${x.id}`} href={`/dashboard/rate/${x.type}/${x.id}`} title={x.title} sub={x.sub}
                pill={<Pill tone="warn" icon={Star}>Rate</Pill>} />
            ))}
          </Card>
        </Section>
      )}

      <Section title="Results" action={<Link href="/dashboard/book/lab-investigations" className="text-[13px] font-bold text-accent">All</Link>}>
        {(labOrders ?? []).length > 0 ? (
          <Card padded={false} className="px-4 py-1">
            {(labOrders as any[]).map(o => {
              const { label, tone } = statusOf(o.status);
              return (
                <Row key={o.id} href={`/dashboard/investigations/${o.id}`}
                  title={(o.tests as any[])?.map(t => t.test_name).join(", ") || "Lab tests"}
                  sub={[o.lab_partners?.name, day(o.ordered_at)].filter(Boolean).join(" · ")}
                  pill={<Pill tone={tone}>{label}</Pill>} />
              );
            })}
          </Card>
        ) : (
          <p className="text-ds-sm text-muted">No lab results yet. Tests you order appear here with a Ready, Processing or Pending label.</p>
        )}
      </Section>

      <Section title="Medicines">
        {refills.length > 0 && (
          <Card padded={false} className="mb-3 px-4 py-1">
            {refills.map(r => {
              const soon = r.daysLeft <= REFILL_SOON_DAYS;
              const pill = r.daysLeft <= 0
                ? <Pill tone="idle">Finished</Pill>
                : <Pill tone={soon ? "warn" : "ok"}>{r.daysLeft} day{r.daysLeft === 1 ? "" : "s"} left</Pill>;
              return (
                <div key={`${r.name}-${r.daysLeft}`} className="flex items-center gap-3 border-b border-line py-3.5 last:border-b-0">
                  <div className="min-w-0 flex-1">
                    <b className="block truncate text-ds-sm text-ink">{r.name}</b>
                    <small className="text-ds-xs text-muted">{soon ? "Refill soon" : "Refill not needed yet"}{r.detail ? ` · ${r.detail}` : ""}</small>
                  </div>
                  {pill}
                  {soon && (
                    <Button href={`/dashboard/book/medication?add=${encodeURIComponent(r.name)}`} variant="secondary" size="xs">Refill</Button>
                  )}
                </div>
              );
            })}
          </Card>
        )}
        {(medOrders ?? []).length > 0 && (
          <Card padded={false} className="px-4 py-1">
            {(medOrders as any[]).map(o => {
              const [label, tone] = ORDER_LABELS[o.status] ?? [o.status, "idle" as PillTone];
              const names = (o.drugs as any[])?.map(d => d.drug_name).join(", ") || "Medicine order";
              return (
                <Row key={o.id}
                  href={o.status === "pending_payment" ? `/dashboard/book/medication/payment/${o.id}` : `/dashboard/medications/${o.id}`}
                  title={names}
                  sub={[o.pharmacy_partners?.name, day(o.created_at)].filter(Boolean).join(" · ")}
                  pill={<Pill tone={tone}>{label}</Pill>} />
              );
            })}
          </Card>
        )}
        <Button href="/dashboard/book/medication" block className="mt-3">
          <PillIcon size={18} aria-hidden /> Buy medication
        </Button>
      </Section>

      <Section title="Coming soon">
        <div className="grid gap-2.5">
          {SOON.map(({ icon: Icon, title, text }) => (
            <div key={title} aria-disabled="true"
              className="flex select-none items-center gap-3 rounded-[18px] border border-dashed border-muted/40 bg-surface px-3.5 py-3 opacity-70">
              <span className="grid h-[38px] w-[38px] flex-none place-items-center rounded-xl bg-pending-bg text-pending">
                <Icon size={20} aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <b className="block text-ds-sm text-pending">{title}</b>
                <small className="block text-ds-xs text-muted">{text}</small>
              </span>
              <span className="rounded-md bg-pending-bg px-2 py-0.5 text-ds-2xs font-bold uppercase tracking-[0.04em] text-pending">Soon</span>
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}
