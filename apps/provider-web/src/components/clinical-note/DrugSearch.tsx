"use client";
import { useMemo, useState } from "react";

export interface Medicine {
  name: string;
  generic_name: string | null;
  formulation: string | null;
  strength: string | null;
  /** Pharmacies near this visit with it in stock */
  pharmacies: number;
}

// How many typing slips apart two words are, so "amoxcilin" still finds Amoxicillin
function editDistance(a: string, b: string) {
  let row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const next = [i];
    for (let j = 1; j <= b.length; j++) {
      next[j] = Math.min(row[j] + 1, next[j - 1] + 1, row[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    row = next;
  }
  return row[b.length];
}

function matchScore(m: Medicine, q: string) {
  const words = `${m.name} ${m.generic_name ?? ""}`.toLowerCase().split(/[\s/,()-]+/).filter(Boolean);
  const hay = words.join(" ");
  if (m.name.toLowerCase().startsWith(q)) return 0;
  if (hay.includes(q)) return 1;
  // Typed so far may be shorter or longer than the word: try the start of it at nearby lengths
  const slips = q.length > 6 ? 2 : 1;
  if (q.length >= 4 && words.some(w => [0, 1, 2, 3].some(extra => editDistance(w.slice(0, q.length - 1 + extra), q) <= slips))) return 2;
  return null;
}

// The drug name box. It suggests medicines as the doctor types, but anything
// can be typed: a prescription may name a medicine no partner pharmacy lists.
export default function DrugSearch({ value, medicines, onChange, onPick }: {
  value: string;
  medicines: Medicine[];
  onChange: (name: string) => void;
  onPick: (m: Medicine) => void;
}) {
  const [open, setOpen] = useState(false);
  const q = value.trim().toLowerCase();

  const matches = useMemo(() => {
    if (q.length < 2) return [];
    return medicines
      .flatMap(m => { const score = matchScore(m, q); return score === null ? [] : [{ m, score }]; })
      .sort((a, b) => a.score - b.score || b.m.pharmacies - a.m.pharmacies || a.m.name.localeCompare(b.m.name))
      .slice(0, 8)
      .map(x => x.m);
  }, [medicines, q]);

  const exact = medicines.some(m => m.name.toLowerCase() === q);
  const showList = open && q.length >= 2;

  return (
    <div className="relative">
      <input
        value={value}
        role="combobox"
        aria-expanded={showList}
        aria-label="Drug name"
        autoComplete="off"
        placeholder="Search medicines, e.g. Amoxicillin"
        onChange={e => { onChange(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        className="w-full border border-line rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
      />
      {showList && (
        // onMouseDown keeps the input focused long enough for the tap to land
        <div role="listbox" onMouseDown={e => e.preventDefault()}
          className="absolute inset-x-0 top-full z-20 mt-1 max-h-64 overflow-y-auto rounded-lg border border-line bg-surface shadow-ds">
          {matches.map(m => (
            <button key={`${m.name}|${m.strength}|${m.formulation}`} type="button" role="option" aria-selected={false}
              onClick={() => { onPick(m); setOpen(false); }}
              className="block w-full border-b border-line px-3 py-2 text-left last:border-b-0 hover:bg-page">
              <span className="block text-sm font-medium text-ink">{m.name}{m.strength ? ` ${m.strength}` : ""}</span>
              <span className="block text-xs text-muted">{[m.formulation, m.generic_name !== m.name ? m.generic_name : null].filter(Boolean).join(" · ")}</span>
              <span className={`block text-xs ${m.pharmacies ? "text-teal-700" : "text-muted"}`}>
                {m.pharmacies ? `In stock at ${m.pharmacies} ${m.pharmacies === 1 ? "pharmacy" : "pharmacies"} near the patient` : "Not listed by a pharmacy nearby"}
              </span>
            </button>
          ))}
          {!exact && (
            <button type="button" onClick={() => setOpen(false)} className="block w-full px-3 py-2 text-left text-xs hover:bg-page">
              <span className="font-medium text-ink">Use &ldquo;{value.trim()}&rdquo; as typed</span>
              <span className="block text-muted">It may not be available from a partner pharmacy.</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
