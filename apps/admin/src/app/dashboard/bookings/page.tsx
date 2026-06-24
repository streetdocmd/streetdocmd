import { createServerSupabase } from "@/lib/supabase-server";
import { formatNaira } from "@streetdocmd/shared";

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-700",
  accepted: "bg-blue-100 text-blue-700",
  en_route: "bg-purple-100 text-purple-700",
  arrived: "bg-indigo-100 text-indigo-700",
  in_progress: "bg-orange-100 text-orange-700",
  completed: "bg-green-100 text-green-700",
  cancelled: "bg-red-100 text-red-700",
};

export default async function BookingsPage({
  searchParams,
}: {
  searchParams: { status?: string };
}) {
  const supabase = createServerSupabase();
  const status = searchParams.status;

  let query = supabase
    .from("bookings")
    .select("id, service_type, status, fee, patient_address, payment_status, created_at, patient_id, provider_id")
    .order("created_at", { ascending: false })
    .limit(50);

  if (status) query = query.eq("status", status);

  const { data: bookings } = await query;

  const tabs = ["all", "pending", "accepted", "en_route", "completed", "cancelled"];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Bookings</h1>

      <div className="flex gap-2 border-b border-gray-200">
        {tabs.map((t) => (
          <a
            key={t}
            href={t === "all" ? "/dashboard/bookings" : `/dashboard/bookings?status=${t}`}
            className={`px-4 py-2 text-sm font-medium capitalize border-b-2 transition-colors ${
              (t === "all" && !status) || status === t
                ? "border-brand-blue text-brand-blue"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {t.replace(/_/g, " ")}
          </a>
        ))}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-600 uppercase text-xs">
            <tr>
              <th className="text-left px-4 py-3">ID</th>
              <th className="text-left px-4 py-3">Service</th>
              <th className="text-left px-4 py-3">Address</th>
              <th className="text-left px-4 py-3">Fee</th>
              <th className="text-left px-4 py-3">Status</th>
              <th className="text-left px-4 py-3">Payment</th>
              <th className="text-left px-4 py-3">Date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {(bookings ?? []).map((b) => (
              <tr key={b.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-mono text-xs text-gray-500">
                  {b.id.slice(0, 8)}…
                </td>
                <td className="px-4 py-3 capitalize text-gray-900">
                  {b.service_type.replace(/_/g, " ")}
                </td>
                <td className="px-4 py-3 text-gray-600 max-w-xs truncate">{b.patient_address}</td>
                <td className="px-4 py-3 text-gray-900 font-medium">{formatNaira(b.fee)}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs ${STATUS_STYLES[b.status]}`}>
                    {b.status.replace(/_/g, " ")}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs ${b.payment_status === "successful" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"}`}>
                    {b.payment_status}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-500 text-xs">
                  {new Date(b.created_at).toLocaleDateString("en-NG")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
