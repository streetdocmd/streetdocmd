import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronRight, MessagesSquare } from "lucide-react";
import { createAdminSupabase, createServerSupabase } from "@/lib/supabase-server";
import { Card, Pill, TopBar, cx, focusRing } from "@/components/ds";

export const dynamic = "force-dynamic";

// The care journeys this provider is part of (migration 068), open first
export default async function JourneysPage() {
  const { data: { user } } = await (await createServerSupabase()).auth.getUser();
  if (!user) redirect("/login");

  const admin = createAdminSupabase();
  const { data: provider } = await admin.from("providers").select("id").eq("user_id", user.id).maybeSingle();
  if (!provider) redirect("/dashboard");

  const [{ data: memberships }, { data: viaVisits }] = await Promise.all([
    admin.from("care_team_members").select("care_episode_id").eq("provider_id", provider.id),
    admin.from("bookings").select("care_episode_id").eq("provider_id", provider.id).not("care_episode_id", "is", null).limit(500),
  ]);
  const ids = Array.from(new Set([...(memberships ?? []), ...(viaVisits ?? [])].map((r: any) => r.care_episode_id).filter(Boolean)));
  const { data: journeys } = ids.length
    ? await admin.from("care_episodes").select("id, title, status, recovered_at, updated_at, users!patient_id(name)").in("id", ids).order("updated_at", { ascending: false })
    : { data: [] };
  const rows = ((journeys ?? []) as any[]).sort((a, b) => Number(["closed", "resolved"].includes(a.status)) - Number(["closed", "resolved"].includes(b.status)));

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <TopBar title="Care journeys" backHref="/dashboard" className="-mx-5 -mt-2 md:mx-0" />
      <p className="text-ds-sm text-muted">Every patient you&apos;ve cared for, with the care team chat and updates on tests, medicines and referrals.</p>
      {rows.length === 0 ? (
        <Card className="text-center">
          <MessagesSquare size={22} className="mx-auto mb-2 text-muted" aria-hidden />
          <p className="text-ds-sm text-muted">No care journeys yet. One starts each time you accept a visit.</p>
        </Card>
      ) : (
        <Card padded={false} className="px-4 py-1">
          {rows.map(j => {
            const closed = ["closed", "resolved"].includes(j.status);
            return (
              <Link key={j.id} href={`/dashboard/journeys/${j.id}`} className={cx("flex items-center gap-3 border-b border-line py-3.5 last:border-b-0", focusRing)}>
                <span className="min-w-0 flex-1">
                  <b className="block truncate text-ds-sm text-ink">{j.users?.name ?? "Patient"} · {j.title}</b>
                  <small className="text-ds-xs text-muted">Updated {new Date(j.updated_at).toLocaleDateString("en-NG", { day: "numeric", month: "short" })}</small>
                </span>
                {closed ? <Pill tone="idle">Closed</Pill> : j.recovered_at ? <Pill tone="ok">Recovered</Pill> : <Pill tone="info">Active</Pill>}
                <ChevronRight size={18} className="text-muted" aria-hidden />
              </Link>
            );
          })}
        </Card>
      )}
    </div>
  );
}
