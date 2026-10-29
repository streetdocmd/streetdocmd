import { notFound } from "next/navigation";
import { Check, Lock, TriangleAlert, X } from "lucide-react";
import { createAdminSupabase } from "@/lib/supabase-server";
import { Avatar, Card, EmergencyNotice, Pill, TopBar, VerifiedBadge } from "@/components/ds";
import { ratingSummary } from "@/lib/facility-reviews";

export const dynamic = "force-dynamic";

function updatedAgo(iso: string) {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60_000));
  if (mins < 60) return `Updated ${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 48) return `Updated ${hours} hour${hours === 1 ? "" : "s"} ago`;
  return `Updated ${Math.round(hours / 24)} days ago`;
}

// Design screen "Hospital profile": capacity in plain words, services, and what a referral shares
export default async function HospitalProfilePage({ params }: { params: { id: string } }) {
  const admin = createAdminSupabase();
  const { data: h } = await admin.from("hospital_partners").select("*").eq("id", params.id).eq("active", true).maybeSingle();
  if (!h) notFound();

  const { data: wards } = await admin
    .from("hospital_ward_capacity")
    .select("ward_name, free_beds, total_beds, updated_at")
    .eq("hospital_partner_id", params.id)
    .order("ward_name");
  const wardList = (wards ?? []) as { ward_name: string; free_beds: number; total_beds: number; updated_at: string }[];
  const lastUpdate = wardList.map(w => w.updated_at).sort().at(-1);
  const services: string[] = (h as any).services ?? [];

  return (
    <div className="mx-auto max-w-2xl">
      <TopBar title="" backHref="/dashboard/search?seg=facilities&filter=hospital" className="-mx-5 -mt-2 md:mx-0" />

      <Avatar name={h.name} size="lg" tint="var(--tint-rose)" />
      <h1 className="mt-3 text-[24px] font-extrabold leading-tight tracking-[-0.02em] text-navy">{h.name}</h1>
      <p className="mt-1 text-ds-sm text-muted">{["Hospital", h.address].filter(Boolean).join(" · ")}</p>
      <VerifiedBadge className="mt-2.5">Verified partner hospital</VerifiedBadge>

      <Card padded={false} className="mt-[18px] px-5 py-1">
        <dl>
          {[["Rating", ratingSummary(h as any)], ["Hours", (h as any).opening_hours], ["Phone", h.phone], ["Emergency", h.emergency_available ? "Emergency care available" : null]]
            .filter(([, v]) => v)
            .map(([k, v]) => (
              <div key={k} className="flex items-center justify-between gap-4 border-b border-line py-2.5 text-ds-sm last:border-b-0">
                <dt className="text-muted">{k}</dt>
                <dd className="text-right font-bold text-ink">{v}</dd>
              </div>
            ))}
        </dl>
      </Card>

      <section className="mt-[26px]">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-[17px] font-bold text-navy">Capacity today</h2>
          {lastUpdate && <span className="text-ds-sm text-muted">{updatedAgo(lastUpdate)}</span>}
        </div>
        {wardList.length > 0 ? (
          <Card padded={false} className="px-4 py-1">
            {wardList.map(w => {
              const full = w.free_beds === 0;
              const low = !full && w.free_beds <= 3;
              return (
                <div key={w.ward_name} className="flex items-center gap-3 border-b border-line py-3.5 last:border-b-0">
                  <b className="min-w-0 flex-1 text-ds-sm text-ink">{w.ward_name}</b>
                  {full
                    ? <Pill tone="bad" icon={X}>Fully booked</Pill>
                    : <Pill tone={low ? "warn" : "ok"} icon={low ? TriangleAlert : Check}>{w.free_beds} bed{w.free_beds === 1 ? "" : "s"} free</Pill>}
                </div>
              );
            })}
          </Card>
        ) : (
          <p className="text-ds-sm text-muted">This hospital hasn&apos;t shared its bed capacity yet. Call them to check.</p>
        )}
      </section>

      {services.length > 0 && (
        <section className="mt-[26px]">
          <h2 className="mb-3 text-[17px] font-bold text-navy">Services</h2>
          <div className="flex flex-wrap gap-1.5">
            {services.map(s => <span key={s} className="rounded-[10px] bg-surface px-2.5 py-[5px] text-ds-xs font-bold text-navy">{s}</span>)}
          </div>
        </section>
      )}

      <section className="mt-[26px] rounded-ds-lg border border-line bg-surface p-4">
        <b className="text-ds-control text-ink">Referrals</b>
        <p className="mb-2.5 mt-1.5 text-ds-sm text-muted">
          A provider refers you here after a visit. Until the hospital acknowledges your referral, it sees your first name,
          age and the referral letter from your provider, nothing more.
        </p>
        <div className="flex gap-2.5 rounded-ds bg-sky p-3 text-ds-xs leading-normal text-navy">
          <Lock size={18} className="mt-px flex-none text-brand" aria-hidden />
          <span>Your records stay private. You can see each referral in your visit record.</span>
        </div>
      </section>

      <EmergencyNotice className="mt-4" />
    </div>
  );
}
