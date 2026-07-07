"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";

// ─── Types ────────────────────────────────────────────────────────────────────

type BookingStatus = "accepted" | "en_route" | "arrived" | "in_progress" | "completed";
type PostStep = "investigations" | "prescription" | "completing" | null;

const STEPS: { status: BookingStatus; label: string; action: string }[] = [
  { status: "accepted",    label: "Request accepted",    action: "I'm on my way"  },
  { status: "en_route",   label: "En route to patient",  action: "I've arrived"   },
  { status: "arrived",    label: "Arrived at patient",   action: "Start visit"    },
  { status: "in_progress", label: "Visit in progress",   action: "Continue →"     },
  { status: "completed",  label: "Visit completed",      action: ""               },
];

const NEXT_STATUS: Partial<Record<BookingStatus, BookingStatus>> = {
  accepted:    "en_route",
  en_route:    "arrived",
  arrived:     "in_progress",
  in_progress: "completed",
};

const STATUS_FIELD: Partial<Record<BookingStatus, string>> = {
  arrived:   "arrived_at",
  completed: "completed_at",
};

interface Drug {
  name: string;
  dosage: string;
  frequency: string;
  duration: string;
}

interface CatalogueItem {
  id: string;
  test_name: string;
  test_code: string;
  price: number;
  turnaround_hours: number;
  sample_type: string;
}

interface SelectedTest {
  catalogue_id: string;
  test_name: string;
  test_code: string;
  price: number;
}

const BLANK_DRUG: Drug = { name: "", dosage: "", frequency: "Once daily", duration: "" };

// ─── Component ────────────────────────────────────────────────────────────────

