"use client";
import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";

type FacilityType = "lab" | "pharmacy" | "hospital";

const INDIVIDUAL_PORTAL_URL = "https://provider.streetdocmd.com/register";

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

// Shared field styling — explicit so inputs render correctly even if the
// project's own "input"/"label" utility classes aren't defined/loaded.
const inputClass =
  "w-full px-4 py-2.5 rounded-lg border border-gray-300 bg-white text-sm text-gray-900 " +
  "placeholder:text-gray-400 shadow-sm transition-colors " +
  "focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100";
const labelClass = "block text-sm font-medium text-gray-700 mb-1.5";

export default function FacilityRegClient() {
  const router = useRouter();
  const [step, setStep] = useState<0 | 1 | 2 | 3>(0); // 0=select type, 1-4=form steps
  const [facilityType, setFacilityType] = useState<FacilityType | null>(null);
  const [formStep, setFormStep] = useState<1 | 2 | 3 | 4>(1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // Basic info
  const [basic, setBasic] = useState({
    name: "", email: "", phone: "", address: "",
    city: "Ibadan", state: "Oyo",
    registration_number: "", cac_number: "",
    contact_person_name: "", contact_person_role: "", operating_hours: "",
    questions: "",
  });

  // Lab-specific
  const [labData, setLabData] = useState({
    home_collection: false, collection_radius_km: "", num_collectors: "",
    accreditation_body: "", accreditation_number: "",
    standard_turnaround_hours: "24", urgent_turnaround_hours: "4",
  });

  // Pharmacy-specific
  const [pharmData, setPharmData] = useState({
    delivery_available: true, delivery_radius_km: "5", delivery_fee: "0",
    pcn_registration: "", dispensing_hours: "",
  });

  // Hospital-specific
  const [hospData, setHospData] = useState({
    hospital_level: "secondary" as "primary"|"secondary"|"tertiary",
    emergency_available: true, ambulance_available: false, bed_count: "",
    specialties: [] as string[], other_specialty: "",
  });

  // Documents
  const [docs, setDocs] = useState<{
    licence_url?: string; cac_url?: string; photo_urls: string[];
  }>({ photo_urls: [] });
  const [uploading, setUploading] = useState<string | null>(null);

  const licenceRef = useRef<HTMLInputElement>(null);
  const cacRef = useRef<HTMLInputElement>(null);
  const photoRef = useRef<HTMLInputElement>(null);

  const FACILITY_TYPES: { type: FacilityType; icon: string; title: string; desc: string; earn: string }[] = [
    { type: "lab", icon: "🧪", title: "Laboratory", desc: "Receive investigation orders and deliver results directly to patients and providers", earn: "Earn 85% of test fees" },
    { type: "pharmacy", icon: "💊", title: "Pharmacy", desc: "Receive digital prescriptions and deliver medications to patients at home", earn: "Earn 92% of drug sales" },
    { type: "hospital", icon: "🏥", title: "Hospital", desc: "Receive patient referrals from StreetdocMD providers", earn: "Per referral partnership" },
  ];

  function setB(k: keyof typeof basic, v: string) { setBasic(b => ({ ...b, [k]: v })); }

  async function uploadFile(file: File, path: string): Promise<string | null> {
    const supabase = createClient();
    const { data, error } = await supabase.storage
      .from("facility-applications")
      .upload(path, file, { upsert: true });
    if (error) {
      console.error("Supabase upload error:", error);
      throw error;
    }
    const { data: pub } = supabase.storage.from("facility-applications").getPublicUrl(data.path);
    return pub.publicUrl;
  }

  const [uploadError, setUploadError] = useState("");

  async function handleLicenceUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading("licence");
    setUploadError("");
    try {
      const url = await uploadFile(file, `${Date.now()}-licence-${file.name}`);
      if (url) setDocs(d => ({ ...d, licence_url: url }));
      else setUploadError("Licence upload failed. Check your connection and try again.");
    } catch (err: any) {
      console.error("Licence upload threw:", err);
      setUploadError(err?.message ?? "Licence upload failed unexpectedly.");
    } finally {
      setUploading(null);
    }
  }

  async function handleCacUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading("cac");
    setUploadError("");
    try {
      const url = await uploadFile(file, `${Date.now()}-cac-${file.name}`);
      if (url) setDocs(d => ({ ...d, cac_url: url }));
      else setUploadError("CAC certificate upload failed. Check your connection and try again.");
    } catch (err: any) {
      console.error("CAC upload threw:", err);
      setUploadError(err?.message ?? "CAC certificate upload failed unexpectedly.");
    } finally {
      setUploading(null);
    }
  }

  async function handlePhotosUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []).slice(0, 3);
    if (!files.length) return;
    setUploading("photos");
    setUploadError("");
    try {
      const urls: string[] = [];
      for (const f of files) {
        const url = await uploadFile(f, `${Date.now()}-photo-${f.name}`);
        if (url) urls.push(url);
      }
      if (urls.length) {
        setDocs(d => ({ ...d, photo_urls: [...d.photo_urls, ...urls].slice(0, 3) }));
      } else {
        setUploadError("Photo upload failed. Check your connection and try again.");
      }
    } catch (err: any) {
      console.error("Photo upload threw:", err);
      setUploadError(err?.message ?? "Photo upload failed unexpectedly.");
    } finally {
      setUploading(null);
    }
  }

  function toggleSpecialty(s: string) {
    setHospData(h => ({
      ...h,
      specialties: h.specialties.includes(s)
        ? h.specialties.filter(x => x !== s)
        : [...h.specialties, s],
    }));
  }

  async function handleSubmit() {
    setSubmitting(true);
    setError("");
    try {
      const typeData = facilityType === "lab" ? labData
        : facilityType === "pharmacy" ? pharmData
        : { ...hospData, specialties: [...hospData.specialties, hospData.other_specialty].filter(Boolean) };

      const res = await fetch("/api/facility/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          facility_type: facilityType,
          ...basic,
          type_specific_data: typeData,
          documents: docs,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      router.push(`/register/facility/success?email=${encodeURIComponent(basic.email)}&name=${encodeURIComponent(basic.name)}`);
    } catch (e: any) {
      setError(e.message ?? "Submission failed. Please try again.");
      setSubmitting(false);
    }
  }

  // ── Type selection screen ──────────────────────────────────────────────────
  if (!facilityType) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="bg-teal-700 text-white py-12 px-6 text-center relative">
          <a href={INDIVIDUAL_PORTAL_URL}
            className="absolute top-4 left-4 sm:top-6 sm:left-6 text-teal-200 hover:text-white text-sm underline">
            ← Change registration type
          </a>
          <p className="text-3xl mb-3">🏥</p>
          <h1 className="text-3xl font-bold mb-2">Join the StreetdocMD Partner Network</h1>
          <p className="text-teal-100 max-w-lg mx-auto">
            Register your facility to receive patients.
          </p>
        </div>

        <div className="max-w-3xl mx-auto px-6 py-12">
          <p className="text-center text-sm font-semibold text-gray-500 uppercase tracking-widest mb-8">
            Select your facility type to get started
          </p>

          <div className="bg-white border border-gray-200 rounded-xl px-5 py-4 mb-8 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
            <p className="text-sm text-gray-600 flex-1">
              This page is for <strong>organizations</strong> — a hospital, laboratory, or pharmacy. Registering
              as an individual doctor, nurse, physiotherapist, or lab scientist?
            </p>
            <a href={INDIVIDUAL_PORTAL_URL}
              className="text-sm font-semibold text-teal-700 hover:text-teal-800 whitespace-nowrap">
              Go to the individual practitioner portal →
            </a>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {FACILITY_TYPES.map(f => (
              <button
                key={f.type}
                onClick={() => { setFacilityType(f.type); setFormStep(1); }}
                className="card p-6 text-left hover:shadow-lg hover:border-teal-300 transition-all group"
              >
                <p className="text-4xl mb-4">{f.icon}</p>
                <p className="font-bold text-gray-900 text-lg mb-2 group-hover:text-teal-700">{f.title}</p>
                <p className="text-sm text-gray-500 mb-4">{f.desc}</p>
                <span className="text-xs font-semibold text-teal-700 bg-teal-50 border border-teal-200 px-3 py-1 rounded-full">
                  {f.earn}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const selectedFacility = FACILITY_TYPES.find(f => f.type === facilityType)!;

  // ── Form steps ─────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-teal-700 text-white py-6 px-6">
        <div className="max-w-2xl mx-auto space-y-2">
          <a href={INDIVIDUAL_PORTAL_URL} className="text-teal-300 hover:text-white text-xs underline inline-block">
            ← Change registration type
          </a>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm text-teal-200">Partner Registration</p>
              <h1 className="text-xl font-bold">{selectedFacility.icon} {selectedFacility.title}</h1>
            </div>
            <button onClick={() => setFacilityType(null)} className="text-teal-200 hover:text-white text-sm underline self-start sm:self-auto">
              Change type
            </button>
          </div>
        </div>
      </div>

      {/* Progress */}
      <div className="bg-white border-b border-gray-200 px-6 py-3">
        <div className="max-w-2xl mx-auto flex items-center gap-2">
          {[1,2,3,4].map(n => (
            <div key={n} className="flex items-center gap-2">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                formStep > n ? "bg-teal-600 text-white" : formStep === n ? "bg-teal-100 text-teal-700 border-2 border-teal-600" : "bg-gray-100 text-gray-400"
              }`}>{formStep > n ? "✓" : n}</div>
              {n < 4 && <div className={`flex-1 h-0.5 w-4 sm:w-8 ${formStep > n ? "bg-teal-400" : "bg-gray-200"}`} />}
            </div>
          ))}
          <span className="ml-auto text-xs text-gray-400 hidden sm:inline">Step {formStep} of 4</span>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-6 py-8 space-y-6">

        {/* Step 1: Basic Information */}
        {formStep === 1 && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-gray-900">Basic Information</h2>
            <div className="card p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className={labelClass}>Facility name *</label>
                  <input className={inputClass} value={basic.name} onChange={e => setB("name", e.target.value)} required />
                </div>
                <div>
                  <label className={labelClass}>Email address *</label>
                  <input className={inputClass} type="email" value={basic.email} onChange={e => setB("email", e.target.value)} placeholder="Used for portal login" required />
                </div>
                <div>
                  <label className={labelClass}>Phone number *</label>
                  <input className={inputClass} type="tel" value={basic.phone} onChange={e => setB("phone", e.target.value)} required />
                </div>
                <div className="md:col-span-2">
                  <label className={labelClass}>Full address *</label>
                  <input className={inputClass} value={basic.address} onChange={e => setB("address", e.target.value)} required />
                </div>
                <div>
                  <label className={labelClass}>City</label>
                  <input className={inputClass} value={basic.city} onChange={e => setB("city", e.target.value)} />
                </div>
                <div>
                  <label className={labelClass}>State</label>
                  <select className={inputClass} value={basic.state} onChange={e => setB("state", e.target.value)}>
                    {NIGERIAN_STATES.map(s => <option key={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Registration / Licence number</label>
                  <input className={inputClass} value={basic.registration_number} onChange={e => setB("registration_number", e.target.value)} />
                </div>
                <div>
                  <label className={labelClass}>CAC number</label>
                  <input className={inputClass} value={basic.cac_number} onChange={e => setB("cac_number", e.target.value)} />
                </div>
                <div>
                  <label className={labelClass}>Contact person name</label>
                  <input className={inputClass} value={basic.contact_person_name} onChange={e => setB("contact_person_name", e.target.value)} />
                </div>
                <div>
                  <label className={labelClass}>Contact person role</label>
                  <input className={inputClass} value={basic.contact_person_role} onChange={e => setB("contact_person_role", e.target.value)} placeholder="e.g. Director, Manager" />
                </div>
                <div className="md:col-span-2">
                  <label className={labelClass}>Operating hours</label>
                  <input className={inputClass} value={basic.operating_hours} onChange={e => setB("operating_hours", e.target.value)} placeholder="e.g. Mon–Sat 8am–8pm" />
                </div>
              </div>
            </div>
            <div className="flex justify-end">
              <button
                onClick={() => setFormStep(2)}
                disabled={!basic.name || !basic.email || !basic.phone || !basic.address}
                className="w-full sm:w-auto px-6 py-3 bg-teal-600 text-white rounded-xl font-semibold hover:bg-teal-700 disabled:opacity-40"
              >
                Next →
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Facility-Specific */}
        {formStep === 2 && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-gray-900">Facility Details</h2>
            <div className="card p-6 space-y-4">
              {facilityType === "lab" && (
                <>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input type="checkbox" className="w-4 h-4 accent-teal-600" checked={labData.home_collection}
                      onChange={e => setLabData(d => ({ ...d, home_collection: e.target.checked }))} />
                    <span className="text-sm font-medium text-gray-700">Home sample collection available</span>
                  </label>
                  {labData.home_collection && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pl-7">
                      <div>
                        <label className={labelClass}>Collection radius (km)</label>
                        <input className={inputClass} type="number" value={labData.collection_radius_km}
                          onChange={e => setLabData(d => ({ ...d, collection_radius_km: e.target.value }))} />
                      </div>
                      <div>
                        <label className={labelClass}>Number of sample collectors</label>
                        <input className={inputClass} type="number" value={labData.num_collectors}
                          onChange={e => setLabData(d => ({ ...d, num_collectors: e.target.value }))} />
                      </div>
                    </div>
                  )}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className={labelClass}>Accreditation body</label>
                      <input className={inputClass} placeholder="e.g. MLSCN" value={labData.accreditation_body}
                        onChange={e => setLabData(d => ({ ...d, accreditation_body: e.target.value }))} />
                    </div>
                    <div>
                      <label className={labelClass}>Accreditation number</label>
                      <input className={inputClass} value={labData.accreditation_number}
                        onChange={e => setLabData(d => ({ ...d, accreditation_number: e.target.value }))} />
                    </div>
                    <div>
                      <label className={labelClass}>Standard turnaround (hours)</label>
                      <input className={inputClass} type="number" value={labData.standard_turnaround_hours}
                        onChange={e => setLabData(d => ({ ...d, standard_turnaround_hours: e.target.value }))} />
                    </div>
                    <div>
                      <label className={labelClass}>Urgent turnaround (hours)</label>
                      <input className={inputClass} type="number" value={labData.urgent_turnaround_hours}
                        onChange={e => setLabData(d => ({ ...d, urgent_turnaround_hours: e.target.value }))} />
                    </div>
                  </div>
                </>
              )}

              {facilityType === "pharmacy" && (
                <>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input type="checkbox" className="w-4 h-4 accent-teal-600" checked={pharmData.delivery_available}
                      onChange={e => setPharmData(d => ({ ...d, delivery_available: e.target.checked }))} />
                    <span className="text-sm font-medium text-gray-700">Home delivery available</span>
                  </label>
                  {pharmData.delivery_available && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pl-7">
                      <div>
                        <label className={labelClass}>Delivery radius (km)</label>
                        <input className={inputClass} type="number" value={pharmData.delivery_radius_km}
                          onChange={e => setPharmData(d => ({ ...d, delivery_radius_km: e.target.value }))} />
                      </div>
                      <div>
                        <label className={labelClass}>Delivery fee ₦ (0 = free)</label>
                        <input className={inputClass} type="number" value={pharmData.delivery_fee}
                          onChange={e => setPharmData(d => ({ ...d, delivery_fee: e.target.value }))} />
                      </div>
                    </div>
                  )}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className={labelClass}>PCN registration number</label>
                      <input className={inputClass} value={pharmData.pcn_registration}
                        onChange={e => setPharmData(d => ({ ...d, pcn_registration: e.target.value }))} />
                    </div>
                    <div>
                      <label className={labelClass}>Dispensing hours</label>
                      <input className={inputClass} placeholder="e.g. Mon–Sat 8am–9pm" value={pharmData.dispensing_hours}
                        onChange={e => setPharmData(d => ({ ...d, dispensing_hours: e.target.value }))} />
                    </div>
                  </div>
                </>
              )}

              {facilityType === "hospital" && (
                <>
                  <div>
                    <label className={labelClass}>Hospital level *</label>
                    <select className={inputClass} value={hospData.hospital_level}
                      onChange={e => setHospData(d => ({ ...d, hospital_level: e.target.value as any }))}>
                      <option value="primary">Primary Health Centre</option>
                      <option value="secondary">Secondary Hospital</option>
                      <option value="tertiary">Tertiary / Teaching Hospital</option>
                    </select>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <label className="flex items-center gap-3 cursor-pointer col-span-2 md:col-span-1">
                      <input type="checkbox" className="w-4 h-4 accent-teal-600" checked={hospData.emergency_available}
                        onChange={e => setHospData(d => ({ ...d, emergency_available: e.target.checked }))} />
                      <span className="text-sm font-medium text-gray-700">Emergency services available</span>
                    </label>
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input type="checkbox" className="w-4 h-4 accent-teal-600" checked={hospData.ambulance_available}
                        onChange={e => setHospData(d => ({ ...d, ambulance_available: e.target.checked }))} />
                      <span className="text-sm font-medium text-gray-700">Ambulance available</span>
                    </label>
                    <div>
                      <label className={labelClass}>Approximate bed count</label>
                      <input className={inputClass} type="number" value={hospData.bed_count}
                        onChange={e => setHospData(d => ({ ...d, bed_count: e.target.value }))} />
                    </div>
                  </div>
                  <div>
                    <label className={`${labelClass} mb-2`}>Specialties</label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {HOSPITAL_SPECIALTIES.map(s => (
                        <label key={s} className="flex items-center gap-2 text-sm cursor-pointer">
                          <input type="checkbox" className="w-4 h-4 accent-teal-600"
                            checked={hospData.specialties.includes(s)}
                            onChange={() => toggleSpecialty(s)} />
                          {s}
                        </label>
                      ))}
                    </div>
                    <div className="mt-3">
                      <label className={labelClass}>Other specialty</label>
                      <input className={inputClass} placeholder="Any other specialty not listed above"
                        value={hospData.other_specialty}
                        onChange={e => setHospData(d => ({ ...d, other_specialty: e.target.value }))} />
                    </div>
                  </div>
                </>
              )}
            </div>
            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
              <button onClick={() => setFormStep(1)} className="w-full sm:w-auto px-6 py-3 border border-gray-200 text-gray-600 rounded-xl font-semibold hover:bg-gray-50">← Back</button>
              <button onClick={() => setFormStep(3)} className="w-full sm:w-auto px-6 py-3 bg-teal-600 text-white rounded-xl font-semibold hover:bg-teal-700">Next →</button>
            </div>
          </div>
        )}

        {/* Step 3: Documents */}
        {formStep === 3 && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-gray-900">Documents</h2>
            <div className="card p-6 space-y-5">
              <div>
                <label className={labelClass}>Professional licence / accreditation certificate</label>
                <div className="mt-1 flex items-center gap-3">
                  <button onClick={() => licenceRef.current?.click()}
                    disabled={uploading === "licence"}
                    className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50">
                    {uploading === "licence" ? "Uploading…" : docs.licence_url ? "✓ Uploaded — change" : "Choose file"}
                  </button>
                  {docs.licence_url && <a href={docs.licence_url} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 hover:underline">View</a>}
                </div>
                <input ref={licenceRef} type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden" onChange={handleLicenceUpload} />
              </div>

              <div>
                <label className={labelClass}>CAC certificate</label>
                <div className="mt-1 flex items-center gap-3">
                  <button onClick={() => cacRef.current?.click()}
                    disabled={uploading === "cac"}
                    className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50">
                    {uploading === "cac" ? "Uploading…" : docs.cac_url ? "✓ Uploaded — change" : "Choose file"}
                  </button>
                  {docs.cac_url && <a href={docs.cac_url} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 hover:underline">View</a>}
                </div>
                <input ref={cacRef} type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden" onChange={handleCacUpload} />
              </div>

              <div>
                <label className={labelClass}>Facility photos (up to 3)</label>
                <div className="mt-1 flex items-center gap-3 flex-wrap">
                  <button onClick={() => photoRef.current?.click()}
                    disabled={uploading === "photos" || docs.photo_urls.length >= 3}
                    className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50">
                    {uploading === "photos" ? "Uploading…" : `Add photos (${docs.photo_urls.length}/3)`}
                  </button>
                  {docs.photo_urls.map((url, i) => (
                    <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 hover:underline">Photo {i+1}</a>
                  ))}
                </div>
                <input ref={photoRef} type="file" accept=".jpg,.jpeg,.png,.webp" multiple className="hidden" onChange={handlePhotosUpload} />
                <p className="text-xs text-gray-400 mt-1">JPG, PNG or WEBP. Exterior and interior shots welcome.</p>
              </div>

              {uploadError && (
                <p className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  {uploadError}
                </p>
              )}
            </div>
            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
              <button onClick={() => setFormStep(2)} className="w-full sm:w-auto px-6 py-3 border border-gray-200 text-gray-600 rounded-xl font-semibold hover:bg-gray-50">← Back</button>
              <button onClick={() => setFormStep(4)} className="w-full sm:w-auto px-6 py-3 bg-teal-600 text-white rounded-xl font-semibold hover:bg-teal-700">Review →</button>
            </div>
          </div>
        )}

        {/* Step 4: Review */}
        {formStep === 4 && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-gray-900">Review & Submit</h2>

            <div className="card p-5 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-gray-700">Basic Information</p>
                <button onClick={() => setFormStep(1)} className="text-xs text-blue-600 hover:underline">Edit</button>
              </div>
              <div className="text-sm text-gray-600 space-y-1">
                <p><span className="font-medium">Facility:</span> {basic.name}</p>
                <p><span className="font-medium">Email:</span> {basic.email}</p>
                <p><span className="font-medium">Phone:</span> {basic.phone}</p>
                <p><span className="font-medium">Address:</span> {basic.address}, {basic.city}, {basic.state}</p>
                {basic.contact_person_name && <p><span className="font-medium">Contact:</span> {basic.contact_person_name} ({basic.contact_person_role})</p>}
                {basic.operating_hours && <p><span className="font-medium">Hours:</span> {basic.operating_hours}</p>}
              </div>
            </div>

            <div className="card p-5 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-gray-700">{selectedFacility.title} Details</p>
                <button onClick={() => setFormStep(2)} className="text-xs text-blue-600 hover:underline">Edit</button>
              </div>
              {facilityType === "lab" && (
                <div className="text-sm text-gray-600 space-y-1">
                  <p>Home collection: {labData.home_collection ? `Yes (${labData.collection_radius_km}km radius)` : "No"}</p>
                  {labData.accreditation_body && <p>Accreditation: {labData.accreditation_body} {labData.accreditation_number}</p>}
                  <p>Turnaround: {labData.standard_turnaround_hours}h standard / {labData.urgent_turnaround_hours}h urgent</p>
                </div>
              )}
              {facilityType === "pharmacy" && (
                <div className="text-sm text-gray-600 space-y-1">
                  <p>Delivery: {pharmData.delivery_available ? `Yes (${pharmData.delivery_radius_km}km, ${pharmData.delivery_fee === "0" ? "free" : `₦${pharmData.delivery_fee}`})` : "No"}</p>
                  {pharmData.pcn_registration && <p>PCN: {pharmData.pcn_registration}</p>}
                  {pharmData.dispensing_hours && <p>Dispensing hours: {pharmData.dispensing_hours}</p>}
                </div>
              )}
              {facilityType === "hospital" && (
                <div className="text-sm text-gray-600 space-y-1">
                  <p>Level: {hospData.hospital_level}</p>
                  <p>Emergency: {hospData.emergency_available ? "Yes" : "No"} · Ambulance: {hospData.ambulance_available ? "Yes" : "No"}</p>
                  {hospData.bed_count && <p>Beds: {hospData.bed_count}</p>}
                  {hospData.specialties.length > 0 && <p>Specialties: {hospData.specialties.join(", ")}</p>}
                </div>
              )}
            </div>

            <div className="card p-5 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-gray-700">Documents</p>
                <button onClick={() => setFormStep(3)} className="text-xs text-blue-600 hover:underline">Edit</button>
              </div>
              <div className="text-sm text-gray-500 space-y-0.5">
                <p>{docs.licence_url ? "✓ Licence uploaded" : "○ No licence uploaded"}</p>
                <p>{docs.cac_url ? "✓ CAC certificate uploaded" : "○ No CAC certificate uploaded"}</p>
                <p>{docs.photo_urls.length > 0 ? `✓ ${docs.photo_urls.length} photo(s) uploaded` : "○ No photos uploaded"}</p>
              </div>
            </div>

            <div className="card p-6 space-y-2">
              <label className={labelClass}>Any questions or suggestions for us?</label>
              <textarea
                className={inputClass}
                rows={3}
                placeholder="Ask us anything, or share any suggestions you have"
                value={basic.questions}
                onChange={e => setB("questions", e.target.value)}
              />
            </div>

            {error && <p className="text-red-600 text-sm text-center">{error}</p>}

            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
              <button onClick={() => setFormStep(3)} className="w-full sm:w-auto px-6 py-3 border border-gray-200 text-gray-600 rounded-xl font-semibold hover:bg-gray-50">← Back</button>
              <button onClick={handleSubmit} disabled={submitting}
                className="w-full sm:w-auto px-8 py-3 bg-teal-600 text-white rounded-xl font-bold hover:bg-teal-700 disabled:opacity-50">
                {submitting ? "Submitting…" : "Submit Application"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
