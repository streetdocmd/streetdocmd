import Link from "next/link";
import {
  Wallet, Users, BadgeCheck, CircleCheck, Stethoscope, Building, ClipboardList,
  ChevronRight, TriangleAlert, FlaskConical, Pill, Hospital,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { createAdminSupabase } from "@/lib/supabase-server";
import { formatNaira } from "@/lib/shared";
import PageHeader from "@/components/ui/PageHeader";
import StatusBadge from "@/components/ui/StatusBadge";
import EmptyState from "@/components/ui/EmptyState";
import LiveRefresh from "@/components/ui/LiveRefresh";

export const dynamic = "force-dynamic";

const FACILITY_ICON: Record<string, LucideIcon> = { lab: FlaskConical, pharmacy: Pill, hospital: Hospital };

async function getData() {
  const supabase = createAdminSupabase();
  const today = new Date().toISOString().split("T")[0];

  const [completed, awaitingDispatch, verified, patients, revenue, providerQueue, facilityQueue, recentBookings] = await Promise.all([
    supabase.from("bookings").select("id", { count: "exact", head: true }).eq("status", "completed"),
    supabase.from("bookings").select("id", { count: "exact", head: true }).eq("status", "paid"),
    supabase.from("providers").select("id", { count: "exact", head: true }).eq("verification_status", "verified"),
    supabase.from("users").select("id", { count: "exact", head: true }).eq("role", "patient"),
    supabase.from("payments").select("amount").eq("status", "successful").gte("created_at", `${today}T00:00:00`),
    supabase
      .from("providers")
      .select("id, name, specialty, profession, verification_status, created_at", { count: "exact" })
      .in("verification_status", ["pending", "under_review"])
      .order("created_at", { ascending: true })
      .limit(6),
    supabase
      .from("facility_applications")
      .select("id, name, facility_type, status, city, created_at", { count: "exact" })
      .in("status", ["pending", "under_review"])
      .order("created_at", { ascending: true })
      .limit(6),
    supabase
      .from("bookings")
      .select("id, service_type, status, fee, patient_address, created_at")
      .order("created_at", { ascending: false })
      .limit(7),
  ]);

  return {
    stats: {
      completedVisits: completed.count ?? 0,
      awaitingDispatch: awaitingDispatch.count ?? 0,
      verifiedProviders: verified.count ?? 0,
      totalPatients: patients.count ?? 0,
      todayRevenue: (revenue.data ?? []).reduce((s, p) => s + Number(p.amount ?? 0), 0),
    },
    providerQueue: providerQueue.data ?? [],
    providerQueueCount: providerQueue.count ?? 0,
    facilityQueue: facilityQueue.data ?? [],
    facilityQueueCount: facilityQueue.count ?? 0,
    recentBookings: recentBookings.data ?? [],
  };
}

function ago(d: string) {
  const days = Math.floor((Date.now() - new Date(d).getTime()) / 86_400_000);
  if (days <= 0) return "Today";
  if (days === 1) return "1 day";
  return `${days} days`;
}

export default async function DashboardPage() {
  const { stats, providerQueue, providerQueueCount, facilityQueue, facilityQueueCount, recentBookings } = await getData();
  const needsAttention = providerQueueCount + facilityQueueCount + stats.awaitingDispatch;

  return (
    <div>
      <LiveRefresh sources={[{ table: "bookings" }, { table: "providers" }]} />
      <PageHeader
        title="Operations overview"
        description={new Date().toLocaleDateString("en-NG", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Today's revenue"    value={formatNaira(stats.todayRevenue)}           sub="Successful payments today" icon={Wallet} />
        <StatCard label="Registered patients" value={stats.totalPatients.toLocaleString()}     sub="Patient accounts"          icon={Users} />
        <StatCard label="Verified providers" value={stats.verifiedProviders.toLocaleString()} sub="Badge issued, can take visits" icon={BadgeCheck} />
        <StatCard label="Completed visits"   value={stats.completedVisits.toLocaleString()}   sub="All time"                  icon={CircleCheck} />
      </div>

      {needsAttention > 0 && (
        <div className="card border-amber-200 bg-amber-50/70 px-5 py-3.5 mb-6 flex flex-col sm:flex-row sm:items-center gap-3">
          <TriangleAlert size={18} className="text-amber-600 shrink-0" aria-hidden />
          <p className="text-sm text-amber-900 flex-1">
            <span className="font-semibold">Needs attention: </span>
            {[
              providerQueueCount > 0 && `${providerQueueCount} provider${providerQueueCount === 1 ? "" : "s"} awaiting verification`,
              facilityQueueCount > 0 && `${facilityQueueCount} facility application${facilityQueueCount === 1 ? "" : "s"}`,
              stats.awaitingDispatch > 0 && `${stats.awaitingDispatch} paid booking${stats.awaitingDispatch === 1 ? "" : "s"} awaiting a provider`,
            ].filter(Boolean).join(" · ")}
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Provider queue */}
        <QueueCard
          title="Provider verification queue"
          subtitle="Oldest first"
          href="/dashboard/providers?status=pending"
          count={providerQueueCount}
          icon={Stethoscope}
          emptyTitle="No providers waiting"
        >
          {providerQueue.map((p) => (
            <li key={p.id}>
              <Link href={`/dashboard/providers/${p.id}`} className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50 transition-colors">
                <div className="w-9 h-9 rounded-full bg-navy-700 flex items-center justify-center text-white text-sm font-bold shrink-0">
                  {p.name?.[0] ?? "?"}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{p.name}</p>
                  <p className="text-xs text-gray-400 truncate">{p.specialty}</p>
                </div>
                <StatusBadge status={p.verification_status} />
                <span className="text-xs text-gray-400 w-14 text-right shrink-0">{ago(p.created_at)}</span>
              </Link>
            </li>
          ))}
        </QueueCard>

        {/* Facility queue */}
        <QueueCard
          title="Facility applications"
          subtitle="Oldest first"
          href="/dashboard/facilities"
          count={facilityQueueCount}
          icon={Building}
          emptyTitle="No applications waiting"
        >
          {facilityQueue.map((f) => {
            const Icon = FACILITY_ICON[f.facility_type] ?? Building;
            return (
              <li key={f.id}>
                <Link href={`/dashboard/facilities/${f.id}`} className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50 transition-colors">
                  <div className="w-9 h-9 rounded-lg bg-blue-light text-blue-brand flex items-center justify-center shrink-0">
                    <Icon size={17} aria-hidden />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{f.name}</p>
                    <p className="text-xs text-gray-400 truncate capitalize">{f.facility_type}{f.city ? ` · ${f.city}` : ""}</p>
                  </div>
                  <StatusBadge status={f.status} />
                  <span className="text-xs text-gray-400 w-14 text-right shrink-0">{ago(f.created_at)}</span>
                </Link>
              </li>
            );
          })}
        </QueueCard>
      </div>

      {/* Recent bookings */}
      <section className="card">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">Recent bookings</h2>
            <p className="text-xs text-gray-400 mt-0.5">Latest consultation requests</p>
          </div>
          <Link href="/dashboard/bookings" className="text-xs text-blue-brand font-medium hover:underline inline-flex items-center gap-0.5">
            View all <ChevronRight size={13} aria-hidden />
          </Link>
        </div>
        {recentBookings.length === 0 ? (
          <EmptyState compact icon={ClipboardList} title="No bookings yet" />
        ) : (
          <div className="overflow-x-auto">
            <table className="table-base">
              <thead>
                <tr><th>Service</th><th>Address</th><th>Fee</th><th>Status</th><th>Created</th></tr>
              </thead>
              <tbody>
                {recentBookings.map((b) => (
                  <tr key={b.id}>
                    <td className="font-medium text-gray-900 capitalize whitespace-nowrap">{String(b.service_type ?? "").replace(/_/g, " ")}</td>
                    <td className="text-gray-500 max-w-xs truncate">{b.patient_address}</td>
                    <td className="font-medium text-gray-900 whitespace-nowrap">{formatNaira(Number(b.fee ?? 0))}</td>
                    <td><StatusBadge status={b.status} /></td>
                    <td className="text-gray-500 whitespace-nowrap">
                      {new Date(b.created_at).toLocaleDateString("en-NG", { day: "numeric", month: "short" })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function StatCard({ label, value, sub, icon: Icon }: { label: string; value: string; sub: string; icon: LucideIcon }) {
  return (
    <div className="card p-5 flex items-start gap-4">
      <div className="w-10 h-10 rounded-xl bg-blue-light text-blue-brand flex items-center justify-center shrink-0">
        <Icon size={19} aria-hidden />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-medium text-gray-500">{label}</p>
        <p className="text-2xl font-bold text-gray-900 mt-0.5 truncate">{value}</p>
        <p className="text-xs text-gray-400 mt-0.5">{sub}</p>
      </div>
    </div>
  );
}

function QueueCard({
  title, subtitle, href, count, icon, emptyTitle, children,
}: {
  title: string; subtitle: string; href: string; count: number; icon: LucideIcon; emptyTitle: string; children: React.ReactNode;
}) {
  return (
    <section className="card flex flex-col">
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
        <div>
          <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
            {title}
            {count > 0 && <span className="text-xs rounded-full bg-amber-100 text-amber-800 px-2 py-0.5">{count}</span>}
          </h2>
          <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>
        </div>
        <Link href={href} className="text-xs text-blue-brand font-medium hover:underline inline-flex items-center gap-0.5">
          View all <ChevronRight size={13} aria-hidden />
        </Link>
      </div>
      {count === 0 ? (
        <EmptyState compact icon={icon} title={emptyTitle} description="You're all caught up." />
      ) : (
        <ul className="divide-y divide-gray-50">{children}</ul>
      )}
    </section>
  );
}
