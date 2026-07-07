"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export type DiagnosisEntry = {
  id?: string;
  source: "curated" | "icd10_full" | "manual_override";
  icd10_code: string;
  clinical_description: string;
  plain_language_diagnosis: string;
  diagnosis_type: "primary" | "secondary";
  is_uncodified: boolean;
};

export default function DiagnosisSearchWidget({
  index, providerId, value, onChange, onRemove,
}: {
  index: number;
  providerId: string;
  value: DiagnosisEntry | null;
  onChange: (d: DiagnosisEntry) => void;
  onRemove?: () => void;
}) {
  const [query, setQuery] = useState("");
  const [curated, setCurated] = useState<any[]>([]);
  const [icd10, setIcd10] = useState<any[]>([]);
  const [favourites, setFavourites] = useState<any[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selected, setSelected] = useState<DiagnosisEntry | null>(value);
  const [isManual, setIsManual] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>();

  // Load curated diagnoses into localStorage cache on mount
  useEffect(() => {
    const cached = localStorage.getItem("smd_diagnoses");
    if (!cached) {
      supabase.from("streetdocmd_diagnoses").select("*").eq("active", true).then(({ data }) => {
        if (data) localStorage.setItem("smd_diagnoses", JSON.stringify(data));
      });
    }
  }, []);

  // Load provider favourites
  useEffect(() => {
    supabase
      .from("clinical_note_diagnoses")
      .select("clinical_description, plain_language_diagnosis, icd10_code, provider_id")
      .eq("provider_id", providerId)
      .then(({ data }) => {
        if (!data) return;
        const freq: Record<string, any & { count: number }> = {};
        data.forEach(d => {
          const k = d.icd10_code || d.clinical_description;
          if (!freq[k]) freq[k] = { ...d, count: 0 };
          freq[k].count++;
        });
        setFavourites(Object.values(freq).sort((a, b) => b.count - a.count).slice(0, 10));
      });
  }, [providerId]);

  const searchCurated = useCallback((q: string) => {
    const cached = localStorage.getItem("smd_diagnoses");
    if (!cached) return [];
    const all = JSON.parse(cached) as any[];
    const ql = q.toLowerCase();
    return all
      .filter(d => d.clinical_description?.toLowerCase().includes(ql) || d.plain_language?.toLowerCase().includes(ql) || d.icd10_code?.toLowerCase().includes(ql))
      .sort((a, b) => (b.usage_count ?? 0) - (a.usage_count ?? 0))
      .slice(0, 5);
  }, []);

  const searchIcd10 = useCallback(async (q: string) => {
    try {
      const { data } = await supabase
        .from("icd10_full")
        .select("code, description")
        .textSearch("description", q, { config: "english", type: "plain" })
        .limit(5);
      return data ?? [];
    } catch { return []; }
  }, []);

  useEffect(() => {
    clearTimeout(timer.current);
    if (query.length < 2) { setCurated([]); setIcd10([]); return; }
    timer.current = setTimeout(async () => {
      setCurated(searchCurated(query));
      const icdResults = await searchIcd10(query);
      setIcd10(icdResults);
      setShowDropdown(true);
    }, 250);
  }, [query, searchCurated, searchIcd10]);

  const selectCurated = async (item: any) => {
    const d: DiagnosisEntry = {
      id: item.id,
      source: "curated",
      icd10_code: item.icd10_code ?? "",
      clinical_description: item.clinical_description ?? "",
      plain_language_diagnosis: item.plain_language ?? "",
      diagnosis_type: index === 0 ? "primary" : "secondary",
      is_uncodified: false,
    };
    setSelected(d);
    onChange(d);
    setShowDropdown(false);
    setQuery("");
    // increment usage_count
    if (item.id) await supabase.from("streetdocmd_diagnoses").update({ usage_count: (item.usage_count ?? 0) + 1 }).eq("id", item.id);
  };

  const selectIcd10 = (item: any) => {
    const d: DiagnosisEntry = {
      source: "icd10_full",
      icd10_code: item.code ?? "",
      clinical_description: item.description ?? "",
      plain_language_diagnosis: item.description ?? "",
      diagnosis_type: index === 0 ? "primary" : "secondary",
      is_uncodified: false,
    };
    setSelected(d);
    onChange(d);
    setShowDropdown(false);
    setQuery("");
  };

  const selectManual = () => {
    setIsManual(true);
    setShowDropdown(false);
    const d: DiagnosisEntry = {
      source: "manual_override",
      icd10_code: "Uncodified",
      clinical_description: "",
      plain_language_diagnosis: "",
      diagnosis_type: index === 0 ? "primary" : "secondary",
      is_uncodified: true,
    };
    setSelected(d);
    onChange(d);
  };

  const updateSelected = (field: keyof DiagnosisEntry, val: string) => {
    if (!selected) return;
    const next = { ...selected, [field]: val };
    setSelected(next);
    onChange(next);
  };

  const reset = () => { setSelected(null); setIsManual(false); setQuery(""); };

  const typeBadge = index === 0
    ? <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">Primary</span>
    : <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full font-medium">Secondary</span>;

  if (selected) {
    return (
      <div className="border border-gray-200 rounded-xl p-4 space-y-3 bg-white">
        <div className="flex items-center justify-between">
          {typeBadge}
          <div className="flex items-center gap-2">
            {onRemove && <button onClick={onRemove} className="text-red-400 hover:text-red-600 text-sm">✕ Remove</button>}
            <button onClick={reset} className="text-xs text-gray-400 hover:text-gray-600">Change</button>
          </div>
        </div>

        {isManual && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-2">
            <p className="text-xs text-blue-600 italic">Your diagnosis will be reviewed by our medical team for coding.</p>
          </div>
        )}

        <div className="space-y-2">
          <div>
            <label className="text-xs text-gray-500 font-medium">ICD-10 Code</label>
            <input
              type="text"
              value={selected.icd10_code}
              onChange={e => updateSelected("icd10_code", e.target.value)}
              disabled={isManual}
              className={`mt-0.5 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${isManual ? "bg-gray-100 text-gray-400 cursor-not-allowed" : ""}`}
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 font-medium">Clinical Description</label>
            <input
              type="text"
              value={selected.clinical_description}
              onChange={e => updateSelected("clinical_description", e.target.value)}
              className="mt-0.5 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="text-xs text-blue-600 font-medium italic">Patient-Facing Diagnosis — this is what your patient will see</label>
            <input
              type="text"
              value={selected.plain_language_diagnosis}
              onChange={e => updateSelected("plain_language_diagnosis", e.target.value)}
              className="mt-0.5 w-full border border-blue-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="flex items-center gap-2 mb-2">
        {typeBadge}
        {onRemove && <button onClick={onRemove} className="text-red-400 hover:text-red-600 text-xs ml-auto">✕ Remove</button>}
      </div>

      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={e => { setQuery(e.target.value); setShowDropdown(true); }}
        onFocus={() => setShowDropdown(true)}
        placeholder="Start typing a diagnosis..."
        className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      />

      {showDropdown && (
        <div className="absolute z-50 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-xl max-h-80 overflow-y-auto">
          {query.length < 2 && favourites.length > 0 && (
            <Section label="Your frequent diagnoses" color="amber">
              {favourites.map((f, i) => (
                <ResultRow key={i} main={f.plain_language_diagnosis || f.clinical_description} sub={f.icd10_code} dot="🟡" onClick={() => selectCurated({ ...f, plain_language: f.plain_language_diagnosis })} />
              ))}
            </Section>
          )}

          {curated.length > 0 && (
            <Section label="Common Diagnoses" color="green">
              {curated.map((c, i) => (
                <ResultRow key={i} main={c.plain_language} sub={c.icd10_code} dot="🟢" onClick={() => selectCurated(c)} />
              ))}
            </Section>
          )}

          {icd10.length > 0 && (
            <Section label="ICD-10 Database" color="gray">
              {icd10.map((c, i) => (
                <ResultRow key={i} main={c.description} sub={c.code} dot="⚪" onClick={() => selectIcd10(c)} />
              ))}
            </Section>
          )}

          <button
            onClick={selectManual}
            className="w-full flex items-center gap-2 px-4 py-3 text-sm text-gray-600 hover:bg-gray-50 border-t border-gray-100 text-left"
          >
            <span>✏️</span>
            <span>Use my own diagnosis instead</span>
          </button>
        </div>
      )}
    </div>
  );
}

function Section({ label, color, children }: { label: string; color: string; children: React.ReactNode }) {
  const colors: Record<string, string> = { green: "text-green-700", gray: "text-gray-500", amber: "text-amber-600" };
  return (
    <div>
      <p className={`px-4 pt-2 pb-1 text-xs font-semibold uppercase tracking-wide ${colors[color] ?? "text-gray-500"}`}>{label}</p>
      {children}
    </div>
  );
}

function ResultRow({ main, sub, dot, onClick }: { main: string; sub: string; dot: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="w-full flex items-center gap-2 px-4 py-2.5 hover:bg-gray-50 text-left">
      <span className="text-xs">{dot}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-gray-800 truncate">{main}</p>
        {sub && <p className="text-xs text-gray-400">{sub}</p>}
      </div>
    </button>
  );
}
