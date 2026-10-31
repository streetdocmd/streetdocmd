// Search filters, kept apart from the screens so the pop-up can count results
// live with exactly the same rules the list uses.
import type { WeeklyHours } from "@/lib/working-hours";

export interface ProviderResult {
  id: string;
  name: string;
  photo_url: string | null;
  role: string;
  profession: string;
  rating: number;
  reviews: number;
  visits: number;
  available: boolean;
  price: number;
  href: string;
  languages: string[];
  hours: WeeklyHours | null;
  /** Days off (YYYY-MM-DD) */
  offDays: string[];
}

export interface FacilityResult {
  id: string;
  type: "pharmacy" | "lab" | "hospital";
  name: string;
  area: string | null;
  note: string;
  href: string;
  rating: number;
  reviews: number;
  logo_url: string | null;
  homeCollection: boolean;
  emergency: boolean;
  ambulance: boolean;
}

export type Availability = "any" | "now" | "today" | "tomorrow" | "weekend";
export type TimeOfDay = "any" | "morning" | "afternoon" | "evening";
export type Sort = "recommended" | "rating" | "visits" | "price_low" | "price_high" | "name";

// One set of filters across both tabs. Types mix individuals and facilities;
// each list only reads what applies to it.
export interface Filters {
  sort: Sort;
  types: string[];
  minRating: number;
  availability: Availability;
  time: TimeOfDay;
  maxPrice: number;
  languages: string[];
  homeCollection: boolean;
  emergency: boolean;
  ambulance: boolean;
}

export const NO_FILTERS: Filters = {
  sort: "recommended", types: [], minRating: 0, availability: "any", time: "any", maxPrice: 0, languages: [],
  homeCollection: false, emergency: false, ambulance: false,
};

export const PERSON_TYPES = ["doctor", "nurse", "physiotherapist"];
export const FACILITY_TYPES = ["pharmacy", "lab", "hospital"];

const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;
const WINDOWS: Record<Exclude<TimeOfDay, "any">, [string, string]> = {
  morning: ["00:00", "12:00"], afternoon: ["12:00", "17:00"], evening: ["17:00", "24:00"],
};

const isoDay = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

function daysFor(availability: Availability, now: Date): Date[] {
  const plus = (n: number) => new Date(now.getFullYear(), now.getMonth(), now.getDate() + n);
  if (availability === "today") return [plus(0)];
  if (availability === "tomorrow") return [plus(1)];
  if (availability === "weekend") {
    const toSat = (6 - now.getDay() + 7) % 7;
    return now.getDay() === 0 ? [plus(0)] : [plus(toSat), plus(toSat + 1)];
  }
  return [];
}

// Works that day, isn't on leave, and (if asked) has hours in that part of the day
function worksOn(p: ProviderResult, day: Date, time: TimeOfDay) {
  if (p.offDays.includes(isoDay(day))) return false;
  if (!p.hours) return true; // No hours set means any time, as in booking
  const span = p.hours[DAY_KEYS[day.getDay()]];
  if (!span) return false;
  if (time === "any") return true;
  const [from, to] = WINDOWS[time];
  return span[0] < to && span[1] > from;
}

export function filterProviders(list: ProviderResult[], f: Filters, query: string, now = new Date()) {
  const q = query.trim().toLowerCase();
  const days = daysFor(f.availability, now);
  const shown = list.filter(p =>
    (!q || `${p.name} ${p.role} ${p.profession} ${p.languages.join(" ")}`.toLowerCase().includes(q)) &&
    (!f.types.length || f.types.includes(p.profession)) &&
    (f.availability !== "now" || p.available) &&
    (!days.length || days.some(d => worksOn(p, d, f.time))) &&
    (!f.minRating || (p.reviews > 0 && p.rating >= f.minRating)) &&
    (!f.maxPrice || p.price <= f.maxPrice) &&
    (!f.languages.length || f.languages.some(l => p.languages.includes(l))));

  switch (f.sort) {
    case "rating": return [...shown].sort((a, b) => b.rating - a.rating || b.reviews - a.reviews);
    case "visits": return [...shown].sort((a, b) => b.visits - a.visits);
    case "price_low": return [...shown].sort((a, b) => a.price - b.price);
    case "price_high": return [...shown].sort((a, b) => b.price - a.price);
    case "name": return [...shown].sort((a, b) => a.name.localeCompare(b.name));
    default: return shown; // Online first, then rating: the order the server sends
  }
}

export function filterFacilities(list: FacilityResult[], f: Filters, query: string) {
  const q = query.trim().toLowerCase();
  const shown = list.filter(x =>
    (!q || `${x.name} ${x.area ?? ""} ${x.type}`.toLowerCase().includes(q)) &&
    (!f.types.length || f.types.includes(x.type)) &&
    (!f.minRating || (x.reviews > 0 && x.rating >= f.minRating)) &&
    (!f.homeCollection || x.homeCollection) &&
    (!f.emergency || x.emergency) &&
    (!f.ambulance || x.ambulance));

  switch (f.sort) {
    case "rating": return [...shown].sort((a, b) => b.rating - a.rating || b.reviews - a.reviews);
    case "name": return [...shown].sort((a, b) => a.name.localeCompare(b.name));
    default: return shown;
  }
}

/** How many choices are on (sort isn't a filter, but changing it counts as one choice) */
export function countFilters(f: Filters) {
  return Number(f.sort !== "recommended") + f.types.length + Number(f.minRating > 0) + Number(f.availability !== "any") + Number(f.time !== "any")
    + Number(f.maxPrice > 0) + f.languages.length + Number(f.homeCollection) + Number(f.emergency) + Number(f.ambulance);
}