export default function ActiveBookingClient({
  bookingId,
  currentStatus,
  patientPhone,
  patientId,
  providerId,
}: {
  bookingId: string;
  currentStatus: BookingStatus;
  patientPhone: string;
  patientId: string;
  providerId: string;
}) {
  const router = useRouter();
  const supabase = createClient();

  // ── Visit progression state ──────────────────────────────────────────────
  const [status, setStatus]     = useState<BookingStatus>(currentStatus);
  const [loading, setLoading]   = useState(false);

  // ── Post-consultation steps ──────────────────────────────────────────────
  const [postStep, setPostStep] = useState<PostStep>(null);

  // ── Investigations ───────────────────────────────────────────────────────
  const [showInvForm, setShowInvForm]       = useState(false);
  const [catalogue, setCatalogue]           = useState<CatalogueItem[]>([]);
  const [labPartner, setLabPartner]         = useState<{ id: string; name: string } | null>(null);
  const [loadingCatalogue, setLoadingCatalogue] = useState(false);
  const [invSearch, setInvSearch]           = useState("");
  const [selectedTests, setSelectedTests]   = useState<SelectedTest[]>([]);
  const [invNotes, setInvNotes]             = useState("");
  const [submittingInv, setSubmittingInv]   = useState(false);

  // ── Prescription ─────────────────────────────────────────────────────────
  const [showRx, setShowRx]   = useState(false);
  const [drugs, setDrugs]     = useState<Drug[]>([]);

  // ── Pharmacy prompt (shown after API returns) ────────────────────────────
  const [pharmacyPrompt, setPharmacyPrompt] = useState<{
    visitId: string; patientId: string; pdfUrl: string | null;
  } | null>(null);
  const [sendingToPharmacy, setSendingToPharmacy] = useState(false);

  // ─── Step index helpers ──────────────────────────────────────────────────
  const stepIndex   = STEPS.findIndex(s => s.status === status);
  const currentStep = STEPS[stepIndex];
  const nextStatus  = NEXT_STATUS[status];

  // ─── Drug helpers ─────────────────────────────────────────────────────────
  function addDrug()                              { setDrugs(d => [...d, { ...BLANK_DRUG }]); }
  function removeDrug(i: number)                  { setDrugs(d => d.filter((_, idx) => idx !== i)); }
  function updateDrug(i: number, f: keyof Drug, v: string) {
    setDrugs(d => d.map((drug, idx) => idx === i ? { ...drug, [f]: v } : drug));
  }

  // ─── Advance (non-completion status transitions) ──────────────────────────
  async function advance() {
    if (!nextStatus) return;

      setLoading(true);
    const now    = new Date().toISOString();
    const update: Record<string, string> = { status: nextStatus };
    const field  = STATUS_FIELD[nextStatus];
    if (field) update[field] = now;
    await supabase.from("bookings").update(update).eq("id", bookingId);

    if (nextStatus === "arrived") {
      router.push(`/dashboard/clinical-note/${bookingId}`);
      return;
    }

    setStatus(nextStatus);
    setLoading(false);
  }

  // ─── Lab catalogue loader ─────────────────────────────────────────────────
  async function loadCatalogue() {
    if (catalogue.length > 0) return; // already loaded
    setLoadingCatalogue(true);
    const { data: lab, error: labErr } = await supabase
      .from("lab_partners").select("id, name").eq("active", true).limit(1).single();
    if (labErr) console.error("[loadCatalogue] lab_partners error:", labErr);
    if (!lab) { setLoadingCatalogue(false); return; }
    setLabPartner(lab);
    const { data: tests, error: testsErr } = await supabase
      .from("investigation_catalogue")
      .select("id, test_name, test_code, price, turnaround_hours, sample_type")
      .eq("lab_partner_id", lab.id).eq("active", true).order("test_name");
    if (testsErr) console.error("[loadCatalogue] investigation_catalogue error:", testsErr);
    console.log("[loadCatalogue] tests fetched:", tests?.length ?? 0);
    setCatalogue(tests ?? []);
    setLoadingCatalogue(false);
  }

  function toggleTest(item: CatalogueItem) {
    setSelectedTests(prev => {
      const exists = prev.find(t => t.catalogue_id === item.id);
      if (exists) return prev.filter(t => t.catalogue_id !== item.id);
      return [...prev, { catalogue_id: item.id, test_name: item.test_name, test_code: item.test_code, price: item.price }];
    });
  }

  // ─── Submit investigation order ───────────────────────────────────────────
  async function submitInvestigations() {
    if (!labPartner || selectedTests.length === 0) return;
    setSubmittingInv(true);
    await supabase.from("investigation_orders").insert({
      booking_id:    bookingId,
      patient_id:    patientId,
      provider_id:   providerId,
      lab_partner_id: labPartner.id,
      tests:         selectedTests,
      clinical_notes: invNotes.trim() || null,
      status:        "ordered",
    });
    setSubmittingInv(false);
    setPostStep("prescription");
  }

  // ─── Complete visit (calls server route) ─────────────────────────────────
  async function completeVisit() {
    setPostStep("completing");
    const validDrugs = drugs.filter(d => d.name.trim());
    const res = await fetch("/api/complete-visit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bookingId, drugs: validDrugs }),
    });
    if (res.ok) {
      const data = await res.json();
      if (validDrugs.length > 0 && data.visitId) {
        setPharmacyPrompt({ visitId: data.visitId, patientId: data.patientId, pdfUrl: data.pdfUrl });
        setPostStep(null);
      } else {
        router.push("/dashboard");
      }
    } else {
      setPostStep("prescription");
    }
  }

  const filteredCatalogue = catalogue.filter(t =>
    t.test_name.toLowerCase().includes(invSearch.toLowerCase()) ||
    (t.test_code ?? "").toLowerCase().includes(invSearch.toLowerCase())
  );
  const totalTestPrice = selectedTests.reduce((s, t) => s + t.price, 0);

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">

      {/* Progress steps — hidden during post-consultation */}
      {!postStep && !pharmacyPrompt && (
        <div className="card p-5">
          <div className="space-y-3">
            {STEPS.filter(s => s.status !== "completed" || status === "completed").map((step, i) => {
              const idx    = STEPS.findIndex(s => s.status === status);
              const done   = i < idx;
              const active = i === idx;
              return (
                <div key={step.status} className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${
                    done   ? "bg-teal-brand text-white" :
                    active ? "bg-blue-brand text-white" :
                             "bg-gray-100 text-gray-400"
                  }`}>
                    {done ? "✓" : i + 1}
                  </div>
                  <span className={`text-sm ${active ? "font-semibold text-gray-900" : done ? "text-gray-500" : "text-gray-300"}`}>
                    {step.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Call patient */}
      {!postStep && !pharmacyPrompt && (
        <a href={`tel:${patientPhone}`} className="card p-4 flex items-center gap-3 hover:shadow-card-md transition-shadow">
          <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center text-xl">📞</div>
          <div>
            <p className="font-semibold text-gray-900">Call patient</p>
            <p className="text-sm text-gray-500">{patientPhone}</p>
          </div>
        </a>
      )}


      {/* Continue Clinical Note (arrived or in_progress — provider navigated back) */}
      {(status === "arrived" || status === "in_progress") && !postStep && !pharmacyPrompt && (
        <a href={`/dashboard/clinical-note/${bookingId}`}
          className="w-full py-3 rounded-xl font-semibold text-white bg-teal-brand hover:bg-teal-700 transition-colors flex items-center justify-center gap-2">
          📋 Continue Clinical Note →
        </a>
      )}

      {/* ── ADVANCE BUTTON (non-completion steps) ── */}
      {status !== "completed" && nextStatus && status !== "arrived" && status !== "in_progress" && !postStep && !pharmacyPrompt && (
        <button onClick={advance} disabled={loading}
          className="w-full py-3 rounded-xl font-semibold text-white transition-colors disabled:opacity-50 bg-blue-brand hover:bg-blue-700">
          {loading ? "Updating…" : currentStep.action}
        </button>
      )}

      {/* ══════════════════════════════════════════════
          POST-CONSULTATION STEPS
          ══════════════════════════════════════════════ */}

      {/* ── STEP 1: INVESTIGATIONS ── */}
      {postStep === "investigations" && (
        <div className="space-y-4">
          <StepHeader step={1} total={3} label="Lab Investigations" />

          {!showInvForm ? (
            <PromptCard
              emoji="🔬"
              title="Does this patient need any investigations?"
              subtitle="Order blood tests, imaging, or other diagnostic workup from our partner lab"
              primaryLabel="Yes, order investigations"
              onPrimary={() => { setShowInvForm(true); loadCatalogue(); }}
              skipLabel="No, skip to prescription"
              onSkip={() => setPostStep("prescription")}
            />
          ) : (
            <div className="card p-5 space-y-4">
              <div className="flex items-center justify-between">
                <p className="font-semibold text-gray-900">
                  {labPartner ? `Lab: ${labPartner.name}` : "Loading tests…"}
                </p>
                {selectedTests.length > 0 && (
                  <span className="text-sm font-medium text-teal-brand">
                    {selectedTests.length} selected · ₦{totalTestPrice.toLocaleString()}
                  </span>
                )}
              </div>

              {/* Search */}
              <input
                className="input"
                placeholder="Search tests…"
                value={invSearch}
                onChange={e => setInvSearch(e.target.value)}
              />

              {/* Catalogue */}
              {loadingCatalogue ? (
                <p className="text-sm text-gray-400 text-center py-4">Loading catalogue…</p>
              ) : filteredCatalogue.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-4">No tests found</p>
              ) : (
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {filteredCatalogue.map(item => {
                    const selected = !!selectedTests.find(t => t.catalogue_id === item.id);
                    return (
                      <button
                        key={item.id}
                        onClick={() => toggleTest(item)}
                        className={`w-full text-left flex items-center justify-between p-3 rounded-xl border transition-colors ${
                          selected ? "border-teal-brand bg-teal-50" : "border-gray-100 hover:border-gray-200"
                        }`}
                      >
                        <div>
                          <p className={`text-sm font-medium ${selected ? "text-teal-700" : "text-gray-900"}`}>
                            {item.test_name}
                          </p>
                          <p className="text-xs text-gray-400">
                            {item.sample_type ?? "Blood"} · {item.turnaround_hours ?? "—"}h TAT
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-gray-600">
                            ₦{item.price.toLocaleString()}
                          </span>
                          <div className={`w-5 h-5 rounded flex items-center justify-center text-xs font-bold ${
                            selected ? "bg-teal-brand text-white" : "border border-gray-300 text-transparent"
                          }`}>✓</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Clinical indication */}
              <div>
                <label className="label">Clinical Indication</label>
                <textarea className="input resize-none" rows={2}
                  placeholder="Reason for investigation, history for lab…"
                  value={invNotes} onChange={e => setInvNotes(e.target.value)} />
              </div>

              <div className="flex gap-3">
                <button
                  disabled={selectedTests.length === 0 || submittingInv}
                  onClick={submitInvestigations}
                  className="flex-1 py-2.5 bg-teal-brand text-white rounded-xl font-semibold text-sm hover:bg-teal-700 disabled:opacity-40 transition-colors"
                >
                  {submittingInv ? "Ordering…" : "Order & Continue →"}
                </button>
                <button
                  onClick={() => setPostStep("prescription")}
                  className="flex-1 py-2.5 border border-gray-200 text-gray-600 rounded-xl font-semibold text-sm hover:bg-gray-50"
                >
                  Skip
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── STEP 2: PRESCRIPTION ── */}
      {postStep === "prescription" && (
        <div className="space-y-4">
          <StepHeader step={2} total={3} label="Prescription" />

          {!showRx ? (
            <PromptCard
              emoji="💊"
              title="Does this patient need a prescription?"
              subtitle="Prescribe medications for the patient to take at home"
              primaryLabel="Yes, write prescription"
              onPrimary={() => { setShowRx(true); if (drugs.length === 0) addDrug(); }}
              skipLabel="No, complete visit"
              onSkip={completeVisit}
            />
          ) : (
            <div className="card p-5 space-y-3">
              <h3 className="font-semibold text-gray-900">Prescription</h3>

              {drugs.map((drug, i) => (
                <div key={i} className="border border-gray-100 rounded-xl p-3 space-y-2 bg-gray-50">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-gray-500">Drug {i + 1}</p>
                    <button onClick={() => removeDrug(i)} className="text-xs text-red-500 hover:text-red-700">
                      Remove
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs font-medium text-gray-600 block mb-1">Drug name</label>
                      <input className="input text-sm" placeholder="e.g. Amoxicillin"
                        value={drug.name} onChange={e => updateDrug(i, "name", e.target.value)} />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-600 block mb-1">Dosage</label>
                      <input className="input text-sm" placeholder="e.g. 500mg"
                        value={drug.dosage} onChange={e => updateDrug(i, "dosage", e.target.value)} />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-600 block mb-1">Frequency</label>
                      <select className="input text-sm" value={drug.frequency}
                        onChange={e => updateDrug(i, "frequency", e.target.value)}>
                        <option>Once daily</option>
                        <option>Twice daily</option>
                        <option>Three times daily</option>
                        <option>Four times daily</option>
                        <option>Every 8 hours</option>
                        <option>Every 6 hours</option>
                        <option>At night</option>
                        <option>As needed</option>
                        <option>Stat (one-time)</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-600 block mb-1">Duration</label>
                      <input className="input text-sm" placeholder="e.g. 5 days"
                        value={drug.duration} onChange={e => updateDrug(i, "duration", e.target.value)} />
                    </div>
                  </div>
                </div>
              ))}

              <button onClick={addDrug}
                className="w-full py-2 border border-dashed border-gray-300 rounded-xl text-sm text-gray-500 hover:border-teal-brand hover:text-teal-brand transition-colors">
                + Add another drug
              </button>

              <button onClick={completeVisit}
                className="w-full py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl font-semibold transition-colors">
                Complete Visit →
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── COMPLETING SPINNER ── */}
      {postStep === "completing" && (
        <div className="card p-10 flex flex-col items-center gap-4 text-center">
          <div className="w-10 h-10 border-4 border-teal-brand border-t-transparent rounded-full animate-spin" />
          <p className="font-semibold text-gray-700">Completing visit…</p>
          <p className="text-sm text-gray-400">Updating wallet · Notifying patient · Generating PDF</p>
        </div>
      )}

      {/* ── PHARMACY PROMPT ── */}
      {pharmacyPrompt && (
        <div className="card p-6 border-2 border-teal-brand space-y-4">
          <StepHeader step={3} total={3} label="Pharmacy Delivery" />
          <div className="flex items-center gap-3">
            <span className="text-2xl">🛵</span>
            <div>
              <p className="font-bold text-gray-900">Send prescription to partner pharmacy?</p>
              <p className="text-sm text-gray-500">The patient can pay online and receive medications at their door.</p>
            </div>
          </div>
          {sendingToPharmacy && (
            <p className="text-sm text-teal-brand font-medium">Sending to pharmacy…</p>
          )}
          <div className="flex gap-3">
            <button
              disabled={sendingToPharmacy}
              onClick={async () => {
                setSendingToPharmacy(true);
                const res = await fetch("/api/pharmacy/order", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    visitId:            pharmacyPrompt.visitId,
                    patientId:          pharmacyPrompt.patientId,
                    prescriptionPdfUrl: pharmacyPrompt.pdfUrl,
                    drugs:              drugs.filter(d => d.name.trim()),
                  }),
                });
                setSendingToPharmacy(false);
                const data = res.ok ? await res.json() : {};
                router.push(data.requiresReview
                  ? "/dashboard?notice=controlled_drug_flagged"
                  : "/dashboard?notice=pharmacy_order_sent");
              }}
              className="flex-1 py-2.5 bg-teal-brand text-white rounded-xl font-semibold text-sm hover:bg-teal-700 disabled:opacity-50"
            >
              Yes, send for delivery
            </button>
            <button
              onClick={() => router.push("/dashboard")}
              className="flex-1 py-2.5 border border-gray-200 text-gray-600 rounded-xl font-semibold text-sm hover:bg-gray-50"
            >
              No, skip
            </button>
          </div>
        </div>
      )}

    </div>
  );
}

// ─── Small helpers ────────────────────────────────────────────────────────────

function StepHeader({ step, total, label }: { step: number; total: number; label: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="w-8 h-8 rounded-full bg-blue-brand text-white flex items-center justify-center text-sm font-bold shrink-0">
        {step}
      </div>
      <div>
        <p className="font-semibold text-gray-900">{label}</p>
        <p className="text-xs text-gray-400">Step {step} of {total}</p>
      </div>
    </div>
  );
}

function PromptCard({ emoji, title, subtitle, primaryLabel, onPrimary, skipLabel, onSkip }: {
  emoji: string; title: string; subtitle: string;
  primaryLabel: string; onPrimary: () => void;
  skipLabel: string; onSkip: () => void;
}) {
  return (
    <div className="card p-6 flex flex-col items-center text-center gap-4">
      <span className="text-4xl">{emoji}</span>
      <div>
        <p className="font-bold text-gray-900 text-base">{title}</p>
        <p className="text-sm text-gray-500 mt-1">{subtitle}</p>
      </div>
      <button onClick={onPrimary}
        className="w-full py-3 bg-blue-brand text-white rounded-xl font-semibold hover:bg-blue-700 transition-colors">
        {primaryLabel}
      </button>
      <button onClick={onSkip} className="text-sm text-gray-400 hover:text-gray-600">
        {skipLabel}
      </button>
    </div>
  );
}
