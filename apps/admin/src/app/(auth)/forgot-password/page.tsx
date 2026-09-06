"use client";
import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase";

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
    if (error) { setError(error.message); return; }
    setSent(true);
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-8">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-3 mb-8 justify-center">
          <div className="w-10 h-10 bg-navy-700 rounded-xl flex items-center justify-center overflow-hidden">
            <span className="text-white font-bold text-lg">S</span>
          </div>
          <span className="text-xl font-bold text-navy-700">StreetdocMD</span>
        </div>

        <div className="bg-white rounded-2xl shadow-card-md p-8 border border-gray-100">
          {sent ? (
            <>
              <h2 className="text-xl font-bold text-gray-900 mb-2">Check your email</h2>
              <p className="text-gray-500 text-sm mb-6">
                If an account exists for <span className="font-medium">{email}</span>, we've sent a link to reset your password.
              </p>
              <Link
                href="/login"
                className="w-full bg-navy-700 hover:bg-navy-800 text-white py-3 rounded-xl font-semibold text-sm transition-colors block text-center"
              >
                Back to sign in
              </Link>
            </>
          ) : (
            <>
              <h2 className="text-xl font-bold text-gray-900 mb-1">Reset your password</h2>
              <p className="text-gray-500 text-sm mb-6">Enter your admin email to receive a reset link</p>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Email address</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-brand focus:border-transparent transition-shadow"
                    placeholder="admin@streetdocmd.com"
                  />
                </div>

                {error && (
                  <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-navy-700 hover:bg-navy-800 text-white py-3 rounded-xl font-semibold text-sm transition-colors disabled:opacity-50 mt-2"
                >
                  {loading ? "Sending…" : "Send reset link"}
                </button>
              </form>

              <p className="text-xs text-gray-400 text-center mt-6">
                <Link href="/login" className="text-blue-brand font-medium hover:underline">
                  Back to sign in
                </Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
