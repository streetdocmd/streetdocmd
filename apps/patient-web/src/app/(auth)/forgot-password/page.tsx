"use client";
import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase";
import AuthShell from "@/components/AuthShell";

// Supabase sometimes returns an error with an empty message ("{}"), e.g. when the email
// can't be sent. Never show that raw — explain what to do instead.
function resetErrorMessage(message: string | undefined): string {
  const m = (message ?? "").trim();
  if (/rate limit/i.test(m)) return "Too many reset emails were requested. Please wait a few minutes and try again.";
  if (!m || m === "{}" || /sending|smtp|unexpected/i.test(m)) {
    return "We couldn't send the reset email right now. Please try again in a few minutes, or contact contact@streetdocmd.com.";
  }
  return m;
}

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    // Always show the same success state, whether or not the email exists,
    // so this can't be used to enumerate registered accounts.
    if (error) { setError(resetErrorMessage(error.message)); return; }
    setSent(true);
  }

  return (
    <AuthShell>
          {sent ? (
            <>
              <h1 className="text-2xl font-bold text-gray-900 mb-1">Check your email</h1>
              <p className="text-gray-500 text-sm mb-6">
                If an account exists for <span className="font-medium">{email}</span>, we've sent a link to reset your password.
              </p>
              <Link href="/login" className="block w-full text-center btn-primary">
                Back to sign in
              </Link>
            </>
          ) : (
            <>
              <h1 className="text-2xl font-bold text-gray-900 mb-1">Forgot password?</h1>
              <p className="text-gray-500 text-sm mb-6">Enter your email and we'll send you a reset link</p>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="label">Email address</label>
                  <input
                    type="email"
                    className="input"
                    placeholder="you@example.com"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                  />
                </div>

                {error && (
                  <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
                    {error}
                  </div>
                )}

                <button type="submit" disabled={loading} className="btn-primary w-full justify-center flex">
                  {loading ? "Sending…" : "Send reset link"}
                </button>
              </form>

              <div className="mt-6 text-center">
                <Link href="/login" className="text-sm text-blue-brand font-medium hover:underline">
                  Back to sign in
                </Link>
              </div>
            </>
          )}
    </AuthShell>
  );
}
