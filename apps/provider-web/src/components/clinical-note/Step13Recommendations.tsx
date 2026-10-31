"use client";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase";
import { statusOf } from "@/lib/investigation-status";

const supabase = createClient();

// quantity = units dispensed; with the frequency it tells the patient when a refill is due
type Drug = { name: string; dosage: string; frequency: string; duration: string; quantity: string };
const BLANK_DRUG: Drug = { name: "", dosage: "", frequency: "Once daily", duration: "", quantity: "" };

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
  const [rxNotice, setRxNotice] = useState("");
  const [rxError, setRxError] = useState("");

  // Elderly-review nurse follow-up
  const [requestingFollowUp, setRequestingFollowUp] = useState(false);
  const [followUpRequested, setFollowUpRequested] = useState(false);
  const [followUpError, setFollowUpError] = useState<string | null>(null);

  // Investigation inline form
  const [showInvForm, setShowInvForm] = useState(false);
  const [catalogue, setCatalogue] = useState<any[]>([]);
  const [sampleTaken, setSampleTaken] = useState(false);
  const [sampleNotes, setSampleNotes] = useState("");
  const [invError, setInvError] = useState("");
  const [invSearch, setInvSearch] = useState("");
  const [selectedTests, setSelectedTests] = useState<any[]>([]);
  const [invNotes, setInvNotes] = useState("");
  const [savingInv, setSavingInv] = useState(false);
  const [invSaved, setInvSaved] = useState(false);
  const [loadingCatalogue, setLoadingCatalogue] = useState(false);
  // "Did you mean" suggestions when nothing on the list matches the search
  const [matches, setMatches] = useState<any[]>([]);
  // Tests the doctor asked labs to add, by name
  const [asked, setAsked] = useState<Record<string, "asking" | "asked" | "failed">>({});

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
    setRxError("");
    const { error } = await supabase.from("prescriptions").insert({ booking_id: bookingId, provider_id: providerId, patient_id: patientId, drugs: validDrugs });
    if (error) {
      setSavingRx(false);
      setRxError("Couldn't save the prescription. Check your connection and try again.");
      return;
    }
    setSavingRx(false);
    setShowRxForm(false);
    setRxNotice("Prescription saved. The patient reviews the list, then a pharmacy prices what they need.");
    setDrugs([{ ...BLANK_DRUG }]);
    const { data: d } = await supabase.from("prescriptions").select("drugs, pdf_url").eq("booking_id", bookingId);
    setPrescriptions(d ?? []);
  };

  // StreetdocMD's test list (migration 067). The patient approves and pays;
  // the best lab for their address is chosen then, not here.
  const loadCatalogue = async () => {
    if (catalogue.length > 0) return;
    setLoadingCatalogue(true);
    setInvError("");
    const res = await fetch(`/api/investigations/catalogue?bookingId=${bookingId}`).catch(() => null);
    const json = res?.ok ? await res.json().catch(() => null) : null;
    if (json?.tests) setCatalogue(json.tests);
    else setInvError("Couldn't load the test list. Check your connection and try again.");
    setLoadingCatalogue(false);
  };

  // Labs near this patient that offer a test, for the chosen sample method.
  // Labs already chosen for other tests come first, so the patient deals with
  // as few labs as possible; then the cheapest.
  const offersFor = (item: any, taken = sampleTaken): any[] => {
    const chosen = selectedTests.map(t => t.lab_id);
    return [...((taken ? item.offers_doctor : item.offers_home) ?? [])].sort((a, b) =>
      (chosen.includes(a.lab_id) ? 0 : 1) - (chosen.includes(b.lab_id) ? 0 : 1) || a.price - b.price || a.km - b.km);
  };

  const pickTest = (item: any, offer: any) => {
    setSelectedTests(prev => {
      const same = prev.find(t => t.catalogue_id === item.id);
      if (same?.lab_id === offer.lab_id) return prev.filter(t => t !== same);
      return [...prev.filter(t => t.catalogue_id !== item.id),
        { catalogue_id: item.id, test_name: item.test_name, test_code: item.test_code, lab_id: offer.lab_id, lab_name: offer.lab_name, price: offer.price }];
    });
  };

  // No lab near the patient offers it: it can't go on the order, but labs are
  // asked whether they can add it, and the doctor is told if one does
  const askLabs = async (name: string, testId?: string) => {
    setAsked(a => ({ ...a, [name]: "asking" }));
    const res = await fetch("/api/investigations/request-test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bookingId, testId, name }),
    }).catch(() => null);
    setAsked(a => ({ ...a, [name]: res?.ok ? "asked" : "failed" }));
  };

  const saveInvestigations = async () => {
    if (!selectedTests.length) return;
    if (!invNotes.trim()) { setInvError("Add the clinical indication for these tests."); return; }
    setSavingInv(true);
    setInvError("");
    const res = await fetch("/api/investigations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        bookingId,
        tests: selectedTests.map(t => ({ id: t.catalogue_id, labId: t.lab_id })),
        notes: invNotes.trim(),
        collection: sampleTaken ? "doctor" : "home",
        sampleNotes: sampleTaken ? sampleNotes.trim() : undefined,
      }),
    }).catch(() => null);
    setSavingInv(false);
    if (!res?.ok) {
      setInvError((await res?.json().catch(() => ({})))?.error ?? "Couldn't save the order. Check your connection and try again.");
      return;
    }
    setShowInvForm(false);
    setInvSaved(true);
    setSelectedTests([]);
    setInvSearch("");
    setInvNotes("");
    setSampleTaken(false);
    setSampleNotes("");
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

  const q = invSearch.trim().toLowerCase();
  const chosenLabs = selectedTests.map(t => t.lab_id);
  // Tests a lab already on this order offers come first
  const rank = (t: any) => offersFor(t).some(o => chosenLabs.includes(o.lab_id)) ? 0 : offersFor(t).length ? 1 : 2;
  const filteredCatalogue = catalogue.filter(t =>
    t.test_name?.toLowerCase().includes(q) ||
    (t.test_code ?? "").toLowerCase().includes(q) ||
    (t.aliases ?? []).some((a: string) => a.toLowerCase().includes(q)) ||
    offersFor(t).some(o => o.lab_name.toLowerCase().includes(q))
  ).sort((a, b) => rank(a) - rank(b) || a.test_name.localeCompare(b.test_name));

  // Nothing on the list matches: look for close names ("did you mean")
  useEffect(() => {
    if (q.length < 3 || filteredCatalogue.length > 0) { setMatches([]); return; }
    const t = setTimeout(async () => {
      const res = await fetch(`/api/investigations/match?bookingId=${bookingId}&q=${encodeURIComponent(q)}`).catch(() => null);
      const json = res?.ok ? await res.json().catch(() => null) : null;
      const ids = new Set(((json?.matches ?? []) as any[]).map(m => m.id));
      setMatches(catalogue.filter(c => ids.has(c.id)));
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, catalogue.length, filteredCatalogue.length, bookingId]);

  const testRow = (item: any) => {
    const offers = offersFor(item);
    if (!offers.length) {
      const state = asked[item.test_name];
      return (
        <div key={item.id} className="flex items-center justify-between gap-2 rounded-lg border border-dashed border-line bg-white px-3 py-2">
          <div className="min-w-0">
            <p className="text-sm font-medium text-muted">{item.test_name}</p>
            <p className="text-xs text-danger">No laboratory near this patient offers this</p>
          </div>
          <button onClick={() => askLabs(item.test_name, item.id)} disabled={!!state && state !== "failed"}
            className="flex-none text-xs font-semibold text-accent hover:underline disabled:text-muted disabled:no-underline">
            {state === "asking" ? "Asking…" : state === "asked" ? "Labs asked" : "Ask labs"}
          </button>
        </div>
      );
    }
    const picked = selectedTests.find(t => t.catalogue_id === item.id);
    return (
      <div key={item.id} className={`rounded-lg border bg-white px-3 py-2 ${picked ? "border-teal-400" : "border-line"}`}>
        <p className={`text-sm font-medium ${picked ? "text-teal-700" : "text-ink"}`}>{item.test_name}</p>
        {(item.aliases?.length > 0 || item.sample_type) && (
          <p className="text-xs text-muted">{[item.aliases?.slice(0, 3).join(", "), item.sample_type].filter(Boolean).join(" · ")}</p>
        )}
        <div className="mt-1.5 space-y-1">
          {offers.map(o => {
            const on = picked?.lab_id === o.lab_id;
            return (
              <button key={o.lab_id} onClick={() => pickTest(item, o)} aria-pressed={on}
                className={`flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors ${on ? "bg-teal-50 text-teal-800" : "hover:bg-page text-ink"}`}>
                <span className="min-w-0 truncate">
                  {on ? "✓ " : ""}<b className="font-semibold">{o.lab_name}</b>
                  {chosenLabs.includes(o.lab_id) && !on && <span className="ml-1 text-teal-700">· already on this order</span>}
                </span>
                <span className="flex-none text-muted">₦{o.price.toLocaleString("en-NG")} · {o.km} km</span>
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <h2 className="text-ds-lg font-bold text-navy">Step 13 — Recommendations</h2>

      {/* Prescription */}
      <div className="card p-4 space-y-3">
        <p className="text-sm font-semibold text-ink">Medications Prescribed</p>

        {prescriptions.length > 0 ? (
          <div className="space-y-1">
            {prescriptions.map((p, i) => (
              <div key={i} className="text-sm text-muted">
                {Array.isArray(p.drugs) ? p.drugs.map((d: any) => (
                  <div key={d.name || d.drug_name} className="py-0.5">
                    • {d.name || d.drug_name} — {d.dosage || d.strength} {d.frequency}{d.duration ? ` × ${d.duration}` : ""}
                  </div>
                )) : null}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted">No prescriptions yet</p>
        )}

        {rxNotice && !showRxForm && (
          <p className="text-xs text-green-600 font-medium">✓ {rxNotice}</p>
        )}

        {!showRxForm ? (
          <button onClick={() => setShowRxForm(true)} className="text-sm text-accent hover:underline font-medium">
            + Add Prescription
          </button>
        ) : (
          <div className="border border-line rounded-xl p-3 space-y-3 bg-page">
            {drugs.map((drug, i) => (
              <div key={i} className="space-y-2">
                {i > 0 && (
                  <div className="flex items-center justify-between pt-2 border-t border-line">
                    <p className="text-xs font-semibold text-muted">Drug {i + 1}</p>
                    <button onClick={() => removeDrug(i)} className="text-xs text-red-500 hover:text-red-700">Remove</button>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: "Drug name *", field: "name" as keyof Drug, placeholder: "e.g. Amoxicillin" },
                    { label: "Dosage", field: "dosage" as keyof Drug, placeholder: "e.g. 500mg" },
                  ].map(({ label, field, placeholder }) => (
                    <div key={field}>
                      <label className="text-xs font-medium text-muted block mb-1">{label}</label>
                      <input value={drug[field]} onChange={e => updateDrug(i, field, e.target.value)} placeholder={placeholder}
                        className="w-full border border-line rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent" />
                    </div>
                  ))}
                  <div>
                    <label className="text-xs font-medium text-muted block mb-1">Frequency</label>
                    <select value={drug.frequency} onChange={e => updateDrug(i, "frequency", e.target.value)}
                      className="w-full border border-line rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent bg-white">
                      {["Once daily","Twice daily","Three times daily","Four times daily","Every 8 hours","Every 6 hours","At night","As needed","Stat (one-time)"].map(o => (
                        <option key={o}>{o}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted block mb-1">Duration</label>
                    <input value={drug.duration} onChange={e => updateDrug(i, "duration", e.target.value)} placeholder="e.g. 5 days"
                      className="w-full border border-line rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted block mb-1">Quantity</label>
                    <input value={drug.quantity} onChange={e => updateDrug(i, "quantity", e.target.value.replace(/\D/g, ""))}
                      inputMode="numeric" placeholder="e.g. 21 tablets"
                      className="w-full border border-line rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent" />
                    <p className="text-[11px] text-muted mt-1">Units dispensed. Used to remind the patient to refill.</p>
                  </div>
                </div>
              </div>
            ))}
            <button onClick={addDrug} className="w-full py-2 border border-dashed border-line rounded-lg text-xs text-muted hover:border-accent hover:text-accent transition-colors">
              + Add another drug
            </button>
            {rxError && <p role="alert" className="text-xs font-semibold text-red-600">{rxError}</p>}
            <div className="flex gap-2 pt-1">
              <button onClick={savePrescription} disabled={savingRx || !drugs.some(d => d.name.trim())}
                className="flex-1 py-2.5 bg-accent text-white rounded-xl text-sm font-semibold hover:bg-accent-hover disabled:opacity-40 transition-colors">
                {savingRx ? "Saving…" : "Save Prescription"}
              </button>
              <button onClick={() => { setShowRxForm(false); setDrugs([{ ...BLANK_DRUG }]); }}
                className="flex-1 py-2.5 border border-line text-muted rounded-xl text-sm font-medium hover:bg-page">
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Investigations */}
      <div className="card p-4 space-y-3">
        <p className="text-sm font-semibold text-ink">Investigations Ordered</p>

        {investigations.length > 0 ? (
          <div className="space-y-1">
            {investigations.map((inv, i) => (
              <div key={i} className="text-sm text-muted">
                {Array.isArray(inv.tests)
                  ? inv.tests.map((t: any) => (
                    <div key={t.test_name} className="py-0.5">• {t.test_name} <span className="text-xs text-muted">({statusOf(inv.status).label})</span></div>
                  ))
                  : <div>• Investigation <span className="text-xs text-muted">({statusOf(inv.status).label})</span></div>}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted">No investigations ordered yet</p>
        )}

        {invSaved && !showInvForm && (
          <p className="text-xs text-green-600 font-medium">✓ Sent to the patient to approve and pay. You&apos;ll be notified when results are ready to review.</p>
        )}

        {!showInvForm ? (
          <button onClick={() => { setShowInvForm(true); loadCatalogue(); }} className="text-sm text-accent hover:underline font-medium">
            + Order Investigations
          </button>
        ) : (
          <div className="border border-line rounded-xl p-3 space-y-3 bg-page">
              <input className="w-full border border-line rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
              placeholder="Search tests and labs, e.g. FBC or malaria" aria-label="Search tests and labs" value={invSearch} onChange={e => setInvSearch(e.target.value)} />

            {loadingCatalogue ? (
              <p className="text-xs text-muted text-center py-3">Loading catalogue…</p>
            ) : (
              <div className="space-y-1 max-h-52 overflow-y-auto">
                {filteredCatalogue.map(testRow)}
                {q && filteredCatalogue.length === 0 && matches.length > 0 && (
                  <>
                    <p className="px-1 pt-1 text-xs font-semibold text-muted">Did you mean</p>
                    {matches.map(testRow)}
                  </>
                )}
                {q.length >= 2 && filteredCatalogue.length === 0 && matches.length === 0 && (() => {
                  const name = invSearch.trim().replace(/\s+/g, " ");
                  const state = asked[name];
                  return (
                    <div className="rounded-lg border border-dashed border-line bg-white px-3 py-2.5 text-sm">
                      <p className="font-medium text-ink">No laboratory offers &ldquo;{name}&rdquo;</p>
                      <p className="mt-0.5 text-xs text-muted">It can&apos;t be added to the patient&apos;s order. Choose another test, or ask our labs whether they can add it.</p>
                      <button onClick={() => askLabs(name)} disabled={!!state && state !== "failed"}
                        className="mt-1.5 text-xs font-semibold text-accent hover:underline disabled:text-muted disabled:no-underline">
                        {state === "asking" ? "Asking…" : state === "asked" ? "Labs asked. We'll tell you if one adds it." : state === "failed" ? "Couldn't send. Try again" : "Ask labs to add it"}
                      </button>
                    </div>
                  );
                })()}
              </div>
            )}

            {selectedTests.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {selectedTests.map(t => (
                  <button key={t.catalogue_id} onClick={() => setSelectedTests(prev => prev.filter(x => x !== t))}
                    aria-label={`Remove ${t.test_name}`}
                    className="rounded-full bg-teal-50 px-2.5 py-1 text-xs font-medium text-teal-700 hover:bg-teal-100">
                    {t.test_name} · {t.lab_name} ×
                  </button>
                ))}
              </div>
            )}

            <div>
              <label className="text-xs font-medium text-muted block mb-1">Clinical Indication</label>
              <textarea rows={2} value={invNotes} onChange={e => setInvNotes(e.target.value)}
                placeholder="Reason for investigation…"
                className="w-full border border-line rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent resize-none" />
            </div>

            <label className="flex items-start gap-2 text-sm text-ink">
              <input type="checkbox" className="mt-1" checked={sampleTaken} onChange={e => {
                const taken = e.target.checked;
                setSampleTaken(taken);
                // Some labs only take samples a doctor brings: keep only choices still offered
                setSelectedTests(prev => prev.filter(t => {
                  const item = catalogue.find(c => c.id === t.catalogue_id);
                  return item && offersFor(item, taken).some(o => o.lab_id === t.lab_id);
                }));
              }} />
              <span>I took the sample during this visit<small className="block text-xs text-muted">The lab collects it from you; the patient isn&apos;t charged a collection fee.</small></span>
            </label>
            {sampleTaken && (
              <input className="w-full border border-line rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
                placeholder="Sample details, e.g. 2 EDTA tubes, labelled" value={sampleNotes} onChange={e => setSampleNotes(e.target.value)} />
            )}
            {Object.values(asked).includes("asked") && (
              <p className="text-xs text-muted">We&apos;ve asked our labs about the tests no one near this patient offers, and we&apos;ll tell you if one adds them. They aren&apos;t on this order, so the patient only pays for tests a lab can do.</p>
            )}
            {new Set(selectedTests.map(t => t.lab_id)).size > 1 && (
              <p className="text-xs text-warn">These tests use {new Set(selectedTests.map(t => t.lab_id)).size} labs. Each sends its own collector and charges its own collection fee, so choose the same lab where you can.</p>
            )}
            <p className="text-xs text-muted">Search covers every lab in StreetdocMD that serves this patient&apos;s address. The patient sees these prices, then approves and pays. Explain why you&apos;re requesting the tests before you leave.</p>
            {invError && <p role="alert" className="text-xs font-semibold text-danger">{invError}</p>}

            <div className="flex gap-2">
              <button onClick={saveInvestigations} disabled={savingInv || !selectedTests.length}
                className="flex-1 py-2.5 bg-teal-600 text-white rounded-xl text-sm font-semibold hover:bg-teal-700 disabled:opacity-40 transition-colors">
                {savingInv ? "Saving…" : "Send to patient"}
              </button>
              <button onClick={() => { setShowInvForm(false); setSelectedTests([]); setInvSearch(""); }}
                className="flex-1 py-2.5 border border-line text-muted rounded-xl text-sm font-medium hover:bg-page">
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Nurse follow-up (elderly review only) */}
      {serviceType === "elderly_review" && (
        <div className="card p-4 space-y-3">
          <p className="text-sm font-semibold text-ink">Nurse Follow-up</p>
          <p className="text-xs text-muted">
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
                className="text-sm text-accent hover:underline font-medium disabled:opacity-40"
              >
                {requestingFollowUp ? "Requesting…" : "+ Request Nurse Follow-up"}
              </button>
            </>
          )}
        </div>
      )}

      {/* Referral */}
      <div className="card p-4 space-y-3">
        <p className="text-sm font-semibold text-ink">Hospital Referral</p>
        <div className="flex gap-2">
          {[false, true].map(v => (
            <button key={String(v)} onClick={() => set("referral_required", v)}
              className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${data.referral_required === v ? "bg-accent text-white border-accent" : "border-line text-muted hover:bg-page"}`}>
              {v ? "Yes" : "No"}
            </button>
          ))}
        </div>

        {/* Sent referrals */}
        {sentReferrals.length > 0 && (
          <div className="space-y-2">
            {sentReferrals.map(r => (
              <div key={r.id} className="flex items-center justify-between bg-page border border-line rounded-lg px-3 py-2 text-sm">
                <div>
                  <span className={`inline-block text-xs font-semibold px-2 py-0.5 rounded-full mr-2 ${
                    r.urgency === "emergency" ? "bg-red-100 text-red-700" :
                    r.urgency === "urgent" ? "bg-amber-100 text-amber-700" :
                    "bg-pending-bg text-muted"
                  }`}>{r.urgency}</span>
                  <span className="text-ink font-medium">{(r.hospital_partners as any)?.name ?? "Hospital"}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted capitalize">{r.status}</span>
                  {r.pdf_url && (
                    <a href={r.pdf_url} target="_blank" rel="noreferrer"
                      className="text-xs text-accent hover:underline font-medium">View Letter</a>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {data.referral_required && (
          <div className="border border-line rounded-xl p-3 space-y-3 bg-page">
            <p className="text-xs font-semibold text-muted uppercase tracking-wide">Referral Details</p>

            {/* Urgency */}
            <div>
              <label className="text-xs font-medium text-muted block mb-1">Urgency *</label>
              <div className="flex gap-2">
                {(["routine", "urgent", "emergency"] as const).map(u => (
                  <button key={u} type="button" onClick={() => setReferralForm(f => ({ ...f, urgency: u }))}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-semibold border capitalize transition-colors ${
                      referralForm.urgency === u
                        ? u === "emergency" ? "bg-red-600 text-white border-red-600"
                          : u === "urgent" ? "bg-amber-500 text-white border-amber-500"
                          : "bg-teal-600 text-white border-teal-600"
                        : "border-line text-muted hover:bg-page"
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
                <label className="text-xs font-medium text-muted block mb-1">Hospital *</label>
                {hospitals.length === 0 ? (
                  <p className="text-xs text-muted">No hospital partners configured yet.</p>
                ) : (
                  <select value={referralForm.hospitalPartnerId}
                    onChange={e => setReferralForm(f => ({ ...f, hospitalPartnerId: e.target.value }))}
                    className="w-full border border-line rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-accent">
                    {hospitals.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
                  </select>
                )}
              </div>
            )}

            {/* Reason */}
            <div>
              <label className="text-xs font-medium text-muted block mb-1">Reason for Referral *</label>
              <textarea rows={2} value={referralForm.reason}
                onChange={e => setReferralForm(f => ({ ...f, reason: e.target.value }))}
                placeholder="Primary reason for referral…"
                className="w-full border border-line rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent resize-none" />
            </div>

            {/* Clinical summary */}
            <div>
              <label className="text-xs font-medium text-muted block mb-1">Clinical Summary (for the hospital)</label>
              <textarea rows={3} value={referralForm.clinicalSummary}
                onChange={e => setReferralForm(f => ({ ...f, clinicalSummary: e.target.value }))}
                placeholder="Brief clinical history, relevant findings, current medications…"
                className="w-full border border-line rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent resize-none" />
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
                className="flex-1 py-2.5 bg-accent text-white rounded-xl text-sm font-semibold hover:bg-accent-hover disabled:opacity-40 transition-colors">
                {sendingReferral ? "Sending…" : referralForm.urgency === "emergency" ? "Dispatch Emergency Referral" : "Send Referral Letter"}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Lifestyle */}
      <div className="card p-4 space-y-2">
        <label className="text-sm font-semibold text-ink">Lifestyle Advice</label>
        <textarea value={data.lifestyle_advice ?? ""} onChange={e => set("lifestyle_advice", e.target.value)} rows={3}
          placeholder="Physical activity, smoking cessation, sleep advice etc."
          className="w-full border border-line rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent resize-none" />
      </div>

      {/* Dietary */}
      <div className="card p-4 space-y-2">
        <label className="text-sm font-semibold text-ink">Dietary Advice</label>
        <textarea value={data.dietary_advice ?? ""} onChange={e => set("dietary_advice", e.target.value)} rows={3}
          placeholder="Specific dietary recommendations..."
          className="w-full border border-line rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent resize-none" />
      </div>

      {/* Rest */}
      <div className="card p-4 space-y-3">
        <p className="text-sm font-semibold text-ink">Rest Advised</p>
        <div className="flex gap-2">
          {[false, true].map(v => (
            <button key={String(v)} onClick={() => set("rest_advised", v)}
              className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${data.rest_advised === v ? "bg-accent text-white border-accent" : "border-line text-muted hover:bg-page"}`}>
              {v ? "Yes" : "No"}
            </button>
          ))}
        </div>
        {data.rest_advised && (
          <div>
            <label className="text-sm text-muted">Duration (days)</label>
            <input type="number" min="1" value={data.rest_days ?? ""} onChange={e => set("rest_days", e.target.value)}
              className="mt-1 w-24 border border-line rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent" />
          </div>
        )}
      </div>

      {/* Additional */}
      <div className="card p-4 space-y-2">
        <label className="text-sm font-semibold text-ink">Additional Recommendations</label>
        <textarea value={data.additional ?? ""} onChange={e => set("additional", e.target.value)} rows={3}
          placeholder="Anything else..."
          className="w-full border border-line rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent resize-none" />
      </div>
    </div>
  );
}
