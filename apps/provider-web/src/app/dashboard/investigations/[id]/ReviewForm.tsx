"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, cx, fieldLabelClass, inputClass } from "@/components/ds";
import { NEXT_STEP_LABEL } from "@/lib/investigation-status";

// The requesting doctor's interpretation and next step. The patient reads it.
export default function ReviewForm({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [interpretation, setInterpretation] = useState("");
  const [nextStep, setNextStep] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function save() {
    setSaving(true);
    setError("");
    const res = await fetch(`/api/investigations/${orderId}/review`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ interpretation, next_step: nextStep, notes }),
    }).catch(() => null);
    setSaving(false);
    if (!res?.ok) { setError((await res?.json().catch(() => ({})))?.error ?? "Couldn't save. Check your connection and try again."); return; }
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div>
        <label htmlFor="interp" className={fieldLabelClass}>What the results mean</label>
        <textarea id="interp" className={inputClass(false, "min-h-28 resize-y py-3 leading-normal")} maxLength={3000}
          placeholder="Written for the patient: what the results show and what they mean for them."
          value={interpretation} onChange={e => setInterpretation(e.target.value)} />
      </div>
      <fieldset>
        <legend className={fieldLabelClass}>Next step</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {Object.entries(NEXT_STEP_LABEL).map(([k, label]) => (
            <label key={k} className={cx("flex cursor-pointer items-center gap-2.5 rounded-ds border-[1.5px] px-3.5 py-3 text-ds-sm",
              nextStep === k ? "border-accent bg-accent-soft font-bold text-ink" : "border-line text-ink")}>
              <input type="radio" name="next" value={k} checked={nextStep === k} onChange={() => setNextStep(k)} className="accent-accent" />
              {label}
            </label>
          ))}
        </div>
      </fieldset>
      <div>
        <label htmlFor="rnotes" className={fieldLabelClass}>Details <span className="font-normal text-muted">(optional)</span></label>
        <textarea id="rnotes" className={inputClass(false, "min-h-20 resize-y py-3 leading-normal")} maxLength={2000}
          placeholder="Medicines, which test to repeat and when, where to be referred, or when to follow up."
          value={notes} onChange={e => setNotes(e.target.value)} />
      </div>
      {error && <p role="alert" className="text-ds-sm font-semibold text-danger">{error}</p>}
      <Button onClick={save} disabled={saving || !interpretation.trim() || !nextStep}>{saving ? "Saving…" : "Send to the patient"}</Button>
      <p className="text-ds-xs text-muted">For a prescription or a referral, use the visit notes as usual; the care journey stays open until follow up is done.</p>
    </div>
  );
}
