"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import PrivacyPolicyModal from "@/components/PrivacyPolicyModal";

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({ name: "", email: "", phone: "", password: "" });
  const [coreConsent, setCoreConsent] = useState(false);
  const [policyOpen, setPolicyOpen] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    if (!coreConsent) { setError("You must accept the data privacy consent to continue."); return; }
    setError("");
    setLoading(true);

    const res = await fetch("/api/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, coreConsent }),
    });

    const json = await res.json();
    if (!res.ok) {
      setError(json.error ?? "Registration failed");
      setLoading(false);
      return;
    }

    router.push("/onboarding/medical");
    router.refresh();
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-navy-700 to-navy-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-3">
            <div className="w-10 h-10 bg-blue-brand rounded-xl flex items-center justify-center">
              <span className="text-white font-bold text-lg">S</span>
            </div>
            <span className="text-white font-bold text-xl">StreetdocMD</span>
          </div>
          <p className="text-blue-200 text-sm">Home healthcare, on demand</p>
        </div>

        <div className="bg-white rounded-2xl p-8 shadow-xl">
          <h1 className="text-2xl font-bold text-gray-900 mb-1">Create account</h1>
          <p className="text-gray-500 text-sm mb-6">Get care delivered to your door</p>

          <form onSubmit={handleRegister} className="space-y-4">
            <div>
              <label className="label">Full name</label>
              <input type="text" className="input" placeholder="Chukwuemeka Obi" value={form.name} onChange={set("name")} required />
            </div>
            <div>
              <label className="label">Email address</label>
              <input type="email" className="input" placeholder="you@example.com" value={form.email} onChange={set("email")} required />
            </div>
            <div>
              <label className="label">Phone number</label>
              <input type="tel" className="input" placeholder="08012345678" value={form.phone} onChange={set("phone")} required />
            </div>
            <div>
              <label className="label">Password</label>
              <input type="password" className="input" placeholder="At least 8 characters" value={form.password} onChange={set("password")} minLength={8} required />
            </div>

            <div className="flex items-start gap-3 rounded-xl border border-blue-mid bg-blue-light p-4">
              <input
                type="checkbox"
                id="coreConsent"
                checked={coreConsent}
                onChange={e => setCoreConsent(e.target.checked)}
                className="mt-0.5 h-[19px] w-[19px] shrink-0 cursor-pointer rounded border-gray-300 text-blue-brand"
              />
              <div>
                <label htmlFor="coreConsent" className="cursor-pointer text-sm leading-relaxed text-gray-900">
                  I understand and consent to StreetdocMD processing my health information to provide care, as described in the{" "}
                  <button
                    type="button"
                    onClick={e => { e.preventDefault(); setPolicyOpen(true); }}
                    className="font-semibold text-blue-brand underline decoration-transparent hover:decoration-blue-brand"
                  >
                    Privacy Policy
                  </button>
                  .
                </label>
                <p className="mt-1.5 text-[10.5px] font-semibold tracking-wide text-gray-400">REQUIRED TO CONTINUE</p>
              </div>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
                {error}
              </div>
            )}

            <button type="submit" disabled={loading || !coreConsent} className="btn-primary w-full flex justify-center">
              {loading ? "Creating account…" : "Create Account"}
            </button>
          </form>

          <p className="text-center text-sm text-gray-500 mt-6">
            Already have an account?{" "}
            <Link href="/login" className="text-blue-brand font-medium hover:underline">Sign in</Link>
          </p>
        </div>
      </div>

      <PrivacyPolicyModal isOpen={policyOpen} onClose={() => setPolicyOpen(false)} />
    </div>
  );
}