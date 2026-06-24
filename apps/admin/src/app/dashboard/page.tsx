import { createServerSupabase } from "@/lib/supabase-server";
import { formatNaira } from "@streetdocmd/shared";
import Link from "next/link";

async function getStats() {
  const supabase = createServerSupabase();
  const today = new Date().toISOString().split("T")[0];

  const [completed, pending, verified, patients, revenue] = await Promise.all([
    supabase.from("bookings").select("id", { count: "exact", head: true }).eq("status", "completed"),
    supabase.from("bookings").select("id", { count: "exact", head: true }).eq("status", "pending"),
    supabase.from("providers").select("id", { count: "exact", head: true }).eq("verification_status", "verified"),
    supabase.from("users").select("id", { count: "exact", head: true }).eq("role", "patient"),
    supabase.from("payments").select("amount").eq("status", "successful").gte("created_at", `${today}T00:00:00`),
  ]);

  return {
    completedVisits:  completed.count ?? 0,
    pendingBookings:  pending.count ?? 0,
    verifiedProviders: verified.count ?? 0,
    totalPatients:    patients.count ?? 0,
    todayRevenue:     (revenue.data ?? []).reduce((s, p) => s + p.amount, 0),
  };
}

async function getPendingVerifications() {
  const supabase = createServerSupabase();
  const { data } = await supabase
    .from("providers")
    .select("id, name, specialty, credentials, created_at")
    .eq("verification_status", "pending")
    .order("created_at", { ascending: true })
    .limit(6);
  return data ?? [];
}

async function getRecentBookings() {
  const supabase = createServerSupabase();
  const { data } = await supabase
    .from("bookings")
    .select("id, service_type, status, fee, patient_address, created_at")
    .order("created_at", { ascending: false })
    .limit(7);
  return data ?? [];
}

