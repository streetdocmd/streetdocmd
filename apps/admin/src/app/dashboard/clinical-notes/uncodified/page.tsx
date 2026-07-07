import { createAdminSupabase } from "@/lib/supabase-server";
import Link from "next/link";
import AssignIcd10 from "./AssignIcd10";

export default async function UncodifiedPage() {
  const admin = createAdminSupabase();

  const { data: diagnoses } = await admin
    .from("clinical_note_diagnoses")
    .select("id, clinical_description, plain_language_diagnosis, created_at, providers(name), patient_id")
    .eq("is_uncodified", true)
    .order("created_at", { ascending: false });

  const list = diagnoses ?? [];

  // Group by clinical_description
  const grouped: Record<string, { items: any[]; count: number }> = {};
  list.forEach(d => {
    const k = d.clinical_description;
    if (!grouped[k]) grouped[k] = { items: [], count: 0 };
    grouped[k].items.push(d);
    grouped[k].count++;
  });

  const sorted = Object.entries(grouped).sort((a, b) => b[1].count - a[1].count);

  return (
    <div className="space-y-6">
      <div>
        <Link href="/dashboard/clinical-notes" className="text-sm text-gray-500 hover:underline">← Clinical Notes</Link>
        <h1 className="text-2xl font-bold text-gray-900 mt-1">Uncodified Diagnoses</h1>
        <p className="text-sm text-gray-500 mt-0.5">{list.length} total · {sorted.length} unique — review and assign ICD-10 codes</p>
      </div>

      {sorted.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
          <p className="text-4xl mb-3">✅</p>
          <p className="font-semibold text-gray-700">No uncodified diagnoses</p>
          <p className="text-sm text-gray-400 mt-1">All diagnoses have been assigned ICD-10 codes.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                {["Free-text Diagnosis", "Frequency", "Latest Provider", "Date", "Actions"].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {sorted.map(([description, { items, count }]) => {
                const latest = items[0];
                return (
                  <tr key={description} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-800">{description}</p>
                      {latest.plain_language_diagnosis && <p className="text-xs text-gray-400 mt-0.5">Patient sees: "{latest.plain_language_diagnosis}"</p>}
                    </td>
                    <td className="px-4 py-3">
                      <span className="bg-amber-100 text-amber-700 rounded-full px-2.5 py-1 text-xs font-bold">{count}</span>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{(latest.providers as any)?.name ?? "—"}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
                      {latest.created_at ? new Date(latest.created_at).toLocaleDateString("en-NG", { day: "numeric", month: "short" }) : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <AssignIcd10 diagnosisIds={items.map(i => i.id)} description={description} />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
