// Refill tracking from prescriptions. Providers record the frequency (a fixed list),
// the duration ("5 days") and, since the refill feature, the quantity dispensed.
// Supply = quantity / doses per day when both are known, otherwise the duration.

const DOSES_PER_DAY: Record<string, number> = {
  "once daily": 1,
  "twice daily": 2,
  "three times daily": 3,
  "four times daily": 4,
  "every 12 hours": 2,
  "every 8 hours": 3,
  "every 6 hours": 4,
  "at night": 1,
  "in the morning": 1,
};

export function dosesPerDay(frequency?: string | null): number | null {
  if (!frequency) return null;
  const f = frequency.trim().toLowerCase();
  if (DOSES_PER_DAY[f]) return DOSES_PER_DAY[f];
  const times = f.match(/(\d+)\s*(?:times|x)\s*(?:a|per)?\s*day|(\d+)\s*times daily/);
  if (times) return Number(times[1] ?? times[2]) || null;
  const every = f.match(/every\s*(\d+)\s*hours?/);
  if (every) return Math.max(1, Math.round(24 / Number(every[1])));
  return null; // "as needed", "stat": no regular supply to track
}

export function durationDays(duration?: string | null): number | null {
  if (!duration) return null;
  const m = duration.toLowerCase().match(/(\d+)\s*(day|week|month)/);
  if (!m) return null;
  const n = Number(m[1]);
  return m[2] === "week" ? n * 7 : m[2] === "month" ? n * 30 : n;
}

export interface Drug {
  name?: string;
  drug_name?: string;
  dosage?: string;
  strength?: string;
  frequency?: string;
  duration?: string;
  quantity?: string | number;
}

export function supplyDays(drug: Drug): number | null {
  // As needed and one off doses have no regular supply to run out of
  if (/as needed|prn|stat|one.?time/i.test(drug.frequency ?? "")) return null;
  const qty = Number(drug.quantity);
  const perDay = dosesPerDay(drug.frequency);
  if (qty > 0 && perDay) return Math.floor(qty / perDay);
  return durationDays(drug.duration);
}

export interface RefillItem {
  name: string;
  detail: string;
  daysLeft: number;
}

/** Medicines with a known supply, ending soonest first. Ones that ran out over two weeks ago are dropped. */
export function refillItems(prescriptions: { created_at: string; drugs: Drug[] | null }[], now = new Date()): RefillItem[] {
  const items: RefillItem[] = [];
  for (const rx of prescriptions) {
    for (const d of rx.drugs ?? []) {
      const name = (d.name || d.drug_name || "").trim();
      const days = supplyDays(d);
      if (!name || days === null) continue;
      const end = new Date(rx.created_at).getTime() + days * 86_400_000;
      const daysLeft = Math.ceil((end - now.getTime()) / 86_400_000);
      if (daysLeft < -14) continue;
      items.push({ name, detail: [d.dosage || d.strength, d.frequency].filter(Boolean).join(" · "), daysLeft });
    }
  }
  return items.sort((a, b) => a.daysLeft - b.daysLeft);
}

/** Refill soon: 5 days or fewer left (and not long finished). */
export const REFILL_SOON_DAYS = 5;
