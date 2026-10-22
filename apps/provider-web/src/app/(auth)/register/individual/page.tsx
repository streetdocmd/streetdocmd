"use client";
import { legalUrl } from "@streetdocmd/shared";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Loader2 } from "lucide-react";
import { SPECIALTIES, getPractitionerType } from "@streetdocmd/shared";
import PasswordInput from "@/components/PasswordInput";
import AuthBrand from "@/components/AuthBrand";
import OnboardingSteps from "@/components/OnboardingSteps";

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
    expected_rate: "",
    questions: "",
  });
  const [ndpr, setNdpr] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const practitionerType = getPractitionerType(form.specialty);

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
    if (!ndpr) {
      setError("Please accept the data protection notice to continue.");
      return;
    }
    setLoading(true);

    try {
      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, ndpr_consent: true }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error ?? "Registration failed. Please try again.");
        setLoading(false);
        return;
      }
      // Account exists either way; if the automatic sign-in didn't stick,
      // send them to sign in rather than to a page that needs a session.
      router.push(json.signedIn === false ? "/login" : "/onboarding/documents");
      router.refresh();
    } catch {
      setError("Network problem — please check your connection and try again.");
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-xl">
      <AuthBrand subtitle="Join StreetdocMD as a healthcare provider" />

      <div className="bg-white rounded-2xl shadow-xl p-6 sm:p-8">
        <Link href="/register" className="text-xs text-gray-400 hover:text-gray-600 inline-flex items-center gap-1 mb-5">
          <ArrowLeft size={13} /> Change registration type
        </Link>

        <div className="mb-6">
          <OnboardingSteps current={0} />
        </div>

        <h1 className="text-2xl font-bold text-gray-900 mb-1">Create your provider account</h1>
        <p className="text-sm text-gray-500 mb-6">
          Takes about 3 minutes. You&apos;ll upload your certificate and licence in the next step.
        </p>

        <form onSubmit={handleSubmit} className="space-y-6">
          <fieldset className="space-y-4">
            <legend className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Your details</legend>
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
            <legend className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Professional details</legend>
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

          <fieldset className="space-y-4">
            <legend className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Help us get to know you</legend>
            <p className="text-xs text-gray-400 -mt-2">Optional — this doesn&apos;t affect your verification.</p>
            <div>
              <label className="label" htmlFor="expected_rate">What would you consider a reasonable amount per visit?</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm text-gray-400">₦</span>
                <input
                  id="expected_rate"
                  type="number"
                  inputMode="numeric"
                  min="0"
                  className="input pl-8"
                  placeholder="e.g. 15000"
                  value={form.expected_rate}
                  onChange={e => set("expected_rate", e.target.value)}
                />
              </div>
            </div>
            <div>
              <label className="label" htmlFor="questions">Any questions or suggestions for us?</label>
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
          </fieldset>

          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-gray-100 bg-gray-50 p-4">
            <input
              type="checkbox"
              checked={ndpr}
              onChange={e => { setNdpr(e.target.checked); if (error) setError(""); }}
              className="mt-0.5 h-4 w-4 shrink-0 accent-blue-brand"
            />
            <span className="text-sm leading-relaxed text-gray-600">
              I consent to StreetdocMD processing my personal and professional data to verify my credentials and
              operate my provider account, in line with the Nigeria Data Protection Act.{" "}
              <a
                href={legalUrl("privacy-policy")}
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-blue-brand underline-offset-2 hover:underline"
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
            {loading ? "Creating account…" : "Create account & continue"}
          </button>
        </form>

        <p className="text-center text-sm text-gray-500 mt-6">
          Already registered?{" "}
          <Link href="/login" className="text-blue-brand font-medium hover:underline">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
