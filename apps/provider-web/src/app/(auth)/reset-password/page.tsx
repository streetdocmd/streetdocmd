"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase";

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
    <div className="w-full max-w-md">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-white">StreetdocMD</h1>
        <p className="text-navy-100 mt-1 text-sm">Provider Portal</p>
      </div>

      <div className="bg-white rounded-2xl shadow-xl p-8">
        {status === "checking" && (
          <p className="text-gray-500 text-sm text-center py-4">Verifying your reset link…</p>
        )}

        {status === "expired" && (
          <>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Link expired</h2>
            <p className="text-gray-500 text-sm mb-6">
              This password reset link is invalid or has expired. Please request a new one.
            </p>
            <Link href="/forgot-password" className="btn-primary w-full text-center block">
              Request a new link
            </Link>
          </>
        )}

        {status === "ready" && !done && (
          <>
            <h2 className="text-xl font-bold text-gray-900 mb-6">Set a new password</h2>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="label">New password</label>
                <input
                  type="password"
                  className="input"
                  placeholder="At least 8 characters"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="label">Confirm new password</label>
                <input
                  type="password"
                  className="input"
                  placeholder="••••••••"
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  required
                />
              </div>

              {error && <p className="text-red-600 text-sm">{error}</p>}

              <button type="submit" className="btn-primary w-full" disabled={loading}>
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
  );
}
