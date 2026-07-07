"use client";
import { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";
import Link from "next/link";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type Recommendations = {
  lifestyle_advice: string;
  dietary_advice: string;
  referral_required: boolean;
  rest_advised: boolean;
  rest_days: string;
  additional: string;
};

export default function Step13Recommendations({ bookingId, value, onChange }: {
  bookingId: string;
  value: Partial<Recommendations> | null;
  onChange: (v: Partial<Recommendations>) => void;
}) {
  const [data, setData] = useState<Partial<Recommendations>>(value ?? {});
  const [prescriptions, setPrescriptions] = useState<any[]>([]);
  const [investigations, setInvestigations] = useState<any[]>([]);

  useEffect(() => {
    supabase.from("prescriptions").select("drugs, pdf_url").eq("booking_id", bookingId).then(({ data: d }) => setPrescriptions(d ?? []));
    supabase.from("investigation_orders").select("test_name, status").eq("booking_id", bookingId).then(({ data: d }) => setInvestigations(d ?? []));
  }, [bookingId]);

  const set = (k: keyof Recommendations, v: any) => {
    const next = { ...data, [k]: v };
    setData(next);
    onChange(next);
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold text-gray-900">Step 13 — Recommendations</h2>
      </div>

      {/* Medications */}
      <div className="card p-4 space-y-2">
        <p className="text-sm font-semibold text-gray-700">Medications Prescribed</p>
        {prescriptions.length > 0 ? (
          <div className="space-y-1">
            {prescriptions.map((p, i) => (
              <div key={i} className="text-sm text-gray-600">
                {Array.isArray(p.drugs) ? p.drugs.map((d: any) => <div key={d.name || d.drug_name} className="py-1">• {d.name || d.drug_name} — {d.dosage || d.strength} {d.frequency}</div>) : null}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-gray-400">No prescriptions yet</p>
        )}
        <Link href={`/dashboard/active/${bookingId}`} className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline font-medium">
          Open Prescription Generator →
        </Link>
      </div>

      {/* Investigations */}
      <div className="card p-4 space-y-2">
        <p className="text-sm font-semibold text-gray-700">Investigations Ordered</p>
        {investigations.length > 0 ? (
          <div className="space-y-1">
            {investigations.map((inv, i) => (
              <div key={i} className="text-sm text-gray-600">• {inv.test_name} <span className="text-xs text-gray-400">({inv.status})</span></div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-gray-400">No investigations ordered yet</p>
        )}
        <Link href={`/dashboard/active/${bookingId}`} className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline font-medium">
          Open Lab Order Screen →
        </Link>
      </div>

      {/* Referral */}
      <div className="card p-4 space-y-3">
        <p className="text-sm font-semibold text-gray-700">Hospital Referral</p>
        <div className="flex gap-2">
          {[false, true].map(v => (
            <button key={String(v)} onClick={() => set("referral_required", v)}
              className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${data.referral_required === v ? "bg-blue-600 text-white border-blue-600" : "border-gray-200 text-gray-600 hover:bg-gray-50"}`}>
              {v ? "Yes" : "No"}
            </button>
          ))}
        </div>
        {data.referral_required && (
          <button className="text-sm text-blue-600 hover:underline font-medium">Generate Referral Letter →</button>
        )}
      </div>

      {/* Lifestyle */}
      <div className="card p-4 space-y-2">
        <label className="text-sm font-semibold text-gray-700">Lifestyle Advice</label>
        <textarea value={data.lifestyle_advice ?? ""} onChange={e => set("lifestyle_advice", e.target.value)} rows={3}
          placeholder="Physical activity, smoking cessation, sleep advice etc."
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
      </div>

      {/* Dietary */}
      <div className="card p-4 space-y-2">
        <label className="text-sm font-semibold text-gray-700">Dietary Advice</label>
        <textarea value={data.dietary_advice ?? ""} onChange={e => set("dietary_advice", e.target.value)} rows={3}
          placeholder="Specific dietary recommendations..."
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
      </div>

      {/* Rest */}
      <div className="card p-4 space-y-3">
        <p className="text-sm font-semibold text-gray-700">Rest Advised</p>
        <div className="flex gap-2">
          {[false, true].map(v => (
            <button key={String(v)} onClick={() => set("rest_advised", v)}
              className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${data.rest_advised === v ? "bg-blue-600 text-white border-blue-600" : "border-gray-200 text-gray-600 hover:bg-gray-50"}`}>
              {v ? "Yes" : "No"}
            </button>
          ))}
        </div>
        {data.rest_advised && (
          <div>
            <label className="text-sm text-gray-600">Duration (days)</label>
            <input type="number" min="1" value={data.rest_days ?? ""} onChange={e => set("rest_days", e.target.value)}
              className="mt-1 w-24 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        )}
      </div>

      {/* Additional */}
      <div className="card p-4 space-y-2">
        <label className="text-sm font-semibold text-gray-700">Additional Recommendations</label>
        <textarea value={data.additional ?? ""} onChange={e => set("additional", e.target.value)} rows={3}
          placeholder="Anything else..."
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
      </div>
    </div>
  );
}
