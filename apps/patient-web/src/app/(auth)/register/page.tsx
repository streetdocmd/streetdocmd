"use client";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { CircleAlert } from "lucide-react";
import LegalAcceptanceFields, { type LegalAcceptanceValue } from "@/components/LegalAcceptanceFields";
import PasswordInput from "@/components/PasswordInput";
import { Button, Input, Notice, TopBar, fieldLabelClass, inputClass } from "@/components/ds";
import { normalizePhone, PHONE_ERROR } from "@/lib/phone";
import { TERMS_VERSION, PRIVACY_VERSION } from "@/lib/legal-acceptance";

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
  // Both unchecked by default — the documents require an affirmative tick.
  const [legal, setLegal] = useState<LegalAcceptanceValue>({ terms: false, privacy: false });
  const legalOk = legal.terms && legal.privacy;
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
    if (!legalOk) {
      setError("Please agree to the Terms of Service and acknowledge the Privacy Policy to continue.");
      return;
    }
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          acceptTerms: legal.terms,
          acknowledgePrivacy: legal.privacy,
          termsVersion: TERMS_VERSION,
          privacyVersion: PRIVACY_VERSION,
        }),
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

  return (
    <main className="min-h-[100dvh] bg-page">
      <div className="mx-auto max-w-md pb-8">
        <TopBar title="Create account" className="pt-4" />

        <div className="px-5">
          <h1 className="text-[24px] font-extrabold leading-tight tracking-[-0.02em] text-navy">
            {completing ? "Finish setting up" : "Let’s get you set up"}
          </h1>
          <p className="mt-1.5 mb-5 text-ds-sm text-muted">
            {completing
              ? "Your account setup wasn't completed. Enter your details using the same email and password to finish."
              : "Takes less than a minute. Your phone number confirms every visit."}
          </p>

          <form onSubmit={handleRegister} noValidate>
            <div className="space-y-4">
              <Input id="name" label="Full name" type="text" autoComplete="name" placeholder="e.g. Ade Olatunji"
                value={form.name} onChange={set("name")} onBlur={blur("name")} error={show("name") || undefined} />
              <Input id="phone" label="Phone number" type="tel" autoComplete="tel" inputMode="tel" placeholder="+234 800 000 0000"
                value={form.phone} onChange={set("phone")} onBlur={blur("phone")} error={show("phone") || undefined} />
              <Input id="email" label="Email" type="email" autoComplete="email" inputMode="email" placeholder="you@example.com"
                value={form.email} onChange={set("email")} onBlur={blur("email")} error={show("email") || undefined} />
              <div>
                <label className={fieldLabelClass} htmlFor="password">Password</label>
                <PasswordInput id="password" autoComplete="new-password" className={inputClass(!!show("password"))}
                  placeholder="At least 8 characters" value={form.password} onChange={set("password")} onBlur={blur("password")}
                  aria-invalid={show("password") ? true : undefined} />
                {show("password") && (
                  <p className="mt-1.5 flex items-center gap-1.5 text-ds-xs font-semibold text-danger">
                    <CircleAlert size={14} aria-hidden /> {errors.password}
                  </p>
                )}
              </div>
            </div>

            <div className="mt-2.5">
              <LegalAcceptanceFields
                value={legal}
                onChange={next => { setLegal(next); if (next.terms && next.privacy) setError(""); }}
                showErrors={submitted}
                idPrefix="register"
              />
            </div>

            {error && <Notice tone="danger" className="mt-3">{error}</Notice>}

            <Button type="submit" block disabled={loading || !legalOk} aria-busy={loading} className="mt-[18px] min-h-[52px]">
              {loading ? "Creating account…" : completing ? "Finish setup" : "Create account"}
            </Button>
            {!legalOk && !loading && (
              <p className="mt-2 text-center text-ds-xs text-muted">Tick both boxes above to continue.</p>
            )}
          </form>

          <p className="mt-6 text-center text-ds-sm text-muted">
            Already have an account?{" "}
            <Link href="/login" className="font-bold text-accent hover:underline">Sign in</Link>
          </p>
        </div>
      </div>
    </main>
  );
}

export default function RegisterPage() {
  return (
    <Suspense>
      <RegisterForm />
    </Suspense>
  );
}
