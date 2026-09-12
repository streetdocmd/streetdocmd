"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase";
import PasswordInput from "@/components/PasswordInput";

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
    // Clicking the emailed reset link redirects here with a recovery code in
    // the URL; the browser client exchanges it for a session automatically
    // and fires PASSWORD_RECOVERY once that's done.
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
    <div className="min-h-screen bg-gradient-to-br from-navy-700 to-navy-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-3">
            <div className="w-10 h-10 bg-blue-brand rounded-xl flex items-center justify-center">
              <span className="text-white font-bold text-lg">S</span>
            </div>
            <span className="text-white font-bold text-xl">StreetdocMD</span>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-8 shadow-xl">
          {status === "checking" && (
            <p className="text-gray-500 text-sm text-center py-4">Verifying your reset link…</p>
          )}

          {status === "expired" && (
            <>
              <h1 className="text-2xl font-bold text-gray-900 mb-1">Link expired</h1>
              <p className="text-gray-500 text-sm mb-6">
                This password reset link is invalid or has expired. Please request a new one.
              </p>
              <Link href="/forgot-password" className="block w-full text-center btn-primary">
                Request a new link
              </Link>
            </>
          )}

          {status === "ready" && !done && (
            <>
              <h1 className="text-2xl font-bold text-gray-900 mb-1">Set a new password</h1>
              <p className="text-gray-500 text-sm mb-6">Choose a new password for your account</p>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="label">New password</label>
                  <PasswordInput
                    placeholder="At least 8 characters"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="label">Confirm new password</label>
                  <PasswordInput
                    placeholder="••••••••"
                    value={confirm}
                    onChange={e => setConfirm(e.target.value)}
                    required
                  />
                </div>

                {error && (
                  <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
                    {error}
                  </div>
                )}

                <button type="submit" disabled={loading} className="btn-primary w-full justify-center flex">
                  {loading ? "Saving…" : "Reset password"}
                </button>
              </form>
            </>
          )}

          {done && (
            <>
              <h1 className="text-2xl font-bold text-gray-900 mb-1">Password updated</h1>
              <p className="text-gray-500 text-sm">Redirecting you to sign in…</p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
