"use client";
import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  FlaskConical, Pill, Hospital, ArrowLeft, ArrowRight, Check, AlertCircle, Pencil, Info, ChevronRight, type LucideIcon,
} from "lucide-react";
import { createClient } from "@/lib/supabase";
import PasswordInput from "@/components/ui/PasswordInput";
import { PORTALS, SUPPORT_EMAIL, SUPPORT_MAILTO, type PortalType } from "@/components/portal/config";
import { Spinner, ui } from "@/components/portal/ui";

type FacilityType = PortalType;

const INDIVIDUAL_PORTAL_URL = "https://provider.streetdocmd.com/register";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const NIGERIAN_STATES = [
  "Abia","Adamawa","Akwa Ibom","Anambra","Bauchi","Bayelsa","Benue","Borno",
  "Cross River","Delta","Ebonyi","Edo","Ekiti","Enugu","FCT","Gombe","Imo",
  "Jigawa","Kaduna","Kano","Katsina","Kebbi","Kogi","Kwara","Lagos","Nasarawa",
  "Niger","Ogun","Ondo","Osun","Oyo","Plateau","Rivers","Sokoto","Taraba",
  "Yobe","Zamfara",
];

const HOSPITAL_SPECIALTIES = [
  "General Medicine","Surgery","Paediatrics","Obstetrics & Gynaecology",
  "Orthopaedics","Cardiology","ICU","Dermatology","ENT","Ophthalmology",
  "Psychiatry","Radiology","Neurology",
];

const FACILITY_TYPES: { type: FacilityType; icon: LucideIcon; title: string; desc: string; earn: string }[] = [
  { type: "lab", icon: FlaskConical, title: "Laboratory", desc: "Receive investigation orders and deliver results directly to patients and providers.", earn: "Earn 85% of test fees" },
  { type: "pharmacy", icon: Pill, title: "Pharmacy", desc: "Receive digital prescriptions and deliver medications to patients at home.", earn: "Earn 92% of drug sales" },
  { type: "hospital", icon: Hospital, title: "Hospital", desc: "Receive patient referrals from StreetdocMD doctors.", earn: "Per-referral partnership" },
];

const STEPS = ["Facility & login", "Services", "Review"];

function Field({ label, required, error, hint, children, className = "" }: {
  label: string; required?: boolean; error?: string; hint?: string; children: React.ReactNode; className?: string;
}) {
  return (
    <div className={className}>
      <label className={ui.label}>{label}{required && <span className="text-red-500"> *</span>}</label>
      {children}
      {error ? <p className={ui.fieldError}>{error}</p> : hint ? <p className={ui.hint}>{hint}</p> : null}
    </div>
  );
}

function Header({ onBack, backLabel }: { onBack?: () => void; backLabel?: string }) {
  return (
    <header className="bg-gradient-to-b from-navy-700 to-navy-800 text-white">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
        <Image src="/logo-white.png" alt="StreetdocMD" width={220} height={88} className="h-8 w-auto" priority />
        {onBack ? (
          <button onClick={onBack} className="inline-flex items-center gap-1.5 text-sm text-blue-100 hover:text-white">
            <ArrowLeft size={15} aria-hidden /> {backLabel}
          </button>
        ) : (
          <a href={INDIVIDUAL_PORTAL_URL} className="inline-flex items-center gap-1.5 text-sm text-blue-100 hover:text-white">
            <ArrowLeft size={15} aria-hidden /> Change registration type
          </a>
        )}
      </div>
    </header>
  );
}

