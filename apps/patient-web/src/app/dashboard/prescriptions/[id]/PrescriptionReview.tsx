"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { Button, Card, Notice, cx, focusRing, useDialog } from "@/components/ds";
import LocationPicker from "@/components/LocationPicker";

// The patient removes what they already have at home, then the rest goes to
// the nearest pharmacy to be priced. The doctor's prescription isn't changed.
export default function PrescriptionReview({ id, drugs, doctor, retry }: {
  id: string;
  drugs: { name: string; detail: string }[];
  doctor: string | null;
  /** A pharmacy couldn't supply this, so this is another try */
  retry: boolean;
}) {
  const dialog = useDialog();
  const router = useRouter();
  const [keep, setKeep] = useState<number[]>(() => drugs.map((_, i) => i));
  const [place, setPlace] = useState<{ lat: number; lng: number; address: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const toggle = (i: number) => setKeep(k => k.includes(i) ? k.filter(x => x !== i) : [...k, i]);

  async function post(body: object) {
    setSaving(true);
    setError("");
    const res = await fetch(`/api/prescriptions/${id}/order`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).catch(() => null);
    const json = await res?.json().catch(() => null);
    if (json?.order_id) { router.push(`/dashboard/medications/${json.order_id}`); router.refresh(); return; }
    if (res?.ok) { router.push("/dashboard"); router.refresh(); return; }
    setSaving(false);
    setError(json?.error ?? "Couldn't send your prescription. Check your connection and try again.");
  }

  async function haveAll() {
    if (!(await dialog.confirm({
      title: "You have everything at home?",
      message: "We won't send this prescription to a pharmacy. You can still order it later from your visit summary.",
      confirmLabel: "Yes, I have everything",
      cancelLabel: "Go back",
    }))) return;
    post({ haveAll: true });
  }

  return (
    <div className="space-y-5 pb-6">
      {retry && <Notice tone="warn">The last pharmacy couldn&apos;t supply this. We&apos;ll try another one.</Notice>}

      <p className="text-ds-sm text-muted">
        {doctor ? `${doctor} prescribed these for you.` : "Your doctor prescribed these for you."} Untick anything you already have at home. We&apos;ll send the rest to a pharmacy near you, and you&apos;ll pay once they&apos;ve priced it.
      </p>

      <Card padded={false} className="px-4 py-1">
        <ul>
          {drugs.map((d, i) => {
            const on = keep.includes(i);
            return (
              <li key={i} className="border-b border-line last:border-b-0">
                <button type="button" role="checkbox" aria-checked={on} onClick={() => toggle(i)}
                  className={cx("flex w-full items-center gap-3 py-3 text-left", focusRing)}>
                  <span className={cx("grid h-6 w-6 flex-none place-items-center rounded-md border-2", on ? "border-accent bg-accent text-white" : "border-line")}>
                    {on && <Check size={15} strokeWidth={3} aria-hidden />}
                  </span>
                  <span className="min-w-0">
                    <b className={cx("block text-ds-sm", on ? "text-ink" : "text-muted line-through")}>{d.name}</b>
                    {d.detail && <small className="block text-ds-xs text-muted">{d.detail}</small>}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </Card>

      {keep.length > 0 && (
        <LocationPicker
          onReady={(c, address) => setPlace({ ...c, address })}
          onReset={() => setPlace(null)}
        />
      )}

      {error && <p role="alert" className="text-ds-sm font-semibold text-danger">{error}</p>}

      <div className="space-y-2">
        {keep.length > 0 && (
          <Button block disabled={saving || !place} onClick={() => post({ keep, ...place })}>
            {saving ? "Sending…" : `Send ${keep.length} to a pharmacy`}
          </Button>
        )}
        <Button block variant={keep.length > 0 ? "ghost" : "primary"} disabled={saving} onClick={haveAll}>
          I have everything at home
        </Button>
      </div>
    </div>
  );
}
