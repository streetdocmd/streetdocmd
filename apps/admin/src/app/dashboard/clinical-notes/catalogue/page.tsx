import { createAdminSupabase } from "@/lib/supabase-server";
import Link from "next/link";
import CatalogueActions from "./CatalogueActions";

export default async function CataloguePage() {
  const admin = createAdminSupabase();

  const { data: diagnoses } = await admin
    .from("streetdocmd_diagnoses")
    .select("*")
    .order("usage_count", { ascending: false });

  const list = diagnoses ?? [];

  const CATEGORIES = ["infectious", "respiratory", "cardiovascular", "endocrine", "neurological", "gastrointestinal", "musculoskeletal", "dermatological", "gynaecological", "mental_health", "geriatric", "general"];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link href="/dashboard/clinical-notes" className="text-sm text-gray-500 hover:underline">← Clinical Notes</Link>
          <h1 className="text-2xl font-bold text-gray-900 mt-1">Diagnosis Catalogue</h1>
          <p className="text-sm text-gray-500 mt-0.5">{list.length} diagnoses · sorted by usage</p>
        </div>
        <CatalogueActions categories={CATEGORIES} />
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                {["ICD-10", "Clinical Description", "Plain Language", "Category", "Uses", "Active", ""].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {list.map((d: any) => (
                <tr key={d.id} className={`hover:bg-gray-50 ${!d.active ? "opacity-50" : ""}`}>
                  <td className="px-4 py-3">
                    <span className="font-mono text-xs bg-gray-100 text-gray-600 rounded px-1.5 py-0.5">{d.icd10_code ?? "—"}</span>
                  </td>
                  <td className="px-4 py-3 text-gray-800 max-w-xs">{d.clinical_description}</td>
                  <td className="px-4 py-3 text-teal-700 font-medium">{d.plain_language}</td>
                  <td className="px-4 py-3">
                    <span className="text-xs bg-blue-50 text-blue-700 rounded-full px-2 py-0.5">{d.category}</span>
                  </td>
                  <td className="px-4 py-3 text-gray-500 font-medium">{d.usage_count ?? 0}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-medium ${d.active ? "text-green-600" : "text-gray-400"}`}>
                      {d.active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <CatalogueActions mode="row" diagnosis={d} categories={CATEGORIES} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
