"use client";
import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, MailCheck, AlertCircle } from "lucide-react";
import { createClient } from "@/lib/supabase";
import { PORTALS, type PortalType } from "../config";
import { Spinner, ui } from "../ui";

export default function ForgotPasswordForm({ type }: { type: PortalType }) {
  const cfg = PORTALS[type];
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    setError("");
    setLoading(true);
    const { error } = await createClient().auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}${cfg.base}/reset-password`,
    });
    setLoading(false);
    if (error) {
      setError(/rate limit/i.test(error.message)
        ? "Too many reset emails were requested. Please wait a few minutes and try again, or contact support."
        : !error.message?.trim() || error.message.trim() === "{}" || /sending|smtp|unexpected/i.test(error.message)
          ? "We couldn't send the reset email right now. Please try again in a few minutes, or contact contact@streetdocmd.com."
          : error.message);
      return;
    }
    setSent(true);
  }

  return (
    <div className={`${ui.card} p-6 sm:p-8`}>
      {sent ? (
        <>
          <span className="w-11 h-11 rounded-full bg-green-50 text-green-600 flex items-center justify-center mb-4">
            <MailCheck size={22} aria-hidden />
          </span>
          <h2 className="text-ds-xl font-bold text-navy">Check your email</h2>
          <p className="text-sm text-muted mt-2">
            If an account exists for <strong className="text-ink">{email.trim()}</strong>, we&apos;ve sent a link to reset your password.
            Open it on this device. It can take a few minutes, so check your spam folder too.
          </p>
        </>
      ) : (
        <>
          <h2 className="text-ds-xl font-bold text-navy">Reset your password</h2>
          <p className="text-sm text-muted mt-1 mb-6">Enter the email your {cfg.facilityNoun} signs in with and we&apos;ll email you a reset link.</p>
          <form onSubmit={submit} className="space-y-4">
            <div>
              <label htmlFor="email" className={ui.label}>Email address</label>
              <input id="email" type="email" autoComplete="email" required className={ui.input}
                value={email} onChange={e => setEmail(e.target.value)} />
            </div>
            {error && (
              <div role="alert" className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 text-sm px-3.5 py-2.5 rounded-lg">
                <AlertCircle size={16} className="mt-0.5 shrink-0" aria-hidden /> {error}
              </div>
            )}
            <button type="submit" disabled={loading} className={`${ui.btnPrimary} w-full py-3`}>
              {loading ? <><Spinner /> Sending…</> : "Send reset link"}
            </button>
          </form>
        </>
      )}
      <Link href={`${cfg.base}/login`} className="mt-6 inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:underline">
        <ArrowLeft size={15} aria-hidden /> Back to sign in
      </Link>
    </div>
  );
}
