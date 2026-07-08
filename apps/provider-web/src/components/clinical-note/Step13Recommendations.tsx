"use client";
import { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type Drug = { name: string; dosage: string; frequency: string; duration: string };
const BLANK_DRUG: Drug = { name: "", dosage: "", frequency: "Once daily", duration: "" };

type Recommendations = {
  lifestyle_advice: string;
  dietary_advice: string;
  referral_required: boolean;
  rest_advised: boolean;
  rest_days: string;
  additional: string;
};

export default function Step13Recommendations({
  bookingId, patientId, providerId, value, onChange,
}: {
  bookingId: string;
  patientId: string;
  providerId: string;
  value: Partial<Recommendations> | null;
  onChange: (v: Partial<Recommendations>) => void;
}) {
  const [data, setData] = useState<Partial<Recommendations>>(value ?? {});
  const [prescriptions, setPrescriptions] = useState<any[]>([]);
  const [investigations, setInvestigations] = useState<any[]>([]);

  // Prescription inline form
  const [showRxForm, setShowRxForm] = useState(false);
  const [drugs, setDrugs] = useState<Drug[]>([{ ...BLANK_DRUG }]);
  const [savingRx, setSavingRx] = useState(false);
  const [rxSaved, setRxSaved] = useState(false);

  // Investigation inline form
  const [showInvForm, setShowInvForm] = useState(false);
  const [catalogue, setCatalogue] = useState<any[]>([]);
  const [labPartner, setLabPartner] = useState<any>(null);
  const [invSearch, setInvSearch] = useState("");
  const [selectedTests, setSelectedTests] = useState<any[]>([]);
  const [invNotes, setInvNotes] = useState("");
  const [savingInv, setSavingInv] = useState(false);
  const [invSaved, setInvSaved] = useState(false);
  const [loadingCatalogue, setLoadingCatalogue] = useState(false);

  useEffect(() => {
    supabase.from("prescriptions").select("drugs, pdf_url").eq("booking_id", bookingId)
      .then(({ data: d }) => setPrescriptions(d ?? []));
    supabase.from("investigation_orders").select("tests, status").eq("booking_id", bookingId)
      .then(({ data: d }) => setInvestigations(d ?? []));
  }, [bookingId]);

  const set = (k: keyof Recommendations, v: any) => {
    const next = { ...data, [k]: v };
    setData(next);
    onChange(next);
  };

  const updateDrug = (i: number, f: keyof Drug, v: string) =>
    setDrugs(d => d.map((drug, idx) => idx === i ? { ...drug, [f]: v } : drug));
  const addDrug = () => setDrugs(d => [...d, { ...BLANK_DRUG }]);
  const removeDrug = (i: number) => setDrugs(d => d.filter((_, idx) => idx !== i));

  const savePrescription = async () => {
    const validDrugs = drugs.filter(d => d.name.trim());
    if (!validDrugs.length) return;
    setSavingRx(true);
    await supabase.from("prescriptions").insert({ booking_id: bookingId, drugs: validDrugs });
    setSavingRx(false);
    setShowRxForm(false);
    setRxSaved(true);
    setDrugs([{ ...BLANK_DRUG }]);
    const { data: d } = await supabase.from("prescriptions").select("drugs, pdf_url").eq("booking_id", bookingId);
    setPrescriptions(d ?? []);
  };

  const loadCatalogue = async () => {
    if (catalogue.length > 0) return;
    setLoadingCatalogue(true);
    const { data: lab } = await supabase.from("lab_partners").select("id, name").eq("active", true).limit(1).single();
    if (!lab) { setLoadingCatalogue(false); return; }
    setLabPartner(lab);
    const { data: tests } = await supabase
      .from("investigation_catalogue")
      .select("id, test_name, test_code, price, sample_type, turnaround_hours")
      .eq("lab_partner_id", lab.id).eq("active", true).order("test_name");
    setCatalogue(tests ?? []);
    setLoadingCatalogue(false);
  };

  const toggleTest = (item: any) => {
    setSelectedTests(prev => {
      const exists = prev.find(t => t.catalogue_id === item.id);
      if (exists) return prev.filter(t => t.catalogue_id !== item.id);
      return [...prev, { catalogue_id: item.id, test_name: item.test_name, test_code: item.test_code, price: item.price }];
    });
  };

  const saveInvestigations = async () => {
    if (!labPartner || !selectedTests.length) return;
    setSavingInv(true);
    await supabase.from("investigation_orders").insert({
      booking_id: bookingId,
      patient_id: patientId,
      provider_id: providerId,
      lab_partner_id: labPartner.id,
      tests: selectedTests,
      clinical_notes: invNotes.trim() || null,
      status: "ordered",
    });
    setSavingInv(false);
    setShowInvForm(false);
    setInvSaved(true);
    setSelectedTests([]);
    setInvSearch("");
    const { data: d } = await supabase.from("investigation_orders").select("tests, status").eq("booking_id", bookingId);
    setInvestigations(d ?? []);
  };

  const filteredCatalogue = catalogue.filter(t =>
    t.test_name?.toLowerCase().includes(invSearch.toLowerCase()) ||
    (t.test_code ?? "").toLowerCase().includes(invSearch.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold text-gray-900">Step 13 — Recommendations</h2>

      {/* Prescription */}
      <div className="card p-4 space-y-3">
        <p className="text-sm font-semibold text-gray-700">Medications Prescribed</p>

        {prescriptions.length > 0 ? (
          <div className="space-y-1">
            {prescriptions.map((p, i) => (
              <div key={i} className="text-sm text-gray-600">
                {Array.isArray(p.drugs) ? p.drugs.map((d: any) => (
                  <div key={d.name || d.drug_name} className="py-0.5">
                    • {d.name || d.drug_name} — {d.dosage || d.strength} {d.frequency}{d.duration ? ` × ${d.duration}` : ""}
                  </div>
                )) : null}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-gray-400">No prescriptions yet</p>
        )}

        {rxSaved && !showRxForm && (
          <p className="text-xs text-green-600 font-medium">✓ Prescription saved</p>
        )}

        {!showRxForm ? (
          <button onClick={() => setShowRxForm(true)} className="text-sm text-blue-600 hover:underline font-medium">
            + Add Prescription
          </button>
        ) : (
          <div className="border border-gray-100 rounded-xl p-3 space-y-3 bg-gray-50">
            {drugs.map((drug, i) => (
              <div key={i} className="space-y-2">
                {i > 0 && (
                  <div className="flex items-center justify-between pt-2 border-t border-gray-200">
                    <p className="text-xs font-semibold text-gray-500">Drug {i + 1}</p>
                    <button onClick={() => removeDrug(i)} className="text-xs text-red-500 hover:text-red-700">Remove</button>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: "Drug name *", field: "name" as keyof Drug, placeholder: "e.g. Amoxicillin" },
                    { label: "Dosage", field: "dosage" as keyof Drug, placeholder: "e.g. 500mg" },
                  ].map(({ label, field, placeholder }) => (
                    <div key={field}>
                      <label className="text-xs font-medium text-gray-600 block mb-1">{label}</label>
                      <input value={drug[field]} onChange={e => updateDrug(i, field, e.target.value)} placeholder={placeholder}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                  ))}
                  <div>
                    <label className="text-xs font-medium text-gray-600 block mb-1">Frequency</label>
                    <select value={drug.frequency} onChange={e => updateDrug(i, "frequency", e.target.value)}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                      {["Once daily","Twice daily","Three times daily","Four times daily","Every 8 hours","Every 6 hours","At night","As needed","Stat (one-time)"].map(o => (
                        <option key={o}>{o}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-600 block mb-1">Duration</label>
                    <input value={drug.duration} onChange={e => updateDrug(i, "duration", e.target.value)} placeholder="e.g. 5 days"
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                </div>
              </div>
            ))}
            <button onClick={addDrug} className="w-full py-2 border border-dashed border-gray-300 rounded-lg text-xs text-gray-500 hover:border-blue-400 hover:text-blue-500 transition-colors">
              + Add another drug
            </button>
            <div className="flex gap-2 pt-1">
              <button onClick={savePrescription} disabled={savingRx || !drugs.some(d => d.name.trim())}
                className="flex-1 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 disabled:opacity-40 transition-colors">
                {savingRx ? "Saving…" : "Save Prescription"}
              </button>
              <button onClick={() => { setShowRxForm(false); setDrugs([{ ...BLANK_DRUG }]); }}
                className="flex-1 py-2.5 border border-gray-200 text-gray-600 rounded-xl text-sm font-medium hover:bg-gray-50">
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Investigations */}
      <div className="card p-4 space-y-3">
        <p className="text-sm font-semibold text-gray-700">Investigations Ordered</p>

        {investigations.length > 0 ? (
          <div className="space-y-1">
            {investigations.map((inv, i) => (
              <div key={i} className="text-sm text-gray-600">
                {Array.isArray(inv.tests)
                  ? inv.tests.map((t: any) => (
                    <div key={t.test_name} className="py-0.5">• {t.test_name} <span className="text-xs text-gray-400">({inv.status})</span></div>
                  ))
                  : <div>• Investigation <span className="text-xs text-gray-400">({inv.status})</span></div>}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-gray-400">No investigations ordered yet</p>
        )}

        {invSaved && !showInvForm && (
          <p className="text-xs text-green-600 font-medium">✓ Investigation order saved</p>
        )}

        {!showInvForm ? (
          <button onClick={() => { setShowInvForm(true); loadCatalogue(); }} className="text-sm text-blue-600 hover:underline font-medium">
            + Order Investigations
          </button>
        ) : (
          <div className="border border-gray-100 rounded-xl p-3 space-y-3 bg-gray-50">
            <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Search tests…" value={invSearch} onChange={e => setInvSearch(e.target.value)} />

            {loadingCatalogue ? (
              <p className="text-xs text-gray-400 text-center py-3">Loading catalogue…</p>
            ) : (
              <div className="space-y-1 max-h-52 overflow-y-auto">
                {filteredCatalogue.length === 0 && invSearch ? (
                  <p className="text-xs text-gray-400 text-center py-3">No tests found</p>
                ) : filteredCatalogue.length === 0 ? (
                  <p className="text-xs text-gray-400 text-center py-3">No lab partner configured yet</p>
                ) : filteredCatalogue.map(item => {
                  const selected = !!selectedTests.find(t => t.catalogue_id === item.id);
                  return (
                    <button key={item.id} onClick={() => toggleTest(item)}
                      className={`w-full text-left flex items-center justify-between px-3 py-2 rounded-lg border transition-colors ${
                        selected ? "border-teal-400 bg-teal-50" : "border-gray-200 hover:border-gray-300 bg-white"
                      }`}>
                      <div>
                        <p className={`text-sm font-medium ${selected ? "text-teal-700" : "text-gray-800"}`}>{item.test_name}</p>
                        <p className="text-xs text-gray-400">{item.sample_type} · {item.turnaround_hours}h TAT</p>
                      </div>
                      <span className="text-xs font-semibold text-gray-500 ml-2 shrink-0">₦{item.price?.toLocaleString()}</span>
                    </button>
                  );
                })}
              </div>
            )}

            {selectedTests.length > 0 && (
              <p className="text-xs text-teal-700 font-medium">{selectedTests.length} test{selectedTests.length > 1 ? "s" : ""} selected</p>
            )}

            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Clinical Indication</label>
              <textarea rows={2} value={invNotes} onChange={e => setInvNotes(e.target.value)}
                placeholder="Reason for investigation…"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
            </div>

            <div className="flex gap-2">
              <button onClick={saveInvestigations} disabled={savingInv || !selectedTests.length}
                className="flex-1 py-2.5 bg-teal-600 text-white rounded-xl text-sm font-semibold hover:bg-teal-700 disabled:opacity-40 transition-colors">
                {savingInv ? "Saving…" : "Save Order"}
              </button>
              <button onClick={() => { setShowInvForm(false); setSelectedTests([]); setInvSearch(""); }}
                className="flex-1 py-2.5 border border-gray-200 text-gray-600 rounded-xl text-sm font-medium hover:bg-gray-50">
                Cancel
              </button>
            </div>
          </div>
        )}
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
          <p className="text-xs text-gray-500">Document referral details in the additional recommendations box below.</p>
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
