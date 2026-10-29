export const dynamic = "force-dynamic";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Download } from "lucide-react";
import { createAdminSupabase, createServerSupabase } from "@/lib/supabase-server";
import CareChat from "@/components/CareChat";

// One care journey for admins: its chat (admins can write) and the full report
export default async function AdminJourneyPage({ params }: { params: { id: string } }) {
  const { data: { user } } = await (await createServerSupabase()).auth.getUser();
  if (!user) redirect("/login");

  const admin = createAdminSupabase();
  const { data: ep } = await admin
    .from("care_episodes")
    .select("id, title, reason, status, start_date, recovered_at, recovery_note, closed_at, users!patient_id(name), lead:providers!care_episodes_lead_provider_id_fkey(name)")
    .eq("id", params.id)
    .maybeSingle();
  if (!ep) notFound();
  const closed = ep.status === "closed" || ep.status === "resolved";

  return (
    <div className="max-w-3xl space-y-5">
      <Link href="/dashboard/journeys" className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-ink">
        <ArrowLeft size={16} aria-hidden /> Care journeys
      </Link>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-[26px] font-extrabold leading-tight tracking-[-0.02em] text-navy">{(ep.users as any)?.name ?? "Patient"} · {ep.title}</h1>
          <p className="mt-1 text-sm text-muted">
            {[`Started ${new Date(ep.start_date).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" })}`,
              (ep as any).lead?.name ? `led by ${(ep as any).lead.name}` : null,
              ep.recovered_at ? "patient confirmed recovery" : null,
              closed ? "closed" : ep.status].filter(Boolean).join(" · ")}
          </p>
          {ep.recovery_note && <p className="mt-1 text-sm text-ink/85">Patient: &ldquo;{ep.recovery_note}&rdquo;</p>}
        </div>
        <a href={`/api/admin/journeys/${ep.id}/report`} className="inline-flex items-center gap-2 rounded-pill border-[1.5px] border-line bg-surface px-4 py-2 text-sm font-bold text-navy hover:border-accent">
          <Download size={16} aria-hidden /> Download report
        </a>
      </div>
      <CareChat episodeId={ep.id} userId={user.id} closed={closed} />
    </div>
  );
}
