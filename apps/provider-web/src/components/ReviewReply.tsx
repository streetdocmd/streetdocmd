"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, inputClass } from "@/components/ds";

// One public reply to a review. For transparency a reply can't be edited or
// removed once posted; only StreetdocMD admins can remove one.
// `endpoint` takes { reply } and returns { error } on failure.
export default function ReviewReply({ endpoint, initial, by = "you" }: { endpoint: string; initial: string | null; by?: string }) {
  const router = useRouter();
  const [writing, setWriting] = useState(false);
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function post() {
    setSaving(true);
    setError("");
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reply: text }),
    });
    setSaving(false);
    if (!res.ok) {
      setError((await res.json().catch(() => ({}))).error ?? "Couldn't post your reply. Please try again.");
      return;
    }
    setWriting(false);
    router.refresh();
  }

  if (initial) {
    return (
      <div className="mt-2.5 rounded-ds-sm bg-page px-3 py-2.5">
        <p className="text-ds-xs text-ink/85"><b className="text-navy">Reply from {by}:</b> {initial}</p>
      </div>
    );
  }

  if (!writing) {
    return <button type="button" onClick={() => setWriting(true)} className="mt-2 text-ds-sm font-bold text-accent hover:underline">Reply</button>;
  }

  return (
    <div className="mt-2.5 space-y-2">
      <textarea
        aria-label="Your reply"
        className={inputClass(false, "min-h-20 resize-none py-3 leading-normal")}
        maxLength={2000}
        value={text}
        onChange={e => setText(e.target.value)}
        placeholder="Thank the patient or respond to their feedback. Patients see your reply."
        autoFocus
      />
      <p className="text-ds-xs text-muted">Replies are public and can&apos;t be edited or removed once posted.</p>
      {error && <p role="alert" className="text-ds-xs font-semibold text-danger">{error}</p>}
      <div className="flex gap-2">
        <Button size="sm" disabled={saving || !text.trim()} onClick={post}>{saving ? "Posting…" : "Post reply"}</Button>
        <Button size="sm" variant="ghost" onClick={() => { setWriting(false); setText(""); setError(""); }}>Cancel</Button>
      </div>
    </div>
  );
}
