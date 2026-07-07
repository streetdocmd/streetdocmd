"use client";
import { useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function AssignIcd10({
  diagnosisIds, description,
}: {
  diagnosisIds: string[];
  description: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const [addToCatalogue, setAddToCatalogue] = useState(false);
  const [plain, setPlain] = useState("");
  const [category, setCategory] = useState("general");

  const search = async (q: string) => {
    setQuery(q);
    if (q.length < 2) { setResults([]); return; }
    const { data } = await supabase
      .from("icd10_full")
      .select("code, description")
      .or(`description.ilike.%${q}%,code.ilike.%${q}%`)
      .limit(8);
    setResults(data ?? []);
  };

  const assign = async (code: string, desc: string) => {
    setLoading(true);
    for (const id of diagnosisIds) {
      await supabase
        .from("clinical_note_diagnoses")
        .update({ icd10_code: code, source: "icd10_full", is_uncodified: false })
        .eq("id", id);
    }
    if (addToCatalogue && plain) {
      await supabase.from("streetdocmd_diagnoses").insert({
        icd10_code: code,
        clinical_description: desc,
        plain_language: plain,
        category,
        is_curated: true,
      });
    }
    setLoading(false);
    setDone(true);
    setOpen(false);
  };

  if (done) return <span className="text-xs text-green-600 font-medium">✓ Assigned</span>;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="text-xs bg-blue-50 text-blue-700 border border-blue-200 rounded-lg px-3 py-1.5 font-medium hover:bg-blue-100 transition-colors"
      >
        Assign ICD-10
      </button>

      {open && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900">Assign ICD-10 Code</h3>
              <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <div className="p-5 space-y-4">
              <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-sm text-amber-800">
                Provider wrote: <strong>"{description}"</strong>
              </div>

              <input
                type="text"
                value={query}
                onChange={e => search(e.target.value)}
                placeholder="Search ICD-10 codes..."
                autoFocus
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />

              {results.length > 0 && (
                <div className="border border-gray-200 rounded-xl overflow-hidden max-h-48 overflow-y-auto">
                  {results.map(r => (
                    <button
                      key={r.code}
                      onClick={() => assign(r.code, r.description)}
                      disabled={loading}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-blue-50 text-left border-b border-gray-50 last:border-0"
                    >
                      <span className="text-xs font-mono bg-gray-100 text-gray-600 rounded px-1.5 py-0.5 shrink-0">{r.code}</span>
                      <span className="text-sm text-gray-800">{r.description}</span>
                    </button>
                  ))}
                </div>
              )}

              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={addToCatalogue} onChange={e => setAddToCatalogue(e.target.checked)} className="accent-blue-600" />
                <span className="text-sm text-gray-700">Also add to StreetdocMD curated catalogue</span>
              </label>

              {addToCatalogue && (
                <div className="space-y-2">
                  <input
                    type="text"
                    value={plain}
                    onChange={e => setPlain(e.target.value)}
                    placeholder="Plain language for patients (e.g. 'Malaria')"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <select
                    value={category}
                    onChange={e => setCategory(e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  >
                    {["infectious", "respiratory", "cardiovascular", "endocrine", "neurological", "gastrointestinal", "musculoskeletal", "dermatological", "gynaecological", "mental_health", "geriatric", "general"].map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
