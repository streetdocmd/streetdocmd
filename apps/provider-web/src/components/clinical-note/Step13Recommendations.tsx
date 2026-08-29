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
  bookingId, patientId, providerId, serviceType, value, onChange,
}: {
  bookingId: string;
  patientId: string;
  providerId: string;
  serviceType?: string;
  value: Partial<Recommendations> | null;
  onChange: (v: Partial<Recommendations>) => void;
}) {
  const [data, setData] = useState<Partial<Recommendations>>(value ?? {});
  const [prescriptions, setPrescriptions] = useState<any[]>([]);
  const [investigations, setInvestigations] = useState<any[]>([]);
  const [sentReferrals, setSentReferrals] = useState<any[]>([]);

  // Referral form
  const [hospitals, setHospitals] = useState<any[]>([]);
  const [referralForm, setReferralForm] = useState({ hospitalPartnerId: "", urgency: "routine" as "routine" | "urgent" | "emergency", reason: "", clinicalSummary: "" });
  const [sendingReferral, setSendingReferral] = useState(false);
  const [referralSent, setReferralSent] = useState(false);

  // Prescription inline form
  const [showRxForm, setShowRxForm] = useState(false);
  const [drugs, setDrugs] = useState<Drug[]>([{ ...BLANK_DRUG }]);
  const [savingRx, setSavingRx] = useState(false);
  const [rxSaved, setRxSaved] = useState(false);

  // Elderly-review nurse follow-up
  const [requestingFollowUp, setRequestingFollowUp] = useState(false);
  const [followUpRequested, setFollowUpRequested] = useState(false);
  const [followUpError, setFollowUpError] = useState<string | null>(null);

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
    supabase.from("hospital_referrals").select("id, status, urgency, reason, hospital_partner_id, pdf_url, hospital_partners(name)").eq("booking_id", bookingId)
      .then(({ data: d }) => setSentReferrals(d ?? []));
    supabase.from("hospital_partners").select("id, name, address, specialties").eq("active", true).order("name")
      .then(({ data: d }) => {
        setHospitals(d ?? []);
        if (d && d.length > 0) setReferralForm(f => ({ ...f, hospitalPartnerId: d[0].id }));
      });
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
    await supabase.from("prescriptions").insert({ booking_id: bookingId, provider_id: providerId, patient_id: patientId, drugs: validDrugs });
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

    // Proximity dispatch: find nearest active lab with home collection
    const [{ data: booking }, { data: labs }] = await Promise.all([
      supabase.from("bookings").select("lat, lng").eq("id", bookingId).single(),
      supabase.from("lab_partners").select("id, name, lat, lng").eq("active", true).eq("home_collection_available", true),
    ]);

    if (!labs?.length) { setLoadingCatalogue(false); return; }

    let chosenLab = labs[0];
    if (booking?.lat != null && booking?.lng != null) {
      let bestDist = Infinity;
      for (const l of labs) {
        if (l.lat == null || l.lng == null) continue;
        const dLat = (l.lat - booking.lat) * Math.PI / 180;
        const dLng = (l.lng - booking.lng) * Math.PI / 180;
        const a = Math.sin(dLat / 2) ** 2 +
          Math.cos(booking.lat * Math.PI / 180) * Math.cos(l.lat * Math.PI / 180) *
          Math.sin(dLng / 2) ** 2;
        const d = 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        if (d < bestDist) { bestDist = d; chosenLab = l; }
      }
    }

    setLabPartner(chosenLab);
    const { data: tests } = await supabase
      .from("investigation_catalogue")
      .select("id, test_name, test_code, price, sample_type, turnaround_hours")
      .eq("lab_partner_id", chosenLab.id).eq("active", true).order("test_name");
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

  const requestNurseFollowUp = async () => {
    setRequestingFollowUp(true);
    setFollowUpError(null);
    try {
      const res = await fetch("/api/follow-up", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookingId }),
      });
      if (res.ok) {
        setFollowUpRequested(true);
      } else {
        const body = await res.json().catch(() => ({}));
        setFollowUpError(body.error ?? "Could not request follow-up. Please try again.");
      }
    } catch {
      setFollowUpError("Network error. Please check your connection and try again.");
    } finally {
      setRequestingFollowUp(false);
    }
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

      {/* Nurse follow-up (elderly review only) */}
      {serviceType === "elderly_review" && (
        <div className="card p-4 space-y-3">
          <p className="text-sm font-semibold text-gray-700">Nurse Follow-up</p>
          <p className="text-xs text-gray-500">
            Based on this diagnosis, does this patient need a nurse to visit for follow-up care?
          </p>

          {followUpRequested ? (
            <p className="text-xs text-green-600 font-medium">
              ✓ Follow-up requested — the patient has been asked to confirm and pay to schedule it.
            </p>
          ) : (
            <>
              {followUpError && (
                <p className="text-xs text-red-600">{followUpError}</p>
              )}
              <button
                onClick={requestNurseFollowUp}
                disabled={requestingFollowUp}
                className="text-sm text-blue-600 hover:underline font-medium disabled:opacity-40"
              >
                {requestingFollowUp ? "Requesting…" : "+ Request Nurse Follow-up"}
              </button>
            </>
          )}
        </div>
      )}

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

        {/* Sent referrals */}
        {sentReferrals.length > 0 && (
          <div className="space-y-2">
            {sentReferrals.map(r => (
              <div key={r.id} className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm">
                <div>
                  <span className={`inline-block text-xs font-semibold px-2 py-0.5 rounded-full mr-2 ${
                    r.urgency === "emergency" ? "bg-red-100 text-red-700" :
                    r.urgency === "urgent" ? "bg-amber-100 text-amber-700" :
                    "bg-gray-100 text-gray-600"
                  }`}>{r.urgency}</span>
                  <span className="text-gray-700 font-medium">{(r.hospital_partners as any)?.name ?? "Hospital"}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400 capitalize">{r.status}</span>
                  {r.pdf_url && (
                    <a href={r.pdf_url} target="_blank" rel="noreferrer"
                      className="text-xs text-blue-600 hover:underline font-medium">View Letter</a>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {data.referral_required && (
          <div className="border border-gray-100 rounded-xl p-3 space-y-3 bg-gray-50">
            <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Referral Details</p>

            {/* Urgency */}
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Urgency *</label>
              <div className="flex gap-2">
                {(["routine", "urgent", "emergency"] as const).map(u => (
                  <button key={u} type="button" onClick={() => setReferralForm(f => ({ ...f, urgency: u }))}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-semibold border capitalize transition-colors ${
                      referralForm.urgency === u
                        ? u === "emergency" ? "bg-red-600 text-white border-red-600"
                          : u === "urgent" ? "bg-amber-500 text-white border-amber-500"
                          : "bg-teal-600 text-white border-teal-600"
                        : "border-gray-200 text-gray-600 hover:bg-gray-50"
                    }`}>
                    {u}
                  </button>
                ))}
              </div>
              {referralForm.urgency === "emergency" && (
                <p className="text-xs text-red-600 font-medium mt-1">Emergency: referral will be dispatched to the 3 nearest available hospitals simultaneously.</p>
              )}
            </div>

            {/* Hospital selection — only for non-emergency */}
            {referralForm.urgency !== "emergency" && (
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Hospital *</label>
                {hospitals.length === 0 ? (
                  <p className="text-xs text-gray-400">No hospital partners configured yet.</p>
                ) : (
                  <select value={referralForm.hospitalPartnerId}
                    onChange={e => setReferralForm(f => ({ ...f, hospitalPartnerId: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                    {hospitals.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
                  </select>
                )}
              </div>
            )}

            {/* Reason */}
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Reason for Referral *</label>
              <textarea rows={2} value={referralForm.reason}
                onChange={e => setReferralForm(f => ({ ...f, reason: e.target.value }))}
                placeholder="Primary reason for referral…"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
            </div>

            {/* Clinical summary */}
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Clinical Summary (for the hospital)</label>
              <textarea rows={3} value={referralForm.clinicalSummary}
                onChange={e => setReferralForm(f => ({ ...f, clinicalSummary: e.target.value }))}
                placeholder="Brief clinical history, relevant findings, current medications…"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
            </div>

            {referralSent && (
              <p className="text-xs text-green-600 font-medium">✓ Referral letter sent</p>
            )}

            <div className="flex gap-2">
              <button
                onClick={async () => {
                  if (!referralForm.reason.trim()) return;
                  if (referralForm.urgency !== "emergency" && !referralForm.hospitalPartnerId) return;
                  setSendingReferral(true);
                  const res = await fetch("/api/referral", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      bookingId, patientId, providerId,
                      urgency: referralForm.urgency,
                      reason: referralForm.reason,
                      clinicalSummary: referralForm.clinicalSummary,
                      hospitalPartnerId: referralForm.urgency !== "emergency" ? referralForm.hospitalPartnerId : undefined,
                    }),
                  });
                  setSendingReferral(false);
                  if (res.ok) {
                    setReferralSent(true);
                    setReferralForm(f => ({ ...f, reason: "", clinicalSummary: "" }));
                    const { data: d } = await supabase
                      .from("hospital_referrals")
                      .select("id, status, urgency, reason, hospital_partner_id, pdf_url, hospital_partners(name)")
                      .eq("booking_id", bookingId);
                    setSentReferrals(d ?? []);
                  }
                }}
                disabled={sendingReferral || !referralForm.reason.trim() || (referralForm.urgency !== "emergency" && !referralForm.hospitalPartnerId)}
                className="flex-1 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 disabled:opacity-40 transition-colors">
                {sendingReferral ? "Sending…" : referralForm.urgency === "emergency" ? "Dispatch Emergency Referral" : "Send Referral Letter"}
              </button>
            </div>
          </div>
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
