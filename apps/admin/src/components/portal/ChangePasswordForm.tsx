"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { createClient } from "@/lib/supabase";
import PasswordInput from "@/components/ui/PasswordInput";
import { Spinner, ui } from "./ui";

export default function ChangePasswordForm({ email }: { email: string | null }) {
  const router = useRouter();
  const [current, setCurrent] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaved(false);
    if (password.length < 8) { setError("New password must be at least 8 characters."); return; }
    if (password !== confirm) { setError("New passwords don't match."); return; }
    if (password === current) { setError("Choose a password different from your current one."); return; }
    setLoading(true);
    const supabase = createClient();

    // Confirm it's really them before changing the password
    if (email) {
      const { error: verifyErr } = await supabase.auth.signInWithPassword({ email, password: current });
      if (verifyErr) {
        setLoading(false);
        setError("Your current password is incorrect.");
        return;
      }
    }

    const { error: updateErr } = await supabase.auth.updateUser({ password, data: { password_changed: true } });
    setLoading(false);
    if (updateErr) { setError(updateErr.message); return; }
    setCurrent(""); setPassword(""); setConfirm("");
    setSaved(true);
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="space-y-4 max-w-md">
      <div>
        <label htmlFor="current-pw" className={ui.label}>Current password</label>
        <PasswordInput id="current-pw" className={ui.input} autoComplete="current-password" required
          value={current} onChange={e => setCurrent(e.target.value)} />
        <p className={ui.hint}>If you were sent a temporary password by SMS, enter it here.</p>
      </div>
      <div>
        <label htmlFor="new-pw" className={ui.label}>New password</label>
        <PasswordInput id="new-pw" className={ui.input} autoComplete="new-password" placeholder="At least 8 characters" required
          value={password} onChange={e => setPassword(e.target.value)} />
      </div>
      <div>
        <label htmlFor="confirm-pw" className={ui.label}>Confirm new password</label>
        <PasswordInput id="confirm-pw" className={ui.input} autoComplete="new-password" required
          value={confirm} onChange={e => setConfirm(e.target.value)} />
      </div>
      {error && (
        <div role="alert" className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 text-sm px-3.5 py-2.5 rounded-lg">
          <AlertCircle size={16} className="mt-0.5 shrink-0" aria-hidden /> {error}
        </div>
      )}
      {saved && (
        <div role="status" className="flex items-center gap-2 bg-green-50 border border-green-200 text-green-800 text-sm px-3.5 py-2.5 rounded-lg">
          <CheckCircle2 size={16} aria-hidden /> Password updated.
        </div>
      )}
      <button type="submit" disabled={loading} className={ui.btnPrimary}>
        {loading ? <><Spinner /> Updating…</> : "Update password"}
      </button>
    </form>
  );
}
