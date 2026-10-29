import Link from "next/link";
import { ClipboardList } from "lucide-react";
import { createServerSupabase } from "@/lib/supabase-server";
import { formatNaira } from "@/lib/shared";
import PageHeader from "@/components/ui/PageHeader";
import StatusBadge from "@/components/ui/StatusBadge";
import EmptyState from "@/components/ui/EmptyState";
import LiveRefresh from "@/components/ui/LiveRefresh";

export const dynamic = "force-dynamic";

const TABS = ["all", "pending", "accepted", "en_route", "completed", "cancelled"];

export default async function BookingsPage({
  searchParams,
}: {
  searchParams: { status?: string };
}) {
  const supabase = createServerSupabase();
  const status = searchParams.status && TABS.includes(searchParams.status) && searchParams.status !== "all" ? searchParams.status : undefined;

  let query = supabase
    .from("bookings")
    .select("id, service_type, status, fee, patient_address, payment_status, created_at, patient_id, provider_id")
    .order("created_at", { ascending: false })
    .limit(50);

  if (status) query = query.eq("status", status);

  const { data: bookings, error } = await query;
  if (error) throw new Error(`Could not load bookings: ${error.message}`);
  const rows = bookings ?? [];

  return (
    <div>
      <LiveRefresh sources={[{ table: "bookings" }]} />
      <PageHeader title="Bookings" description="The 50 most recent consultation requests. Open one to see everything about it." />

      <div className="card">
        <nav className="flex gap-1 overflow-x-auto px-4 pt-3 border-b border-gray-100" aria-label="Booking status">
          {TABS.map((t) => {
            const active = (t === "all" && !status) || status === t;
            return (
              <Link
                key={t}
                href={t === "all" ? "/dashboard/bookings" : `/dashboard/bookings?status=${t}`}
                aria-current={active ? "page" : undefined}
                className={`-mb-px px-3 py-2.5 text-sm font-medium capitalize border-b-2 transition-colors whitespace-nowrap ${
                  active ? "border-blue-brand text-blue-brand" : "border-transparent text-gray-500 hover:text-gray-800"
                }`}
              >
                {t.replace(/_/g, " ")}
              </Link>
            );
          })}
        </nav>

        {rows.length === 0 ? (
          <EmptyState icon={ClipboardList} title="No bookings" description={status ? "No bookings with this status." : "Bookings will appear here as patients request visits."} />
        ) : (
          <div className="overflow-x-auto">
            <table className="table-base">
              <thead>
                <tr><th>ID</th><th>Service</th><th>Address</th><th>Fee</th><th>Status</th><th>Payment</th><th>Date</th><th><span className="sr-only">Details</span></th></tr>
              </thead>
              <tbody>
                {rows.map((b) => (
                  <tr key={b.id}>
                    <td className="font-mono text-xs"><Link href={`/dashboard/bookings/${b.id}`} className="text-gray-500 hover:text-blue-brand hover:underline">{b.id.slice(0, 8)}…</Link></td>
                    <td className="capitalize whitespace-nowrap"><Link href={`/dashboard/bookings/${b.id}`} className="text-gray-900 hover:text-blue-brand hover:underline">{String(b.service_type ?? "").replace(/_/g, " ")}</Link></td>
                    <td className="text-gray-600 max-w-xs truncate">{b.patient_address}</td>
                    <td className="text-gray-900 font-medium whitespace-nowrap">{formatNaira(Number(b.fee ?? 0))}</td>
                    <td><StatusBadge status={b.status} /></td>
                    <td>{b.payment_status ? <StatusBadge status={b.payment_status} tone={b.payment_status === "paid" || b.payment_status === "successful" ? "success" : undefined} /> : <span className="text-gray-400">—</span>}</td>
                    <td className="text-gray-500 whitespace-nowrap">{new Date(b.created_at).toLocaleDateString("en-NG")}</td>
                    <td className="whitespace-nowrap text-right"><Link href={`/dashboard/bookings/${b.id}`} className="text-sm font-semibold text-blue-brand hover:underline">View</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
