"use client";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import PrivacyPolicyModal from "@/components/PrivacyPolicyModal";
import PasswordInput from "@/components/PasswordInput";
import AuthShell from "@/components/AuthShell";
import { normalizePhone, PHONE_ERROR } from "@/lib/phone";

type Field = "name" | "email" | "phone" | "password";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validate(form: Record<Field, string>): Partial<Record<Field, string>> {
  const errs: Partial<Record<Field, string>> = {};
  if (form.name.trim().length < 2) errs.name = "Please enter your full name";
  if (!EMAIL_RE.test(form.email.trim())) errs.email = "Please enter a valid email address";
  if (!normalizePhone(form.phone)) errs.phone = PHONE_ERROR;
  if (form.password.length < 8) errs.password = "Password must be at least 8 characters";
  return errs;
}

function RegisterForm() {
  const router = useRouter();
  const params = useSearchParams();
  const completing = params.get("complete") === "1";
  const [form, setForm] = useState<Record<Field, string>>({ name: "", email: "", phone: "", password: "" });
  const [touched, setTouched] = useState<Partial<Record<Field, boolean>>>({});
  const [submitted, setSubmitted] = useState(false);
  const [coreConsent, setCoreConsent] = useState(false);
  const [policyOpen, setPolicyOpen] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const errors = validate(form);
  const show = (k: Field) => (submitted || touched[k]) && errors[k];

  const set = (k: Field) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));
  const blur = (k: Field) => () => setTouched(t => ({ ...t, [k]: true }));

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    setSubmitted(true);
    if (Object.keys(errors).length > 0) return;
    if (!coreConsent) { setError("You must accept the data privacy consent to continue."); return; }
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, coreConsent }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error ?? "Registration failed. Please try again.");
        setLoading(false);
        return;
      }
      if (json.signedIn === false) {
        router.push("/login?registered=1");
        return;
      }
      router.push(json.existing ? "/dashboard" : "/onboarding/medical");
      router.refresh();
    } catch {
      setError("Couldn't reach StreetdocMD. Check your internet connection and try again.");
      setLoading(false);
    }
  }

  const fieldClass = (k: Field) => `input ${show(k) ? "border-red-300 focus:ring-red-400" : ""}`;

  return (
    <AuthShell subtitle="Step 1 of 2 · Create your account">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">
        {completing ? "Finish setting up" : "Create account"}
      </h1>
      <p className="text-gray-500 text-sm mb-6">
        {completing
          ? "Your account setup wasn't completed. Enter your details using the same email and password to finish."
          : "Get care delivered to your door"}
      </p>

      <form onSubmit={handleRegister} className="space-y-4" noValidate>
        <div>
          <label className="label" htmlFor="name">Full name</label>
          <input id="name" type="text" autoComplete="name" className={fieldClass("name")} placeholder="Chukwuemeka Obi"
            value={form.name} onChange={set("name")} onBlur={blur("name")} />
          {show("name") && <p className="mt-1 text-xs text-red-600">{errors.name}</p>}
        </div>
        <div>
          <label className="label" htmlFor="email">Email address</label>
          <input id="email" type="email" autoComplete="email" inputMode="email" className={fieldClass("email")}
            placeholder="you@example.com" value={form.email} onChange={set("email")} onBlur={blur("email")} />
          {show("email") && <p className="mt-1 text-xs text-red-600">{errors.email}</p>}
        </div>
        <div>
          <label className="label" htmlFor="phone">Phone number</label>
          <input id="phone" type="tel" autoComplete="tel" inputMode="tel" className={fieldClass("phone")}
            placeholder="08012345678" value={form.phone} onChange={set("phone")} onBlur={blur("phone")} />
          {show("phone")
            ? <p className="mt-1 text-xs text-red-600">{errors.phone}</p>
            : <p className="mt-1 text-xs text-gray-400">Your provider will use this number to reach you.</p>}
        </div>
        <div>
          <label className="label" htmlFor="password">Password</label>
          <PasswordInput id="password" autoComplete="new-password" className={fieldClass("password")}
            placeholder="At least 8 characters" value={form.password} onChange={set("password")} onBlur={blur("password")} />
          {show("password") && <p className="mt-1 text-xs text-red-600">{errors.password}</p>}
        </div>

        <div className="flex items-start gap-3 rounded-xl border border-blue-mid bg-blue-light p-4">
          <input
            type="checkbox"
            id="coreConsent"
            checked={coreConsent}
            onChange={e => { setCoreConsent(e.target.checked); if (e.target.checked) setError(""); }}
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
          <div role="alert" className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
            {error}
          </div>
        )}

        <button type="submit" disabled={loading || !coreConsent} className="btn-primary w-full flex justify-center">
          {loading ? "Creating account…" : completing ? "Finish setup" : "Create account"}
        </button>
      </form>

      <p className="text-center text-sm text-gray-500 mt-6">
        Already have an account?{" "}
        <Link href="/login" className="text-blue-brand font-medium hover:underline">Sign in</Link>
      </p>

      <PrivacyPolicyModal isOpen={policyOpen} onClose={() => setPolicyOpen(false)} />
    </AuthShell>
  );
}

export default function RegisterPage() {
  return (
    <Suspense>
      <RegisterForm />
    </Suspense>
  );
}
