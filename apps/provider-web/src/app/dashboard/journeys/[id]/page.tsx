import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createAdminSupabase, createServerSupabase } from "@/lib/supabase-server";
import { Card, Pill, TopBar } from "@/components/ds";
import CareChat from "@/components/CareChat";
import JourneyActions from "./JourneyActions";

export const dynamic = "force-dynamic";

// A care journey for its clinicians (migration 068): the chat with the
// facilities and StreetdocMD, closing it, and its report
export default async function ProviderJourneyPage({ params }: { params: { id: string } }) {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: allowed } = await supabase.rpc("care_chat_access", { p_episode: params.id });
  if (!allowed) notFound();

  const admin = createAdminSupabase();
  const [{ data: ep }, { data: requests }] = await Promise.all([
    admin.from("care_episodes")
      .select("id, title, reason, status, start_date, recovered_at, recovery_note, patient_id, users!patient_id(name, dob), lead:providers!care_episodes_lead_provider_id_fkey(name)")
      .eq("id", params.id).maybeSingle(),
    admin.from("care_report_requests").select("id, status, review_note, created_at")
      .eq("care_episode_id", params.id).eq("requested_by", user.id).order("created_at", { ascending: false }),
  ]);
  if (!ep) notFound();

  const patient = ep.users as any;
  const age = patient?.dob ? Math.floor((Date.now() - new Date(patient.dob).getTime()) / (365.25 * 86_400_000)) : null;
  const closed = ep.status === "closed" || ep.status === "resolved";

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <TopBar title="Care journey" backHref="/dashboard/journeys" className="-mx-5 -mt-2 md:mx-0" />

      <div>
        <div className="flex flex-wrap items-center gap-2">
          {closed ? <Pill tone="idle">Closed</Pill> : ep.recovered_at ? <Pill tone="ok">Patient recovered</Pill> : <Pill tone="info">Active</Pill>}
          {(ep as any).lead?.name && <span className="text-ds-sm text-muted">Led by {(ep as any).lead.name}</span>}
        </div>
        <h1 className="mt-2 text-[24px] font-extrabold leading-tight tracking-[-0.02em] text-navy">
          {patient?.name ?? "Patient"}{age != null ? `, ${age}` : ""} · {ep.title}
        </h1>
        {ep.reason && <p className="mt-1 text-ds-sm text-muted">{ep.reason}</p>}
        <Link href={`/dashboard/patients/${ep.patient_id}`} className="mt-1 inline-block text-ds-sm font-bold text-accent hover:underline">Open patient record</Link>
      </div>

      {ep.recovered_at && !closed && (
        <Card className="text-ds-sm">
          <b className="text-ink">The patient says they&apos;ve recovered</b>
          {ep.recovery_note && <p className="mt-1 text-ink/85">&ldquo;{ep.recovery_note}&rdquo;</p>}
          <p className="mt-1 text-muted">Close the journey when everything is done. It closes by itself 7 days after recovery if nothing is open.</p>
        </Card>
      )}

      <JourneyActions episodeId={ep.id} closed={closed} recovered={!!ep.recovered_at} requests={(requests ?? []) as any} />
      <CareChat episodeId={ep.id} userId={user.id} closed={closed} />
    </div>
  );
}
