import { createServerSupabase } from "@/lib/supabase-server";
import Link from "next/link";

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-700",
  under_review: "bg-blue-100 text-blue-700",
  verified: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-700",
};

export default async function ProvidersPage({
  searchParams,
}: {
  searchParams: { status?: string };
}) {
  const supabase = createServerSupabase();
  const status = searchParams.status ?? "pending";

  const { data: providers } = await supabase
    .from("providers")
    .select("id, name, specialty, credentials, verification_status, rating, total_visits, created_at")
    .eq("verification_status", status)
    .order("created_at", { ascending: true });

  const tabs = ["pending", "under_review", "verified", "rejected"];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Provider Management</h1>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-200">
        {tabs.map((t) => (
          <Link
            key={t}
            href={`/dashboard/providers?status=${t}`}
            className={`px-4 py-2 text-sm font-medium capitalize border-b-2 transition-colors ${
              status === t
                ? "border-brand-blue text-brand-blue"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {t.replace(/_/g, " ")}
          </Link>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-600 uppercase text-xs">
            <tr>
              <th className="text-left px-4 py-3">Name</th>
              <th className="text-left px-4 py-3">Specialty</th>
              <th className="text-left px-4 py-3">Credentials</th>
              <th className="text-left px-4 py-3">Status</th>
              <th className="text-left px-4 py-3">Rating</th>
              <th className="text-left px-4 py-3">Visits</th>
              <th className="text-left px-4 py-3">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {(providers ?? []).map((p) => (
              <tr key={p.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-900">{p.name}</td>
                <td className="px-4 py-3 text-gray-600">{p.specialty}</td>
                <td className="px-4 py-3 text-gray-600">{p.credentials}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs ${STATUS_STYLES[p.verification_status]}`}>
                    {p.verification_status.replace(/_/g, " ")}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-600">
                  {p.rating > 0 ? `${p.rating} ★` : "—"}
                </td>
                <td className="px-4 py-3 text-gray-600">{p.total_visits}</td>
                <td className="px-4 py-3">
                  <Link
                    href={`/dashboard/providers/${p.id}`}
                    className="text-brand-blue hover:underline"
                  >
                    Review
                  </Link>
                </td>
              </tr>
            ))}
            {(providers ?? []).length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-400">
                  No providers with status "{status.replace(/_/g, " ")}"
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
