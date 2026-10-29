import Link from "next/link";
import { createServerSupabase } from "@/lib/supabase-server";
import { formatNaira } from "@/lib/shared";
import { Clock, FlaskConical, HeartPulse, Lock } from "lucide-react";
import { Card, Pill, TopBar, cx, focusRing } from "@/components/ds";
import { statusOf } from "@/lib/investigation-status";

export default async function LabInvestigationsPage() {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: pastOrders } = await supabase
    .from("investigation_orders")
    .select("id, status, ordered_at, tests, lab_partners(name)")
    .eq("patient_id", user.id)
    .order("ordered_at", { ascending: false })
    .limit(10);

  const { data: cheapestPackage } = await supabase
    .from("wellness_packages")
    .select("price")
    .eq("active", true)
    .order("price", { ascending: true })
    .limit(1)
    .maybeSingle();

  return (
    <div className="mx-auto max-w-2xl">
      <TopBar title="Wellness and labs" backHref="/dashboard" className="-mx-5 -mt-2 md:mx-0" />
      <p className="mb-4 text-ds-xs text-muted">
        Choose a wellness package, or pick the specific tests you need.
      </p>

      <div className="flex gap-2.5 rounded-ds bg-sky p-3 text-ds-xs leading-normal text-navy">
        <Lock size={18} className="mt-px flex-none text-brand" aria-hidden />
        <span><strong>Home sample collection.</strong> A trained collector visits you to take the sample.</span>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <Link href="/dashboard/book/wellness"
          className={cx("flex min-h-[148px] flex-col gap-[22px] rounded-ds-lg bg-tint-mint p-4 text-ink transition-transform active:scale-[0.98]", focusRing)}>
          <span className="grid h-11 w-11 place-items-center rounded-[14px] bg-white/70 text-navy"><HeartPulse size={22} aria-hidden /></span>
          <span>
            <b className="block text-ds-control text-navy">Wellness package</b>
            <small className="mt-[3px] block text-ds-xs leading-[1.35] text-ink/75">Routine screening bundled at a fixed price</small>
            <span className="mt-2 block text-ds-sm font-extrabold text-navy">
              {cheapestPackage ? `From ${formatNaira(cheapestPackage.price)}` : "View packages"}
            </span>
          </span>
        </Link>
        <Link href="/dashboard/book/lab-investigations/custom"
          className={cx("flex min-h-[148px] flex-col gap-[22px] rounded-ds-lg bg-tint-blue p-4 text-ink transition-transform active:scale-[0.98]", focusRing)}>
          <span className="grid h-11 w-11 place-items-center rounded-[14px] bg-white/70 text-navy"><FlaskConical size={22} aria-hidden /></span>
          <span>
            <b className="block text-ds-control text-navy">Specific tests</b>
            <small className="mt-[3px] block text-ds-xs leading-[1.35] text-ink/75">Pick exactly the tests you need</small>
            <span className="mt-2 block text-ds-sm font-extrabold text-navy">Priced per test</span>
          </span>
        </Link>
      </div>

      {pastOrders && pastOrders.length > 0 && (
        <section className="mt-[26px]">
          <h2 className="mb-3 text-[17px] font-bold text-navy">Your recent requests</h2>
          <Card padded={false} className="px-4 py-1">
            {pastOrders.map((o: any) => (
              <Link
                key={o.id}
                href={`/dashboard/investigations/${o.id}`}
                className={cx("flex items-center gap-3 border-b border-line py-3.5 last:border-b-0", focusRing)}
              >
                <span className="min-w-0 flex-1">
                  <b className="block truncate text-ds-sm text-ink">{(o.tests as any[])?.map(t => t.test_name).join(", ")}</b>
                  <small className="block text-ds-xs text-muted">
                    {o.lab_partners?.name ? `${o.lab_partners.name} · ` : ""}{new Date(o.ordered_at).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" })}
                  </small>
                </span>
                <Pill tone={statusOf(o.status).tone} icon={statusOf(o.status).tone === "info" ? Clock : undefined}>
                  {statusOf(o.status).label}
                </Pill>
              </Link>
            ))}
          </Card>
          <p className="mt-3 text-ds-sm text-muted">Open a request to follow it. Results appear there as soon as they are ready.</p>
        </section>
      )}
    </div>
  );
}
