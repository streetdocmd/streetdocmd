export const dynamic = "force-dynamic";
import { createAdminSupabase } from "@/lib/supabase-server";

export default async function PatientsPage({
  searchParams,
}: {
  searchParams: { q?: string };
}) {
  const supabase = createAdminSupabase();
  const q = searchParams.q?.trim() ?? "";

  let query = supabase
    .from("users")
    .select("id, name, phone, blood_group, known_conditions, created_at, role")
    .eq("role", "patient")
    .order("created_at", { ascending: false });

  if (q) {
    query = query.or(`name.ilike.%${q}%,phone.ilike.%${q}%`);
  }

  const { data: patients } = await query.limit(100);

  // Fetch booking counts for all returned patients
  const ids = (patients ?? []).map((p) => p.id);
  const { data: bookingCounts } = ids.length
    ? await supabase
        .from("bookings")
        .select("patient_id")
        .in("patient_id", ids)
    : { data: [] };

  const countMap: Record<string, number> = {};
  for (const b of bookingCounts ?? []) {
    countMap[b.patient_id] = (countMap[b.patient_id] ?? 0) + 1;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Patients</h1>
        <span className="text-sm text-gray-400">{(patients ?? []).length} shown</span>
      </div>

      {/* Search */}
      <form method="GET" className="flex flex-col sm:flex-row gap-2">
        <input
          name="q"
          defaultValue={q}
          placeholder="Search by name or phone…"
          className="flex-1 border border-gray-200 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <div className="flex gap-2">
          <button
            type="submit"
            className="flex-1 sm:flex-none px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            Search
          </button>
          {q && (
            <a
              href="/dashboard/patients"
              className="flex-1 sm:flex-none text-center px-4 py-2 border border-gray-200 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors text-gray-600"
            >
              Clear
            </a>
          )}
        </div>
      </form>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600 uppercase text-xs">
              <tr>
                <th className="text-left px-4 py-3">Name</th>
                <th className="text-left px-4 py-3">Phone</th>
                <th className="text-left px-4 py-3">Blood Group</th>
                <th className="text-left px-4 py-3">Conditions</th>
                <th className="text-left px-4 py-3">Bookings</th>
                <th className="text-left px-4 py-3">Joined</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {(patients ?? []).map((p) => (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{p.name}</td>
                  <td className="px-4 py-3 text-gray-600">
                    <a href={`tel:${p.phone}`} className="hover:underline">{p.phone}</a>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{p.blood_group ?? "—"}</td>
                  <td className="px-4 py-3 text-gray-500 max-w-[200px] truncate">
                    {(p.known_conditions ?? []).length > 0
                      ? p.known_conditions.join(", ")
                      : <span className="text-gray-300">None recorded</span>}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      (countMap[p.id] ?? 0) > 0
                        ? "bg-blue-100 text-blue-700"
                        : "bg-gray-100 text-gray-500"
                    }`}>
                      {countMap[p.id] ?? 0}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-xs">
                    {new Date(p.created_at).toLocaleDateString("en-NG", {
                      day: "numeric", month: "short", year: "numeric",
                    })}
                  </td>
                </tr>
              ))}
              {(patients ?? []).length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                    {q ? `No patients matching "${q}"` : "No patients yet"}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}