"use client";
import { useState } from "react";
import { useRecoveryLink, EXPIRED_MESSAGE } from "@/lib/recovery";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase";
import AuthShell from "@/components/AuthShell";
import PasswordInput from "@/components/PasswordInput";

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
    setTimeout(() => { router.push("/dashboard"); router.refresh(); }, 1500);
  }

  return (
    <AuthShell subtitle="">
          {status === "checking" && (
            <p className="text-muted text-sm text-center py-4">Verifying your reset link…</p>
          )}

          {(status === "confirm" || status === "verifying") && (
            <>
              <h2 className="text-xl font-bold text-ink mb-2">Reset your password</h2>
              <p className="text-muted text-sm mb-6">Tap continue to choose a new password for your account.</p>
              <button type="button" onClick={continueReset} disabled={status === "verifying"} className="btn-primary w-full text-base py-3">
                {status === "verifying" ? "Checking your link…" : "Continue"}
              </button>
            </>
          )}

          {status === "expired" && (
            <>
              <h1 className="text-[24px] font-extrabold leading-tight tracking-[-0.02em] text-navy mb-1">Link expired</h1>
              <p className="text-muted text-sm mb-6">
                {EXPIRED_MESSAGE}
              </p>
              <Link href="/forgot-password" className="block w-full text-center btn-primary">
                Request a new link
              </Link>
            </>
          )}

          {status === "ready" && !done && (
            <>
              <h1 className="text-[24px] font-extrabold leading-tight tracking-[-0.02em] text-navy mb-1">Set a new password</h1>
              <p className="text-muted text-sm mb-6">Choose a new password for your account</p>

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
                  <div className="rounded-ds-sm bg-danger-bg px-4 py-3 text-ds-sm text-ink">
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
              <h1 className="text-[24px] font-extrabold leading-tight tracking-[-0.02em] text-navy mb-1">Password updated</h1>
              <p className="text-muted text-sm">Taking you to your dashboard…</p>
            </>
          )}
    </AuthShell>
  );
}
