"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

const SUGGESTIONS = [
  "Persistent fever and cough needing assessment",
  "Diabetic patient needing insulin management",
  "Post-surgery wound monitoring",
  "Elderly parent needing general health review",
  "IV drip / infusion at home",
  "Antenatal checkup at home",
];

export default function CustomRequestPage() {
  const router = useRouter();
  const [description, setDescription] = useState("");

  return (
    <div className="max-w-xl">
      <h1 className="text-[24px] font-extrabold leading-tight tracking-[-0.02em] text-navy mb-2">Custom Request</h1>
      <p className="text-muted text-sm mb-6">Describe your need so we can match you with the right provider.</p>

      <div className="card p-6 mb-4">
        <label className="label">What do you need?</label>
        <textarea
          className="input resize-none min-h-[120px]"
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder="e.g. I have a persistent fever and need a doctor to come assess me at home..."
          maxLength={500}
        />
        <p className="text-xs text-muted text-right mt-1">{description.length}/500</p>
      </div>

      <div className="card p-6 mb-6">
        <p className="text-xs font-semibold text-muted uppercase tracking-wide mb-3">Common requests</p>
        <div className="space-y-2">
          {SUGGESTIONS.map(s => (
            <button
              key={s}
              onClick={() => setDescription(s)}
              className="w-full text-left text-sm text-muted bg-page hover:bg-accent-soft hover:text-accent border border-line rounded-lg px-4 py-2.5 transition-colors"
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <button
        disabled={description.trim().length < 10}
        onClick={() => router.push(`/dashboard/book/custom_request?description=${encodeURIComponent(description.trim())}`)}
        className="btn-primary w-full"
      >
        Find a Provider →
      </button>
    </div>
  );
}