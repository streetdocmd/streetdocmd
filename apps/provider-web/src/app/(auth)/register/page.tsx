"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { SPECIALTIES, getPractitionerType } from "@streetdocmd/shared";

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
    specialty: "",
    credentials: "",
    license_number: "",
    years_experience: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const practitionerType = getPractitionerType(form.specialty);

  function set(field: string, value: string) {
    setForm(f => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!form.specialty) { setError("Please select your specialty."); return; }
    if (practitionerType && !form.license_number.trim()) {
      setError(`Please enter your ${practitionerType.licenseLabel}.`);
      return;
    }
    setLoading(true);

    const res = await fetch("/api/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

    const json = await res.json();
    if (!res.ok) {
      setError(json.error ?? "Registration failed");
      setLoading(false);
      return;
    }

    router.push("/onboarding/documents");
    router.refresh();
  }

  return (
    <div className="w-full max-w-lg">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-white">StreetdocMD</h1>
        <p className="text-navy-100 mt-1 text-sm">Provider Portal</p>
      </div>

      <div className="bg-white rounded-2xl shadow-xl p-8">
        <h2 className="text-xl font-bold text-gray-900 mb-1">Create provider account</h2>
        <p className="text-sm text-gray-500 mb-6">You'll upload your credentials in the next step.</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="label">Full name</label>
              <input className="input" placeholder="Dr. Amaka Obi" value={form.name} onChange={e => set("name", e.target.value)} required />
            </div>
            <div>
              <label className="label">Email</label>
              <input type="email" className="input" placeholder="you@example.com" value={form.email} onChange={e => set("email", e.target.value)} required />
            </div>
            <div>
              <label className="label">Phone</label>
              <input type="tel" className="input" placeholder="+2348012345678" value={form.phone} onChange={e => set("phone", e.target.value)} required />
            </div>
            <div className="col-span-2">
              <label className="label">Password</label>
              <input type="password" className="input" placeholder="Min. 8 characters" value={form.password} onChange={e => set("password", e.target.value)} required minLength={8} />
            </div>
            <div className="col-span-2">
              <label className="label">Specialty</label>
              <select className="input" value={form.specialty} onChange={e => set("specialty", e.target.value)} required>
                <option value="">Select your specialty</option>
                {SPECIALTIES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="col-span-2">
              <label className="label">Qualifications summary</label>
              <input className="input" placeholder="e.g. MBBS (UniLag), 2019" value={form.credentials} onChange={e => set("credentials", e.target.value)} required />
            </div>
            {practitionerType && (
              <div className="col-span-2">
                <label className="label">{practitionerType.licenseLabel}</label>
                <input
                  className="input"
                  placeholder={`e.g. ${practitionerType.licenseBody}/12345`}
                  value={form.license_number}
                  onChange={e => set("license_number", e.target.value)}
                  required
                />
              </div>
            )}
            <div>
              <label className="label">Years of experience</label>
              <input type="number" min="0" max="50" className="input" placeholder="0" value={form.years_experience} onChange={e => set("years_experience", e.target.value)} />
            </div>
          </div>

          {error && <p className="text-red-600 text-sm">{error}</p>}

          <button type="submit" className="btn-primary w-full" disabled={loading}>
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