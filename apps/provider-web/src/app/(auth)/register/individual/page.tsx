"use client";
import { legalUrl } from "@streetdocmd/shared";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, FileText, Loader2, Upload } from "lucide-react";
import {
  SPECIALTIES,
  getPractitionerType,
  PROVIDER_AGREEMENT_ACCEPTANCE_LABEL,
  PROVIDER_AGREEMENT_TITLE,
  PROVIDER_AGREEMENT_VERSION,
} from "@streetdocmd/shared";
import PasswordInput from "@/components/PasswordInput";
import AuthBrand from "@/components/AuthBrand";
import OnboardingSteps from "@/components/OnboardingSteps";
import ProviderAgreementModal from "@/components/ProviderAgreementModal";
import { DOC_ACCEPT, DOC_HINT, prepareDocument } from "@/lib/doc-files";

function Req() {
  return <span className="text-red-500 ml-0.5" aria-hidden>*</span>;
}

export default function RegisterIndividualPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
    specialty: "",
    specialist_field: "",
    credentials: "",
    license_number: "",
    years_experience: "",
    questions: "",
  });
  const [ndpr, setNdpr] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [stage, setStage] = useState("");
  // Credentials are part of the application: no account without them
  const [files, setFiles] = useState<Record<string, File | null>>({});
  const [fileErrors, setFileErrors] = useState<Record<string, string>>({});
  const [checking, setChecking] = useState<string | null>(null);
  const fileInputs = useRef<Record<string, HTMLInputElement | null>>({});
  const [agreed, setAgreed] = useState(false);
  const [showAgreement, setShowAgreement] = useState(false);

  // ?specialty= from the provider type chooser preselects the specialty
  useEffect(() => {
    const pre = new URLSearchParams(window.location.search).get("specialty");
    if (pre && (SPECIALTIES as readonly string[]).includes(pre)) setForm(f => ({ ...f, specialty: pre }));
  }, []);

  const practitionerType = getPractitionerType(form.specialty);
  const docSlots = form.specialty
    ? [
        { type: "certificate", label: "University / Degree Certificate", description: "Your medical or health sciences degree certificate" },
        ...(practitionerType
          ? [{ type: practitionerType.licenceDocType, label: practitionerType.licenceDocLabel, description: `Your current ${practitionerType.licenseBody} practising licence` }]
          : []),
      ]
    : [];

  async function pickFile(type: string, picked: File | null) {
    if (!picked) return;
    if (error) setError("");
    setChecking(type);
    const result = await prepareDocument(picked);
    setChecking(null);
    if ("error" in result) {
      setFiles(f => ({ ...f, [type]: null }));
      setFileErrors(e => ({ ...e, [type]: result.error }));
    } else {
      setFiles(f => ({ ...f, [type]: result.file }));
      setFileErrors(e => ({ ...e, [type]: "" }));
    }
  }

  function set(field: keyof typeof form, value: string) {
    setForm(f => ({ ...f, [field]: value }));
    if (error) setError("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    setError("");
    if (!form.specialty) { setError("Please select your specialty."); return; }
    if (practitionerType?.requiresSpecialistField && !form.specialist_field.trim()) {
      setError("Please enter your specialist field.");
      return;
    }
    if (practitionerType && !form.license_number.trim()) {
      setError(`Please enter your ${practitionerType.licenseLabel}.`);
      return;
    }
    if (form.phone.replace(/\D/g, "").length < 10) {
      setError("Please enter a valid phone number, e.g. 08012345678.");
      return;
    }
    const missingDoc = docSlots.find(s => !files[s.type]);
    if (missingDoc) {
      setError(`Please attach your ${missingDoc.label}. We can't create your account without it.`);
      return;
    }
    if (!agreed) {
      setError(`Please accept the ${PROVIDER_AGREEMENT_TITLE} to continue.`);
      return;
    }
    if (!ndpr) {
      setError("Please accept the data protection notice to continue.");
      return;
    }
    setLoading(true);
    setStage("Creating your account…");

    try {
      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, ndpr_consent: true, agreement_accepted: true, agreement_version: PROVIDER_AGREEMENT_VERSION }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error ?? "Registration failed. Please try again.");
        setLoading(false);
        return;
      }
      // Uploads need the session. If the automatic sign-in didn't stick, they
      // sign in and land on the documents step to finish.
      if (json.signedIn === false) {
        router.push("/login");
        return;
      }

      // The account exists now. If an upload fails, the documents step shows
      // what's still missing, keeping anything that did upload.
      for (const slot of docSlots) {
        setStage(`Uploading your ${slot.label}…`);
        const body = new FormData();
        body.append("file", files[slot.type] as File);
        body.append("doc_type", slot.type);
        const up = await fetch("/api/upload-document", { method: "POST", body }).catch(() => null);
        if (!up?.ok) {
          router.push("/onboarding/documents?upload=failed");
          router.refresh();
          return;
        }
      }

      setStage("Sending your application…");
      const submitted = await fetch("/api/onboarding/submit", { method: "POST" }).catch(() => null);
      router.push(submitted?.ok ? "/onboarding/pending" : "/onboarding/documents");
      router.refresh();
    } catch {
      setError("Network problem — please check your connection and try again.");
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-xl">
      <AuthBrand subtitle="Join StreetdocMD as a healthcare provider" />

      <div className="card p-6 sm:p-8">
        <Link href="/register" className="text-xs text-muted hover:text-muted inline-flex items-center gap-1 mb-5">
          <ArrowLeft size={13} /> Change registration type
        </Link>

        <div className="mb-6">
          <OnboardingSteps current={0} />
        </div>

        <h1 className="text-[24px] font-extrabold leading-tight tracking-[-0.02em] text-navy mb-1">Create your provider account</h1>
        <p className="text-sm text-muted mb-6">
          Takes about 5 minutes. Have your degree certificate and practising licence ready: you&apos;ll attach them here.
        </p>

        <form onSubmit={handleSubmit} className="space-y-6">
          <fieldset className="space-y-4">
            <legend className="text-xs font-semibold text-muted uppercase tracking-wide mb-3">Your details</legend>
            <div>
              <label className="label" htmlFor="name">Full name<Req /></label>
              <input id="name" autoComplete="name" className="input" placeholder="Dr. Amaka Obi" value={form.name} onChange={e => set("name", e.target.value)} required />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="label" htmlFor="email">Email<Req /></label>
                <input id="email" type="email" autoComplete="email" className="input" placeholder="you@example.com" value={form.email} onChange={e => set("email", e.target.value)} required />
              </div>
              <div>
                <label className="label" htmlFor="phone">Phone<Req /></label>
                <input id="phone" type="tel" autoComplete="tel" className="input" placeholder="08012345678" value={form.phone} onChange={e => set("phone", e.target.value)} required />
              </div>
            </div>
            <div>
              <label className="label" htmlFor="password">Password<Req /></label>
              <PasswordInput id="password" autoComplete="new-password" placeholder="At least 8 characters" value={form.password} onChange={e => set("password", e.target.value)} required minLength={8} />
            </div>
          </fieldset>

          <fieldset className="space-y-4">
            <legend className="text-xs font-semibold text-muted uppercase tracking-wide mb-3">Professional details</legend>
            <div>
              <label className="label" htmlFor="specialty">Specialty<Req /></label>
              <select id="specialty" className="input" value={form.specialty} onChange={e => set("specialty", e.target.value)} required>
                <option value="">Select your specialty</option>
                {SPECIALTIES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            {practitionerType?.requiresSpecialistField && (
              <div>
                <label className="label" htmlFor="specialist_field">Specialist field<Req /></label>
                <input
                  id="specialist_field"
                  className="input"
                  placeholder="e.g. Cardiology, Paediatrics, Orthopaedic Surgery"
                  value={form.specialist_field}
                  onChange={e => set("specialist_field", e.target.value)}
                  required
                />
              </div>
            )}
            <div>
              <label className="label" htmlFor="credentials">Qualifications<Req /></label>
              <input id="credentials" className="input" placeholder="e.g. MBBS (UniLag), 2019" value={form.credentials} onChange={e => set("credentials", e.target.value)} required />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-[1fr_10rem] gap-4">
              {practitionerType ? (
                <div>
                  <label className="label" htmlFor="license_number">{practitionerType.licenseLabel}<Req /></label>
                  <input
                    id="license_number"
                    className="input"
                    placeholder={`e.g. ${practitionerType.licenseBody}/12345`}
                    value={form.license_number}
                    onChange={e => set("license_number", e.target.value)}
                    required
                  />
                </div>
              ) : <div className="hidden sm:block" />}
              <div>
                <label className="label" htmlFor="years">Years of experience</label>
                <input id="years" type="number" inputMode="numeric" min="0" max="60" className="input" placeholder="0" value={form.years_experience} onChange={e => set("years_experience", e.target.value)} />
              </div>
            </div>
          </fieldset>

          <fieldset className="space-y-3">
            <legend className="text-xs font-semibold text-muted uppercase tracking-wide mb-3">Your documents</legend>
            {docSlots.length === 0 ? (
              <p className="rounded-xl border border-dashed border-line px-4 py-3 text-sm text-muted">
                Choose your specialty above to see which documents we need.
              </p>
            ) : (
              <>
                <p className="text-xs text-muted">
                  We check every licence with the issuing council before you can see patients. Your documents are stored privately.
                </p>
                {docSlots.map(slot => {
                  const file = files[slot.type];
                  const slotError = fileErrors[slot.type];
                  return (
                    <div key={slot.type} className={`rounded-xl border p-4 ${slotError ? "border-red-200" : "border-line"}`}>
                      <div className="flex items-start gap-3">
                        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${file ? "bg-green-50" : "bg-accent-soft"}`}>
                          {file ? <CheckCircle2 size={18} className="text-green-600" aria-hidden /> : <FileText size={18} className="text-accent" aria-hidden />}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-ink">{slot.label}<Req /></p>
                          <p className="text-xs text-muted">{slot.description} · {DOC_HINT}</p>
                          <input
                            ref={el => { fileInputs.current[slot.type] = el; }}
                            id={`doc-${slot.type}`}
                            type="file"
                            accept={DOC_ACCEPT}
                            className="sr-only"
                            aria-label={slot.label}
                            onChange={e => { pickFile(slot.type, e.target.files?.[0] ?? null); e.target.value = ""; }}
                          />
                          <div className="mt-2.5 flex flex-wrap items-center gap-3">
                            <button
                              type="button"
                              onClick={() => fileInputs.current[slot.type]?.click()}
                              className="btn-secondary inline-flex items-center gap-1.5 px-3 py-2 text-xs"
                              disabled={loading || checking === slot.type}
                            >
                              {checking === slot.type ? <Loader2 size={14} className="animate-spin" aria-hidden /> : <Upload size={14} aria-hidden />}
                              {file ? "Change file" : "Attach file"}
                            </button>
                            {file && <span className="max-w-[220px] truncate text-xs text-muted" title={file.name}>{file.name}</span>}
                          </div>
                          {slotError && <p className="mt-2 text-xs text-red-600">{slotError}</p>}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </>
            )}
          </fieldset>

          <div>
            <label className="label" htmlFor="questions">
              Any questions or suggestions for us? <span className="font-normal text-muted">(optional)</span>
            </label>
            <textarea
              id="questions"
              className="input resize-none"
              rows={3}
              maxLength={2000}
              placeholder="Ask us anything, or share any suggestions you have"
              value={form.questions}
              onChange={e => set("questions", e.target.value)}
            />
          </div>

          <div className="rounded-xl border border-accent/40 bg-accent-soft p-4">
            <label className="flex cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                checked={agreed}
                onChange={e => { setAgreed(e.target.checked); if (error) setError(""); }}
                className="mt-0.5 h-4 w-4 shrink-0 accent-accent"
              />
              <span className="text-sm leading-relaxed text-ink">{PROVIDER_AGREEMENT_ACCEPTANCE_LABEL}</span>
            </label>
            <button
              type="button"
              onClick={() => setShowAgreement(true)}
              className="mt-2 pl-7 text-sm font-semibold text-accent underline-offset-2 hover:underline"
            >
              Read the {PROVIDER_AGREEMENT_TITLE}
            </button>
          </div>

          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-line bg-page p-4">
            <input
              type="checkbox"
              checked={ndpr}
              onChange={e => { setNdpr(e.target.checked); if (error) setError(""); }}
              className="mt-0.5 h-4 w-4 shrink-0 accent-accent"
            />
            <span className="text-sm leading-relaxed text-muted">
              I consent to StreetdocMD processing my personal and professional data to verify my credentials and
              operate my provider account, in line with the Nigeria Data Protection Act.{" "}
              <a
                href={legalUrl("privacy-policy")}
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-accent underline-offset-2 hover:underline"
              >
                Read our Privacy Policy
              </a>
            </span>
          </label>

          {error && (
            <div role="alert" className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
              {error}
            </div>
          )}

          <button type="submit" className="btn-primary w-full inline-flex items-center justify-center gap-2" disabled={loading}>
            {loading && <Loader2 size={16} className="animate-spin" />}
            {loading ? stage || "Creating account…" : "Create account & apply"}
          </button>
        </form>
        <ProviderAgreementModal isOpen={showAgreement} onClose={() => setShowAgreement(false)} />

        <p className="text-center text-sm text-muted mt-6">
          Already registered?{" "}
          <Link href="/login" className="text-accent font-medium hover:underline">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
