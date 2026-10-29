"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, inputClass } from "@/components/ds";

// Reply to one review, or edit or remove an existing reply.
// `endpoint` takes { reply } and returns { error } on failure.
export default function ReviewReply({ endpoint, initial, by = "you" }: { endpoint: string; initial: string | null; by?: string }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(initial ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function save(reply: string) {
    setSaving(true);
    setError("");
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reply }),
    });
    setSaving(false);
    if (!res.ok) {
      setError((await res.json().catch(() => ({}))).error ?? "Couldn't save your reply. Please try again.");
      return;
    }
    setEditing(false);
    router.refresh();
  }

  if (!editing) {
    return initial ? (
      <div className="mt-2.5 rounded-ds-sm bg-page px-3 py-2.5">
        <p className="text-ds-xs text-ink/85"><b className="text-navy">Reply from {by}:</b> {initial}</p>
        <div className="mt-1.5 flex gap-3">
          <button type="button" onClick={() => setEditing(true)} className="text-ds-xs font-bold text-accent hover:underline">Edit</button>
          <button type="button" disabled={saving} onClick={() => save("")} className="text-ds-xs font-bold text-muted hover:text-danger">Remove</button>
        </div>
      </div>
    ) : (
      <button type="button" onClick={() => setEditing(true)} className="mt-2 text-ds-sm font-bold text-accent hover:underline">Reply</button>
    );
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
      {error && <p role="alert" className="text-ds-xs font-semibold text-danger">{error}</p>}
      <div className="flex gap-2">
        <Button size="sm" disabled={saving || !text.trim()} onClick={() => save(text)}>{saving ? "Saving…" : "Post reply"}</Button>
        <Button size="sm" variant="ghost" onClick={() => { setEditing(false); setText(initial ?? ""); setError(""); }}>Cancel</Button>
      </div>
    </div>
  );
}
