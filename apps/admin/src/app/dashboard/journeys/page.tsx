export const dynamic = "force-dynamic";
import Link from "next/link";
import { ChevronRight, MessagesSquare } from "lucide-react";
import { createAdminSupabase } from "@/lib/supabase-server";

const STATUS_LABEL: Record<string, string> = {
  active: "Active", monitoring: "Monitoring", follow_up_due: "Follow up due", overdue: "Overdue",
  referred: "Referred", resolved: "Resolved", closed: "Closed", escalated: "Escalated",
};

// Every care journey and its chat (migration 068), most recently active first
export default async function JourneysPage({ searchParams }: { searchParams: { show?: string } }) {
  const admin = createAdminSupabase();
  const showClosed = searchParams.show === "closed";
  let q = admin
    .from("care_episodes")
    .select("id, title, status, start_date, recovered_at, updated_at, users!patient_id(name), lead:providers!care_episodes_lead_provider_id_fkey(name)")
    .order("updated_at", { ascending: false })
    .limit(200);
  q = showClosed ? q.in("status", ["closed", "resolved"]) : q.not("status", "in", "(closed,resolved)");
  const { data: journeys } = await q;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[26px] font-extrabold leading-tight tracking-[-0.02em] text-navy">Care journeys</h1>
        <p className="mt-1 text-sm text-muted">Each visit and everything that follows it: tests, medicines, referrals and the care team&apos;s conversation.</p>
      </div>
      <div className="flex gap-2 text-sm">
        <Link href="/dashboard/journeys" className={`rounded-pill px-4 py-2 font-semibold ${!showClosed ? "bg-navy text-white" : "bg-page text-muted"}`}>Open</Link>
        <Link href="/dashboard/journeys?show=closed" className={`rounded-pill px-4 py-2 font-semibold ${showClosed ? "bg-navy text-white" : "bg-page text-muted"}`}>Closed</Link>
      </div>
      {(journeys ?? []).length === 0 ? (
        <div className="rounded-ds-lg border border-line bg-surface p-12 text-center">
          <MessagesSquare size={22} className="mx-auto mb-2 text-muted" aria-hidden />
          <p className="font-semibold text-ink">No journeys here</p>
        </div>
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-ds-lg border border-line bg-surface">
          {(journeys as any[]).map(j => (
            <li key={j.id}>
              <Link href={`/dashboard/journeys/${j.id}`} className="flex items-center gap-4 px-5 py-3.5 hover:bg-page">
                <span className="min-w-0 flex-1">
                  <b className="block truncate text-sm text-ink">{j.users?.name ?? "Patient"} · {j.title}</b>
                  <small className="text-xs text-muted">
                    {STATUS_LABEL[j.status] ?? j.status}{j.lead?.name ? ` · led by ${j.lead.name}` : ""}{j.recovered_at ? " · patient recovered" : ""} · updated {new Date(j.updated_at).toLocaleDateString("en-NG", { day: "numeric", month: "short" })}
                  </small>
                </span>
                <ChevronRight size={18} className="text-muted" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
