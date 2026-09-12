"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase";
import PasswordInput from "@/components/ui/PasswordInput";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [status, setStatus] = useState<"checking" | "ready" | "expired">("checking");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setStatus("ready");
    });
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setStatus("ready");
    });
    const timeout = setTimeout(() => {
      setStatus(s => (s === "checking" ? "expired" : s));
    }, 4000);
    return () => { sub.subscription.unsubscribe(); clearTimeout(timeout); };
  }, []);

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
          <div className="w-10 h-10 bg-navy-700 rounded-xl flex items-center justify-center overflow-hidden">
            <span className="text-white font-bold text-lg">S</span>
          </div>
          <span className="text-xl font-bold text-navy-700">StreetdocMD</span>
        </div>

        <div className="bg-white rounded-2xl shadow-card-md p-8 border border-gray-100">
          {status === "checking" && (
            <p className="text-gray-500 text-sm text-center py-4">Verifying your reset link…</p>
          )}

          {status === "expired" && (
            <>
              <h2 className="text-xl font-bold text-gray-900 mb-2">Link expired</h2>
              <p className="text-gray-500 text-sm mb-6">
                This password reset link is invalid or has expired. Please request a new one.
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
