"use client";
import { useState } from "react";
import { useRecoveryLink, EXPIRED_MESSAGE } from "@/lib/recovery";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { createClient } from "@/lib/supabase";
import PasswordInput from "@/components/ui/PasswordInput";

export default function ResetPasswordPage() {
  const router = useRouter();
  const { status, continueReset } = useRecoveryLink();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);


  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (password.length < 8) { setError("Password must be at least 8 characters"); return; }
    if (password !== confirm) { setError("Passwords don't match"); return; }
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) { setError(error.message); return; }
    setDone(true);
    setTimeout(() => router.push("/login"), 2000);
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-8">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-3 mb-8 justify-center">
          <div className="w-10 h-10 bg-white rounded-xl border border-gray-100 shadow-card flex items-center justify-center overflow-hidden">
            <Image src="/mark.jpg" alt="" width={32} height={32} className="object-contain" />
          </div>
          <span className="text-xl font-bold text-navy-700">StreetdocMD</span>
        </div>

        <div className="bg-white rounded-2xl shadow-card-md p-8 border border-gray-100">
          {status === "checking" && (
            <p className="text-gray-500 text-sm text-center py-4">Verifying your reset link…</p>
          )}

          {(status === "confirm" || status === "verifying") && (
            <>
              <h2 className="text-xl font-bold text-gray-900 mb-2">Reset your password</h2>
              <p className="text-gray-500 text-sm mb-6">Tap continue to choose a new password for your account.</p>
              <button type="button" onClick={continueReset} disabled={status === "verifying"} className="w-full bg-navy-700 hover:bg-navy-800 text-white py-3 rounded-xl font-semibold text-sm transition-colors block text-center disabled:opacity-60">
                {status === "verifying" ? "Checking your link…" : "Continue"}
              </button>
            </>
          )}

          {status === "expired" && (
            <>
              <h2 className="text-xl font-bold text-gray-900 mb-2">Link expired</h2>
              <p className="text-gray-500 text-sm mb-6">
                {EXPIRED_MESSAGE}
              </p>
              <Link
                href="/forgot-password"
                className="w-full bg-navy-700 hover:bg-navy-800 text-white py-3 rounded-xl font-semibold text-sm transition-colors block text-center"
              >
                Request a new link
              </Link>
            </>
          )}

          {status === "ready" && !done && (
            <>
              <h2 className="text-xl font-bold text-gray-900 mb-6">Set a new password</h2>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">New password</label>
                  <PasswordInput
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-brand focus:border-transparent transition-shadow"
                    placeholder="At least 8 characters"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Confirm new password</label>
                  <PasswordInput
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    required
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-brand focus:border-transparent transition-shadow"
                    placeholder="••••••••"
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
                  {loading ? "Saving…" : "Reset password"}
                </button>
              </form>
            </>
          )}

          {done && (
            <>
              <h2 className="text-xl font-bold text-gray-900 mb-2">Password updated</h2>
              <p className="text-gray-500 text-sm">Redirecting you to sign in…</p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