export default async function DashboardPage() {
  const [stats, pendingVerifications, recentBookings] = await Promise.all([
    getStats(),
    getPendingVerifications(),
    getRecentBookings(),
  ]);

  return (
    <div className="space-y-6 max-w-7xl">

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Today's Revenue"    value={formatNaira(stats.todayRevenue)}            sub="Platform gross"           icon={<RevenueIcon />}  color="blue"   />
        <StatCard label="Active Patients"    value={stats.totalPatients.toLocaleString()}        sub="Registered accounts"      icon={<PatientIcon />}  color="purple" />
        <StatCard label="Verified Providers" value={stats.verifiedProviders.toLocaleString()}    sub="On-platform & active"     icon={<ProviderIcon />} color="teal"   />
        <StatCard label="Completed Visits"   value={stats.completedVisits.toLocaleString()}      sub="All time"                 icon={<VisitIcon />}    color="green"  />
      </div>

      {/* Alert bar */}
      {(stats.pendingBookings > 0 || pendingVerifications.length > 0) && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-5 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-amber-500 text-lg">⚠️</span>
            <div>
              <p className="text-sm font-semibold text-amber-800">Attention required</p>
              <p className="text-xs text-amber-600">
                {pendingVerifications.length > 0 && `${pendingVerifications.length} provider verification${pendingVerifications.length > 1 ? "s" : ""} pending`}
                {pendingVerifications.length > 0 && stats.pendingBookings > 0 && " · "}
                {stats.pendingBookings > 0 && `${stats.pendingBookings} booking${stats.pendingBookings > 1 ? "s" : ""} awaiting dispatch`}
              </p>
            </div>
          </div>
          <Link href="/dashboard/providers" className="text-xs font-semibold text-amber-700 hover:text-amber-900 underline underline-offset-2">
            Review →
          </Link>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

        {/* Pending Verifications */}
        <div className="lg:col-span-3 page-card">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <div>
              <h2 className="text-sm font-semibold text-gray-900">Pending Verifications</h2>
              <p className="text-xs text-gray-400 mt-0.5">Providers awaiting MDCN/NMCN review</p>
            </div>
            <Link href="/dashboard/providers" className="text-xs text-blue-brand font-medium hover:underline">View all →</Link>
          </div>
          {pendingVerifications.length === 0 ? (
            <div className="px-5 py-10 text-center">
              <p className="text-3xl mb-2">✅</p>
              <p className="text-sm text-gray-500 font-medium">All clear — no pending verifications</p>
            </div>
          ) : (
            <ul className="divide-y divide-gray-50">
              {pendingVerifications.map((p) => (
                <li key={p.id} className="flex items-center justify-between px-5 py-3.5 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-navy-700 flex items-center justify-center text-white text-sm font-bold shrink-0">
                      {p.name[0]}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{p.name}</p>
                      <p className="text-xs text-gray-400">{p.specialty} · {p.credentials}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-gray-400">
                      {new Date(p.created_at).toLocaleDateString("en-NG", { day: "numeric", month: "short" })}
                    </span>
                    <Link href={`/dashboard/providers/${p.id}`} className="btn-primary text-xs py-1.5 px-3">
                      Review
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Recent Bookings */}
        <div className="lg:col-span-2 page-card">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <div>
              <h2 className="text-sm font-semibold text-gray-900">Recent Bookings</h2>
              <p className="text-xs text-gray-400 mt-0.5">Latest consultation requests</p>
            </div>
            <Link href="/dashboard/bookings" className="text-xs text-blue-brand font-medium hover:underline">View all →</Link>
          </div>
          {recentBookings.length === 0 ? (
            <div className="px-5 py-10 text-center">
              <p className="text-3xl mb-2">📋</p>
              <p className="text-sm text-gray-500 font-medium">No bookings yet</p>
            </div>
          ) : (
            <ul className="divide-y divide-gray-50">
              {recentBookings.map((b) => (
                <li key={b.id} className="px-5 py-3.5">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-sm font-semibold text-gray-900 capitalize">
                      {b.service_type.replace(/_/g, " ")}
                    </p>
                    <StatusPill status={b.status} />
                  </div>
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-gray-400 truncate max-w-[130px]">{b.patient_address}</p>
                    <p className="text-xs font-bold text-gray-700">{formatNaira(b.fee)}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Sub-components ── */

function StatCard({ label, value, sub, icon, color }: {
  label: string; value: string; sub: string; icon: React.ReactNode;
  color: "blue" | "purple" | "teal" | "green";
}) {
  const p = {
    blue:   { bg: "bg-blue-50",   text: "text-blue-brand", ring: "bg-blue-100"   },
    purple: { bg: "bg-purple-50", text: "text-purple-700", ring: "bg-purple-100" },
    teal:   { bg: "bg-teal-50",   text: "text-teal-700",   ring: "bg-teal-100"   },
    green:  { bg: "bg-green-50",  text: "text-green-700",  ring: "bg-green-100"  },
  }[color];
  return (
    <div className="stat-card flex items-start gap-4">
      <div className={`${p.ring} w-10 h-10 rounded-xl flex items-center justify-center shrink-0 mt-0.5`}>
        <div className={p.text}>{icon}</div>
      </div>
      <div>
        <p className="text-xs text-gray-500 font-medium">{label}</p>
        <p className={`text-2xl font-bold mt-0.5 ${p.text}`}>{value}</p>
        <p className="text-xs text-gray-400 mt-0.5">{sub}</p>
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const s: Record<string, string> = {
    pending:     "bg-yellow-50 text-yellow-700 border-yellow-200",
    accepted:    "bg-blue-50 text-blue-700 border-blue-200",
    en_route:    "bg-purple-50 text-purple-700 border-purple-200",
    in_progress: "bg-orange-50 text-orange-700 border-orange-200",
    completed:   "bg-green-50 text-green-700 border-green-200",
    cancelled:   "bg-red-50 text-red-700 border-red-200",
  };
  return (
    <span className={`badge border ${s[status] ?? "bg-gray-50 text-gray-600 border-gray-200"}`}>
      {status.replace(/_/g, " ")}
    </span>
  );
}

function RevenueIcon()  { return <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>; }
function PatientIcon()  { return <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>; }
function ProviderIcon() { return <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>; }
function VisitIcon()    { return <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>; }