export default function FacilityRegClient({ initialType = null }: { initialType?: FacilityType | null }) {
  const router = useRouter();
  const [facilityType, setFacilityType] = useState<FacilityType | null>(initialType);
  const [formStep, setFormStep] = useState<1 | 2 | 3>(1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [showErrors, setShowErrors] = useState(false);
  // Portal login, created at registration so the facility lands on its portal right away
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [basic, setBasic] = useState({
    name: "", email: "", phone: "", address: "",
    city: "Ibadan", state: "Oyo",
    registration_number: "", cac_number: "",
    contact_person_name: "", contact_person_role: "", operating_hours: "",
    questions: "",
  });

  const [labData, setLabData] = useState({
    home_collection: false, collection_radius_km: "", num_collectors: "",
    accreditation_body: "", accreditation_number: "",
    standard_turnaround_hours: "24", urgent_turnaround_hours: "4",
  });

  const [pharmData, setPharmData] = useState({
    delivery_available: true, delivery_radius_km: "5", delivery_fee: "0",
    pcn_registration: "", dispensing_hours: "",
  });

  const [hospData, setHospData] = useState({
    hospital_level: "secondary" as "primary" | "secondary" | "tertiary",
    emergency_available: true, ambulance_available: false, bed_count: "",
    specialties: [] as string[], other_specialty: "",
  });

  function setB(k: keyof typeof basic, v: string) { setBasic(b => ({ ...b, [k]: v })); }

  function toggleSpecialty(s: string) {
    setHospData(h => ({
      ...h,
      specialties: h.specialties.includes(s) ? h.specialties.filter(x => x !== s) : [...h.specialties, s],
    }));
  }

  // ── Validation ──────────────────────────────────────────────────────────────
  const step1Errors: Partial<Record<string, string>> = {};
  if (!basic.name.trim()) step1Errors.name = "Enter your facility's name";
  if (!basic.email.trim()) step1Errors.email = "Enter an email address";
  else if (!EMAIL_RE.test(basic.email.trim())) step1Errors.email = "Enter a valid email address";
  if (!basic.phone.trim()) step1Errors.phone = "Enter a phone number";
  else if (basic.phone.replace(/\D/g, "").length < 10) step1Errors.phone = "Enter a valid phone number";
  if (!basic.address.trim()) step1Errors.address = "Enter your facility's address";
  if (!basic.contact_person_name.trim()) step1Errors.contact_person_name = "Tell us who we should speak to";
  if (password.length < 8) step1Errors.password = "Use at least 8 characters";
  if (password !== confirmPassword) step1Errors.confirmPassword = "Passwords don't match";

  const step2Errors: Partial<Record<string, string>> = {};
  if (facilityType === "pharmacy" && !pharmData.pcn_registration.trim()) step2Errors.pcn = "Your PCN premises registration number is required";

  function next(from: 1 | 2) {
    const errs = from === 1 ? step1Errors : step2Errors;
    if (Object.keys(errs).length > 0) { setShowErrors(true); return; }
    setShowErrors(false);
    setFormStep(from === 1 ? 2 : 3);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  const e1 = (k: string) => (showErrors ? step1Errors[k] : undefined);
  const e2 = (k: string) => (showErrors ? step2Errors[k] : undefined);

  async function handleSubmit() {
    if (submitting) return;
    setSubmitting(true);
    setError("");
    try {
      const typeData = facilityType === "lab" ? labData
        : facilityType === "pharmacy" ? pharmData
        : {
            hospital_level: hospData.hospital_level,
            emergency_available: hospData.emergency_available,
            ambulance_available: hospData.ambulance_available,
            bed_count: hospData.bed_count,
            specialties: [...hospData.specialties, hospData.other_specialty.trim()].filter(Boolean),
          };

      const res = await fetch("/api/facility/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          facility_type: facilityType,
          ...basic,
          email: basic.email.trim(),
          password,
          type_specific_data: typeData,
        }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error ?? "Submission failed. Please try again.");
      }

      // Sign in with the new login and go to the facility's portal (shows "under review" until approved)
      const { error: signInErr } = await createClient().auth.signInWithPassword({ email: basic.email.trim(), password });
      if (signInErr) {
        router.push(`${PORTALS[facilityType!].base}/login`);
        return;
      }
      router.push(PORTALS[facilityType!].base);
      router.refresh();
    } catch (e: any) {
      setError(e.message ?? "Submission failed. Please try again.");
      setSubmitting(false);
    }
  }

  // ── Type selection ─────────────────────────────────────────────────────────
  if (!facilityType) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="bg-gradient-to-b from-navy-800 to-navy-700 text-white pb-16 pt-10 px-4 text-center">
          <p className="text-blue-300 text-xs font-semibold uppercase tracking-widest">Partner network</p>
          <h1 className="mt-2 text-2xl sm:text-3xl font-bold">Join the StreetdocMD partner network</h1>
          <p className="mt-2 text-blue-100 max-w-lg mx-auto text-sm sm:text-base">
            Register your facility to receive patients from StreetdocMD doctors. It takes about 5 minutes.
          </p>
        </div>

        <div className="max-w-4xl mx-auto px-4 sm:px-6 -mt-10 pb-16">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-5">
            {FACILITY_TYPES.map(f => (
              <button
                key={f.type}
                onClick={() => { setFacilityType(f.type); setFormStep(1); }}
                className={`${ui.card} p-6 text-left hover:shadow-card-md hover:border-blue-mid transition-all group flex flex-col`}
              >
                <span className="w-11 h-11 rounded-xl bg-blue-light text-blue-brand flex items-center justify-center">
                  <f.icon size={22} aria-hidden />
                </span>
                <p className="mt-4 font-bold text-gray-900 text-lg group-hover:text-blue-brand">{f.title}</p>
                <p className="mt-1.5 text-sm text-gray-500 flex-1">{f.desc}</p>
                <div className="mt-5 flex items-center justify-between">
                  <span className="text-xs font-semibold text-green-700 bg-green-50 ring-1 ring-inset ring-green-200 px-2.5 py-1 rounded-full">{f.earn}</span>
                  <ChevronRight size={18} className="text-gray-300 group-hover:text-blue-brand" aria-hidden />
                </div>
              </button>
            ))}
          </div>

          <div className={`${ui.card} mt-6 px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4`}>
            <p className="text-sm text-gray-600 flex-1">
              This page is for <strong>organisations</strong>: a hospital, laboratory or pharmacy. Registering as an individual doctor,
              nurse, physiotherapist or lab scientist?
            </p>
            <a href={INDIVIDUAL_PORTAL_URL} className={`${ui.btnLink} whitespace-nowrap`}>Individual practitioner sign-up</a>
          </div>

          <p className="mt-6 text-sm text-gray-500 text-center">
            Already registered?{" "}
            <Link href="/lab-portal/login" className={ui.btnLink}>Lab</Link> ·{" "}
            <Link href="/pharmacy-portal/login" className={ui.btnLink}>Pharmacy</Link> ·{" "}
            <Link href="/hospital-portal/login" className={ui.btnLink}>Hospital</Link> sign-in
          </p>
        </div>
      </div>
    );
  }

  const selected = FACILITY_TYPES.find(f => f.type === facilityType)!;
  const alreadyHasAccount = /sign in to your portal/i.test(error);

  // ── Form steps ─────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50">
      <Header onBack={() => { setFacilityType(null); setError(""); setShowErrors(false); }} backLabel="Change facility type" />

      <div className="bg-white border-b border-gray-200">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-5">
          <div className="flex items-center gap-3">
            <span className="w-10 h-10 rounded-xl bg-blue-light text-blue-brand flex items-center justify-center shrink-0">
              <selected.icon size={20} aria-hidden />
            </span>
            <div>
              <p className="text-xs font-medium text-gray-500">Partner registration</p>
              <h1 className="text-lg font-bold text-gray-900">{selected.title}</h1>
            </div>
          </div>
          <ol className="mt-5 flex items-center gap-2" aria-label="Progress">
            {STEPS.map((label, i) => {
              const n = i + 1;
              const done = formStep > n;
              const current = formStep === n;
              return (
                <li key={label} className="flex items-center gap-2 flex-1 last:flex-none">
                  <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                    done ? "bg-blue-brand text-white" : current ? "bg-blue-light text-blue-brand ring-2 ring-blue-brand" : "bg-gray-100 text-gray-400"
                  }`} aria-current={current ? "step" : undefined}>
                    {done ? <Check size={14} aria-hidden /> : n}
                  </span>
                  <span className={`text-xs sm:text-sm font-medium whitespace-nowrap ${current ? "text-gray-900" : "text-gray-500"} ${current ? "" : "hidden sm:inline"}`}>{label}</span>
                  {n < STEPS.length && <span className={`h-px flex-1 ${done ? "bg-blue-brand" : "bg-gray-200"}`} />}
                </li>
              );
            })}
          </ol>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        {formStep === 1 && (
          <>
            <section className={`${ui.card} p-5 sm:p-6 space-y-4`}>
              <div>
                <h2 className="font-semibold text-gray-900">Facility</h2>
                <p className="text-xs text-gray-500 mt-0.5">As it appears on your licence.</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label="Facility name" required error={e1("name")} className="md:col-span-2">
                  <input className={ui.input} value={basic.name} onChange={e => setB("name", e.target.value)} />
                </Field>
                <Field label="Phone number" required error={e1("phone")} hint="We'll text approval and order alerts here">
                  <input className={ui.input} type="tel" autoComplete="tel" placeholder="080..." value={basic.phone} onChange={e => setB("phone", e.target.value)} />
                </Field>
                <Field label="Operating hours">
                  <input className={ui.input} value={basic.operating_hours} onChange={e => setB("operating_hours", e.target.value)} placeholder="e.g. Mon–Sat 8am–8pm" />
                </Field>
                <Field label="Full address" required error={e1("address")} className="md:col-span-2">
                  <input className={ui.input} autoComplete="street-address" value={basic.address} onChange={e => setB("address", e.target.value)} />
                </Field>
                <Field label="City">
                  <input className={ui.input} value={basic.city} onChange={e => setB("city", e.target.value)} />
                </Field>
                <Field label="State">
                  <select className={ui.input} value={basic.state} onChange={e => setB("state", e.target.value)}>
                    {NIGERIAN_STATES.map(s => <option key={s}>{s}</option>)}
                  </select>
                </Field>
                <Field label="Registration / licence number">
                  <input className={ui.input} value={basic.registration_number} onChange={e => setB("registration_number", e.target.value)} />
                </Field>
                <Field label="CAC number">
                  <input className={ui.input} value={basic.cac_number} onChange={e => setB("cac_number", e.target.value)} />
                </Field>
                <Field label="Contact person" required error={e1("contact_person_name")}>
                  <input className={ui.input} autoComplete="name" value={basic.contact_person_name} onChange={e => setB("contact_person_name", e.target.value)} />
                </Field>
                <Field label="Their role">
                  <input className={ui.input} value={basic.contact_person_role} onChange={e => setB("contact_person_role", e.target.value)} placeholder="e.g. Director, Manager" />
                </Field>
              </div>
            </section>

            <section className={`${ui.card} p-5 sm:p-6 space-y-4`}>
              <div>
                <h2 className="font-semibold text-gray-900">Portal login</h2>
                <p className="text-xs text-gray-500 mt-0.5">You&apos;ll use these to sign in to the {PORTALS[facilityType].name}. Use an email your team checks.</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label="Email address" required error={e1("email")} className="md:col-span-2">
                  <input className={ui.input} type="email" autoComplete="email" value={basic.email} onChange={e => setB("email", e.target.value)} />
                </Field>
                <Field label="Password" required error={e1("password")} hint="At least 8 characters">
                  <PasswordInput className={ui.input} value={password} onChange={e => setPassword(e.target.value)} autoComplete="new-password" />
                </Field>
                <Field label="Confirm password" required error={e1("confirmPassword") ?? (confirmPassword && password !== confirmPassword ? "Passwords don't match" : undefined)}>
                  <PasswordInput className={ui.input} value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} autoComplete="new-password" />
                </Field>
              </div>
            </section>

            {showErrors && Object.keys(step1Errors).length > 0 && (
              <p role="alert" className="text-sm text-red-600 flex items-center gap-1.5"><AlertCircle size={15} aria-hidden /> Please fix the highlighted fields.</p>
            )}
            <div className="flex justify-end">
              <button onClick={() => next(1)} className={`${ui.btnPrimary} w-full sm:w-auto px-6 py-3`}>
                Continue <ArrowRight size={16} aria-hidden />
              </button>
            </div>
          </>
        )}

        {formStep === 2 && (
          <>
            <section className={`${ui.card} p-5 sm:p-6 space-y-5`}>
              <div>
                <h2 className="font-semibold text-gray-900">{selected.title} services</h2>
                <p className="text-xs text-gray-500 mt-0.5">Helps us route the right patients to you.</p>
              </div>

              {facilityType === "lab" && (
                <>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input type="checkbox" className={ui.checkbox} checked={labData.home_collection}
                      onChange={e => setLabData(d => ({ ...d, home_collection: e.target.checked }))} />
                    <span className="text-sm font-medium text-gray-700">Home sample collection available</span>
                  </label>
                  {labData.home_collection && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:pl-7">
                      <Field label="Collection radius (km)">
                        <input className={ui.input} type="number" min="0" value={labData.collection_radius_km}
                          onChange={e => setLabData(d => ({ ...d, collection_radius_km: e.target.value }))} />
                      </Field>
                      <Field label="Number of sample collectors">
                        <input className={ui.input} type="number" min="0" value={labData.num_collectors}
                          onChange={e => setLabData(d => ({ ...d, num_collectors: e.target.value }))} />
                      </Field>
                    </div>
                  )}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Field label="Accreditation body">
                      <input className={ui.input} placeholder="e.g. MLSCN" value={labData.accreditation_body}
                        onChange={e => setLabData(d => ({ ...d, accreditation_body: e.target.value }))} />
                    </Field>
                    <Field label="Accreditation number">
                      <input className={ui.input} value={labData.accreditation_number}
                        onChange={e => setLabData(d => ({ ...d, accreditation_number: e.target.value }))} />
                    </Field>
                    <Field label="Standard turnaround (hours)">
                      <input className={ui.input} type="number" min="1" value={labData.standard_turnaround_hours}
                        onChange={e => setLabData(d => ({ ...d, standard_turnaround_hours: e.target.value }))} />
                    </Field>
                    <Field label="Urgent turnaround (hours)">
                      <input className={ui.input} type="number" min="1" value={labData.urgent_turnaround_hours}
                        onChange={e => setLabData(d => ({ ...d, urgent_turnaround_hours: e.target.value }))} />
                    </Field>
                  </div>
                </>
              )}

              {facilityType === "pharmacy" && (
                <>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input type="checkbox" className={ui.checkbox} checked={pharmData.delivery_available}
                      onChange={e => setPharmData(d => ({ ...d, delivery_available: e.target.checked }))} />
                    <span className="text-sm font-medium text-gray-700">Home delivery available</span>
                  </label>
                  {pharmData.delivery_available && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:pl-7">
                      <Field label="Delivery radius (km)">
                        <input className={ui.input} type="number" min="0" value={pharmData.delivery_radius_km}
                          onChange={e => setPharmData(d => ({ ...d, delivery_radius_km: e.target.value }))} />
                      </Field>
                      <Field label="Delivery fee (₦)" hint="0 means free delivery">
                        <input className={ui.input} type="number" min="0" value={pharmData.delivery_fee}
                          onChange={e => setPharmData(d => ({ ...d, delivery_fee: e.target.value }))} />
                      </Field>
                    </div>
                  )}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Field label="PCN registration number" required error={e2("pcn")}>
                      <input className={ui.input} value={pharmData.pcn_registration}
                        onChange={e => setPharmData(d => ({ ...d, pcn_registration: e.target.value }))} />
                    </Field>
                    <Field label="Dispensing hours">
                      <input className={ui.input} placeholder="e.g. Mon–Sat 8am–9pm" value={pharmData.dispensing_hours}
                        onChange={e => setPharmData(d => ({ ...d, dispensing_hours: e.target.value }))} />
                    </Field>
                  </div>
                </>
              )}

              {facilityType === "hospital" && (
                <>
                  <Field label="Hospital level" required>
                    <select className={ui.input} value={hospData.hospital_level}
                      onChange={e => setHospData(d => ({ ...d, hospital_level: e.target.value as typeof d.hospital_level }))}>
                      <option value="primary">Primary Health Centre</option>
                      <option value="secondary">Secondary Hospital</option>
                      <option value="tertiary">Tertiary / Teaching Hospital</option>
                    </select>
                  </Field>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input type="checkbox" className={ui.checkbox} checked={hospData.emergency_available}
                        onChange={e => setHospData(d => ({ ...d, emergency_available: e.target.checked }))} />
                      <span className="text-sm font-medium text-gray-700">Emergency services available</span>
                    </label>
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input type="checkbox" className={ui.checkbox} checked={hospData.ambulance_available}
                        onChange={e => setHospData(d => ({ ...d, ambulance_available: e.target.checked }))} />
                      <span className="text-sm font-medium text-gray-700">Ambulance available</span>
                    </label>
                    <Field label="Approximate bed count">
                      <input className={ui.input} type="number" min="0" value={hospData.bed_count}
                        onChange={e => setHospData(d => ({ ...d, bed_count: e.target.value }))} />
                    </Field>
                  </div>
                  <div>
                    <p className={ui.label}>Specialties</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {HOSPITAL_SPECIALTIES.map(s => (
                        <label key={s} className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                          <input type="checkbox" className={ui.checkbox} checked={hospData.specialties.includes(s)} onChange={() => toggleSpecialty(s)} />
                          {s}
                        </label>
                      ))}
                    </div>
                    <Field label="Other specialty" className="mt-4">
                      <input className={ui.input} placeholder="Any other specialty not listed above"
                        value={hospData.other_specialty} onChange={e => setHospData(d => ({ ...d, other_specialty: e.target.value }))} />
                    </Field>
                  </div>
                </>
              )}
            </section>

            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
              <button onClick={() => { setShowErrors(false); setFormStep(1); }} className={`${ui.btnSecondary} w-full sm:w-auto px-6 py-3`}>
                <ArrowLeft size={16} aria-hidden /> Back
              </button>
              <button onClick={() => next(2)} className={`${ui.btnPrimary} w-full sm:w-auto px-6 py-3`}>
                Review <ArrowRight size={16} aria-hidden />
              </button>
            </div>
          </>
        )}

        {formStep === 3 && (
          <>
            <section className={ui.card}>
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                <h2 className="font-semibold text-gray-900">Facility & login</h2>
                <button onClick={() => setFormStep(1)} className={`${ui.btnLink} inline-flex items-center gap-1`}><Pencil size={13} aria-hidden /> Edit</button>
              </div>
              <dl className="px-5 py-4 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
                {[
                  ["Facility", basic.name],
                  ["Login email", basic.email.trim()],
                  ["Phone", basic.phone],
                  ["Address", [basic.address, basic.city, basic.state].filter(Boolean).join(", ")],
                  ["Contact", [basic.contact_person_name, basic.contact_person_role].filter(Boolean).join(" · ")],
                  ["Hours", basic.operating_hours],
                  ["Licence no.", basic.registration_number],
                  ["CAC no.", basic.cac_number],
                ].filter(([, v]) => v).map(([k, v]) => (
                  <div key={k}><dt className="text-xs text-gray-500">{k}</dt><dd className="text-gray-900 break-words">{v}</dd></div>
                ))}
              </dl>
            </section>

            <section className={ui.card}>
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                <h2 className="font-semibold text-gray-900">{selected.title} services</h2>
                <button onClick={() => setFormStep(2)} className={`${ui.btnLink} inline-flex items-center gap-1`}><Pencil size={13} aria-hidden /> Edit</button>
              </div>
              <div className="px-5 py-4 text-sm text-gray-700 space-y-1.5">
                {facilityType === "lab" && (
                  <>
                    <p>Home collection: {labData.home_collection ? `Yes${labData.collection_radius_km ? ` (${labData.collection_radius_km} km radius)` : ""}` : "No"}</p>
                    {labData.accreditation_body && <p>Accreditation: {labData.accreditation_body} {labData.accreditation_number}</p>}
                    <p>Turnaround: {labData.standard_turnaround_hours}h standard · {labData.urgent_turnaround_hours}h urgent</p>
                  </>
                )}
                {facilityType === "pharmacy" && (
                  <>
                    <p>Delivery: {pharmData.delivery_available ? `Yes (${pharmData.delivery_radius_km} km, ${pharmData.delivery_fee === "0" || !pharmData.delivery_fee ? "free" : `₦${pharmData.delivery_fee}`})` : "No"}</p>
                    <p>PCN: {pharmData.pcn_registration}</p>
                    {pharmData.dispensing_hours && <p>Dispensing hours: {pharmData.dispensing_hours}</p>}
                  </>
                )}
                {facilityType === "hospital" && (
                  <>
                    <p className="capitalize">Level: {hospData.hospital_level}</p>
                    <p>Emergency: {hospData.emergency_available ? "Yes" : "No"} · Ambulance: {hospData.ambulance_available ? "Yes" : "No"}</p>
                    {hospData.bed_count && <p>Beds: {hospData.bed_count}</p>}
                    {(hospData.specialties.length > 0 || hospData.other_specialty.trim()) && (
                      <p>Specialties: {[...hospData.specialties, hospData.other_specialty.trim()].filter(Boolean).join(", ")}</p>
                    )}
                  </>
                )}
              </div>
            </section>

            <div className="rounded-xl border border-blue-mid bg-blue-light px-4 py-3 text-sm text-navy-700 flex gap-2.5">
              <Info size={17} className="mt-0.5 shrink-0 text-blue-brand" aria-hidden />
              <p>
                After you submit, you&apos;ll go straight to your portal, which shows your application status. Our partnerships team reviews
                applications within 48 hours and may ask you for your licence and CAC certificate.
              </p>
            </div>

            <section className={`${ui.card} p-5 sm:p-6`}>
              <Field label="Any questions or suggestions for us?">
                <textarea className={ui.input} rows={3} placeholder="Ask us anything, or share any suggestions"
                  value={basic.questions} onChange={e => setB("questions", e.target.value)} />
              </Field>
            </section>

            {error && (
              <div role="alert" className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">
                <AlertCircle size={16} className="mt-0.5 shrink-0" aria-hidden />
                <div>
                  <p>{error}</p>
                  {alreadyHasAccount && (
                    <Link href={`${PORTALS[facilityType].base}/login`} className="mt-1 inline-block font-semibold underline">Go to sign in</Link>
                  )}
                </div>
              </div>
            )}

            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
              <button onClick={() => setFormStep(2)} disabled={submitting} className={`${ui.btnSecondary} w-full sm:w-auto px-6 py-3`}>
                <ArrowLeft size={16} aria-hidden /> Back
              </button>
              <button onClick={handleSubmit} disabled={submitting} className={`${ui.btnPrimary} w-full sm:w-auto px-8 py-3`}>
                {submitting ? <><Spinner /> Submitting…</> : "Submit application"}
              </button>
            </div>
            <p className="text-xs text-gray-500 text-center">
              Questions? Email us at{" "}
              <a href={SUPPORT_MAILTO} className={ui.btnLink}>{SUPPORT_EMAIL}</a>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
