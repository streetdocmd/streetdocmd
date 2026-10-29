"use client";
import { useState } from "react";
import { Check, Copy, Share2 } from "lucide-react";
import { Button, useDialog } from "@/components/ds";

// Creates a 7 day link to send results to a doctor of the patient's choice,
// and lets them withdraw it.
export default function ShareResults({ orderId }: { orderId: string }) {
  const dialog = useDialog();
  const [link, setLink] = useState<{ url: string; token: string; expires: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");

  async function create() {
    if (!(await dialog.confirm({ title: "Share your results?", message: "Anyone you send the link to can see your results for 7 days, until you withdraw it.", confirmLabel: "Create link" }))) return;
    setBusy(true);
    setError("");
    const res = await fetch(`/api/investigations/${orderId}/share`, { method: "POST" });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) { setError(json.error ?? "Couldn't create the link."); return; }
    setLink({ url: json.url, token: json.url.split("/").pop(), expires: json.expires_at });
  }

  async function revoke() {
    if (!link) return;
    setBusy(true);
    await fetch(`/api/investigations/${orderId}/share?token=${encodeURIComponent(link.token)}`, { method: "DELETE" });
    setBusy(false);
    setLink(null);
  }

  async function copy() {
    if (!link) return;
    try {
      if (navigator.share) await navigator.share({ title: "My test results", url: link.url });
      else { await navigator.clipboard.writeText(link.url); setCopied(true); setTimeout(() => setCopied(false), 2000); }
    } catch { /* closed the share sheet */ }
  }

  if (!link) {
    return (
      <div>
        <Button variant="secondary" size="sm" onClick={create} disabled={busy}><Share2 size={16} aria-hidden /> Share with my doctor</Button>
        {error && <p role="alert" className="mt-1.5 text-ds-xs font-semibold text-danger">{error}</p>}
      </div>
    );
  }
  return (
    <div className="space-y-2 rounded-ds border border-line bg-page p-3">
      <p className="break-all text-ds-xs text-ink">{link.url}</p>
      <p className="text-ds-xs text-muted">Works until {new Date(link.expires).toLocaleDateString("en-NG", { day: "numeric", month: "long" })}.</p>
      <div className="flex gap-2">
        <Button size="sm" onClick={copy}>{copied ? <><Check size={15} aria-hidden /> Copied</> : <><Copy size={15} aria-hidden /> Copy or send</>}</Button>
        <Button size="sm" variant="ghost" onClick={revoke} disabled={busy}>Withdraw link</Button>
      </div>
    </div>
  );
}
