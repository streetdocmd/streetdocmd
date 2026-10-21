"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { createClient } from "@/lib/supabase";
import PasswordInput from "@/components/ui/PasswordInput";
import { PORTALS, type PortalType } from "../config";
import { Spinner, ui } from "../ui";

export default function ResetPasswordForm({ type }: { type: PortalType }) {
  const cfg = PORTALS[type];
  const router = useRouter();
  const [status, setStatus] = useState<"checking" | "ready" | "expired">("checking");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    // The browser client exchanges the code in the reset link for a session.
    const supabase = createClient();
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || (event === "SIGNED_IN" && session)) setStatus("ready");
    });
    supabase.auth.getSession().then(({ data }) => { if (data.session) setStatus("ready"); });
    const timeout = setTimeout(() => setStatus(s => (s === "checking" ? "expired" : s)), 5000);
    return () => { sub.subscription.unsubscribe(); clearTimeout(timeout); };
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (password.length < 8) { setError("Password must be at least 8 characters."); return; }
    if (password !== confirm) { setError("Passwords don't match."); return; }
    setLoading(true);
    const { error } = await createClient().auth.updateUser({ password, data: { password_changed: true } });
    setLoading(false);
    if (error) { setError(error.message); return; }
    setDone(true);
    setTimeout(() => { router.push(cfg.base); router.refresh(); }, 1500);
  }

  return (
    <div className={`${ui.card} p-6 sm:p-8`}>
      {status === "checking" && (
        <p className="text-sm text-gray-500 text-center py-6 flex items-center justify-center gap-2"><Spinner /> Verifying your reset link…</p>
      )}
      {status === "expired" && (
        <>
          <h2 className="text-xl font-bold text-gray-900">Link expired</h2>
          <p className="text-sm text-gray-500 mt-2 mb-6">
            This reset link is invalid or has expired. Links only work once, and on the device that requested them.
          </p>
          <Link href={`${cfg.base}/forgot-password`} className={`${ui.btnPrimary} w-full py-3`}>Request a new link</Link>
        </>
      )}
      {status === "ready" && !done && (
        <>
          <h2 className="text-xl font-bold text-gray-900 mb-6">Set a new password</h2>
          <form onSubmit={submit} className="space-y-4">
            <div>
              <label htmlFor="pw" className={ui.label}>New password</label>
              <PasswordInput id="pw" className={ui.input} autoComplete="new-password" placeholder="At least 8 characters"
                value={password} onChange={e => setPassword(e.target.value)} required />
            </div>
            <div>
              <label htmlFor="pw2" className={ui.label}>Confirm new password</label>
              <PasswordInput id="pw2" className={ui.input} autoComplete="new-password"
                value={confirm} onChange={e => setConfirm(e.target.value)} required />
            </div>
            {error && (
              <div role="alert" className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 text-sm px-3.5 py-2.5 rounded-lg">
                <AlertCircle size={16} className="mt-0.5 shrink-0" aria-hidden /> {error}
              </div>
            )}
            <button type="submit" disabled={loading} className={`${ui.btnPrimary} w-full py-3`}>
              {loading ? <><Spinner /> Saving…</> : "Save new password"}
            </button>
          </form>
        </>
      )}
      {done && (
        <div className="text-center py-4">
          <CheckCircle2 size={36} className="mx-auto text-green-600" aria-hidden />
          <h2 className="mt-3 text-xl font-bold text-gray-900">Password updated</h2>
          <p className="text-sm text-gray-500 mt-1">Taking you to your portal…</p>
        </div>
      )}
    </div>
  );
}
