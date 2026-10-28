"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertCircle } from "lucide-react";
import { createClient } from "@/lib/supabase";
import PasswordInput from "@/components/ui/PasswordInput";
import { PORTALS, type PortalType } from "../config";
import { Spinner, ui } from "../ui";

function friendlyAuthError(message: string) {
  if (/invalid login credentials/i.test(message)) return "That email and password don't match. Check them and try again, or reset your password.";
  if (/email not confirmed/i.test(message)) return "This email hasn't been confirmed yet. Contact support and we'll sort it out.";
  return message;
}

export default function LoginForm({ type }: { type: PortalType }) {
  const cfg = PORTALS[type];
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function login(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    setError("");
    const { error } = await createClient().auth.signInWithPassword({ email: email.trim(), password });
    if (error) {
      setError(friendlyAuthError(error.message));
      setLoading(false);
      return;
    }
    // The portal itself decides what to show (dashboard, application status, …)
    router.push(cfg.base);
    router.refresh();
  }

  return (
    <div className={`${ui.card} p-6 sm:p-8`}>
      <h2 className="text-ds-xl font-bold text-navy">Sign in</h2>
      <p className="text-sm text-muted mt-1 mb-6">Use the email and password your {cfg.facilityNoun} registered with.</p>
      <form onSubmit={login} className="space-y-4">
        <div>
          <label htmlFor="email" className={ui.label}>Email address</label>
          <input id="email" className={ui.input} type="email" autoComplete="email" value={email}
            onChange={e => setEmail(e.target.value)} required />
        </div>
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label htmlFor="password" className="text-sm font-medium text-ink">Password</label>
            <Link href={`${cfg.base}/forgot-password`} className="text-xs font-medium text-accent hover:underline">Forgot password?</Link>
          </div>
          <PasswordInput id="password" className={ui.input} autoComplete="current-password" value={password}
            onChange={e => setPassword(e.target.value)} required />
        </div>
        {error && (
          <div role="alert" className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 text-sm px-3.5 py-2.5 rounded-lg">
            <AlertCircle size={16} className="mt-0.5 shrink-0" aria-hidden /> {error}
          </div>
        )}
        <button type="submit" disabled={loading} className={`${ui.btnPrimary} w-full py-3`}>
          {loading ? <><Spinner /> Signing in…</> : "Sign in"}
        </button>
      </form>
      <p className="mt-6 pt-5 border-t border-line text-sm text-muted text-center">
        New to StreetdocMD?{" "}
        <Link href={`/register/facility?type=${type}`} className="font-semibold text-accent hover:underline">Register your {cfg.facilityNoun}</Link>
      </p>
    </div>
  );
}
