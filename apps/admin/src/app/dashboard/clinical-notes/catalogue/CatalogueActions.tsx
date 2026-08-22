"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type Props = {
  mode?: "row" | "add";
  diagnosis?: any;
  categories: string[];
};

export default function CatalogueActions({ mode = "add", diagnosis, categories }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    icd10_code: diagnosis?.icd10_code ?? "",
    clinical_description: diagnosis?.clinical_description ?? "",
    plain_language: diagnosis?.plain_language ?? "",
    category: diagnosis?.category ?? "general",
  });

  const save = async () => {
    setLoading(true);
    if (diagnosis?.id) {
      await supabase.from("streetdocmd_diagnoses").update(form).eq("id", diagnosis.id);
    } else {
      await supabase.from("streetdocmd_diagnoses").insert({ ...form, is_curated: true });
    }
    setLoading(false);
    setOpen(false);
    router.refresh();
  };

  const toggleActive = async () => {
    if (!diagnosis?.id) return;
    await supabase.from("streetdocmd_diagnoses").update({ active: !diagnosis.active }).eq("id", diagnosis.id);
    router.refresh();
  };

  if (mode === "row") {
    return (
      <>
        <div className="flex gap-1.5">
          <button onClick={() => setOpen(true)} className="text-xs border border-gray-200 rounded-lg px-2 py-1 text-gray-600 hover:bg-gray-50">Edit</button>
          <button onClick={toggleActive} className={`text-xs border rounded-lg px-2 py-1 transition-colors ${diagnosis?.active ? "border-red-200 text-red-600 hover:bg-red-50" : "border-green-200 text-green-600 hover:bg-green-50"}`}>
            {diagnosis?.active ? "Deactivate" : "Activate"}
          </button>
        </div>

        {open && <Modal form={form} setForm={setForm} onSave={save} onClose={() => setOpen(false)} loading={loading} categories={categories} title="Edit Diagnosis" />}
      </>
    );
  }

  return (
    <>
      <button onClick={() => setOpen(true)} className="bg-blue-600 text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors">
        + Add New Diagnosis
      </button>
      {open && <Modal form={form} setForm={setForm} onSave={save} onClose={() => setOpen(false)} loading={loading} categories={categories} title="Add to Catalogue" />}
    </>
  );
}

function Modal({ form, setForm, onSave, onClose, loading, categories, title }: any) {
  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-900">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
        </div>
        <div className="p-5 space-y-3">
          <Field label="ICD-10 Code" value={form.icd10_code} onChange={v => setForm((p: any) => ({ ...p, icd10_code: v }))} placeholder="e.g. B50.9" />
          <Field label="Clinical Description" value={form.clinical_description} onChange={v => setForm((p: any) => ({ ...p, clinical_description: v }))} placeholder="e.g. Plasmodium falciparum malaria" />
          <Field label="Plain Language (patient-facing)" value={form.plain_language} onChange={v => setForm((p: any) => ({ ...p, plain_language: v }))} placeholder="e.g. Malaria" />
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Category</label>
            <select value={form.category} onChange={e => setForm((p: any) => ({ ...p, category: e.target.value }))}
              className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
              {categories.map((c: string) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="flex gap-2 pt-2">
            <button onClick={onSave} disabled={loading} className="flex-1 bg-blue-600 text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-blue-700 disabled:opacity-50">
              {loading ? "Saving..." : "Save"}
            </button>
            <button onClick={onClose} className="flex-1 border border-gray-200 text-gray-600 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-50">Cancel</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div>
      <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{label}</label>
      <input type="text" value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
    </div>
  );
}
