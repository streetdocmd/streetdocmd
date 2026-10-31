"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { X } from "lucide-react";
import { Button, Chip, Toggle, cx, focusRing } from "@/components/ds";
import {
  FACILITY_TYPES, NO_FILTERS, PERSON_TYPES, filterFacilities, filterProviders,
  type Availability, type FacilityResult, type Filters, type ProviderResult, type Sort, type TimeOfDay,
} from "./filters";

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset className="border-b border-line py-4 last:border-b-0">
      <legend className="sr-only">{title}</legend>
      <p aria-hidden className="mb-2.5 text-ds-sm font-bold text-navy">{title}</p>
      {children}
    </fieldset>
  );
}

const Chips = ({ children }: { children: ReactNode }) => <div className="flex flex-wrap gap-2">{children}</div>;

function One<T extends string | number>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: readonly (readonly [T, string])[] }) {
  return <Chips>{options.map(([v, label]) => <Chip key={String(v)} selected={value === v} onClick={() => onChange(v)}>{label}</Chip>)}</Chips>;
}

function Many({ value, onChange, options }: { value: string[]; onChange: (v: string[]) => void; options: readonly (readonly [string, string])[] }) {
  return (
    <Chips>
      {options.map(([v, label]) => (
        <Chip key={v} multi selected={value.includes(v)} onClick={() => onChange(value.includes(v) ? value.filter(x => x !== v) : [...value, v])}>{label}</Chip>
      ))}
    </Chips>
  );
}

function Switch({ label, hint, checked, onChange }: { label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between gap-4 py-1.5">
      <span>
        <span className="block text-ds-sm font-semibold text-ink">{label}</span>
        {hint && <small className="block text-ds-xs text-muted">{hint}</small>}
      </span>
      <Toggle label={label} checked={checked} onChange={onChange} />
    </div>
  );
}

const RATINGS = [[0, "Any"], [3, "3+"], [4, "4+"], [4.5, "4.5+"]] as const;
const PRICES = [[0, "Any"], [10000, "Up to ₦10,000"], [20000, "Up to ₦20,000"], [50000, "Up to ₦50,000"]] as const;
const AVAILABILITY: readonly (readonly [Availability, string])[] = [["any", "Any time"], ["now", "Available now"], ["today", "Today"], ["tomorrow", "Tomorrow"], ["weekend", "This weekend"]];
const TIMES: readonly (readonly [TimeOfDay, string])[] = [["any", "Any time"], ["morning", "Morning"], ["afternoon", "Afternoon"], ["evening", "Evening"]];
const PROVIDERS = [
  ["doctor", "Doctors"], ["nurse", "Nurses"], ["physiotherapist", "Physiotherapists"],
  ["pharmacy", "Pharmacies"], ["lab", "Labs"], ["hospital", "Hospitals"],
] as const;

// A sheet on phones and a dialog on desktop. Choices stay in a draft, with a
// live result count, and only apply on "Show results"; closing discards them.
// Sections follow what's picked under Provider: nothing picked means the open tab.
export default function FilterSheet({ tab, providers, facilities, value, query, onApply, onClose }: {
  tab: "providers" | "facilities";
  providers: ProviderResult[];
  facilities: FacilityResult[];
  value: Filters;
  query: string;
  onApply: (f: Filters) => void;
  onClose: () => void;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const [f, setF] = useState<Filters>(value);
  const set = (patch: Partial<Filters>) => setF(x => ({ ...x, ...patch }));

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    const scroll = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = scroll;
      opener?.focus();
    };
  }, [onClose]);

  const people = f.types.length ? f.types.some(t => PERSON_TYPES.includes(t)) : tab === "providers";
  const places = f.types.length ? f.types.some(t => FACILITY_TYPES.includes(t)) : tab === "facilities";
  const count = (people ? filterProviders(providers, f, query).length : 0) + (places ? filterFacilities(facilities, f, query).length : 0);
  const languages = Array.from(new Set(providers.flatMap(x => x.languages))).sort();
  const dayChosen = ["today", "tomorrow", "weekend"].includes(f.availability);

  const sorts: [Sort, string][] = [
    ["recommended", "Recommended"], ["rating", "Highest rated"],
    ...(people ? [["visits", "Most visits"], ["price_low", "Price: low to high"], ["price_high", "Price: high to low"]] as [Sort, string][] : []),
    ["name", "A to Z"],
  ];

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-navy/50 md:items-center md:p-6" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="filter-title"
        onClick={e => e.stopPropagation()}
        className="flex max-h-[88dvh] w-full flex-col rounded-t-[24px] bg-surface shadow-ds md:max-w-lg md:rounded-[24px]"
      >
        <header className="flex items-center justify-between border-b border-line px-5 py-3.5">
          <h2 id="filter-title" className="text-ds-md font-bold text-navy">Filters</h2>
          <button ref={closeRef} type="button" onClick={onClose} aria-label="Close filters"
            className={cx("grid h-9 w-9 place-items-center rounded-full text-navy hover:bg-page", focusRing)}>
            <X size={20} aria-hidden />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-5">
          <Group title="Provider"><Many value={f.types} options={PROVIDERS} onChange={types => set({ types })} /></Group>
          {people && (
            <Group title="Availability">
              <One value={f.availability} options={AVAILABILITY}
                onChange={v => set({ availability: v, time: ["today", "tomorrow", "weekend"].includes(v) ? f.time : "any" })} />
              {dayChosen && (
                <div className="mt-3">
                  <p className="mb-2 text-ds-xs font-semibold text-muted">Time of day</p>
                  <One value={f.time} options={TIMES} onChange={time => set({ time })} />
                </div>
              )}
            </Group>
          )}
          <Group title="Sort by"><One value={f.sort} options={sorts} onChange={sort => set({ sort })} /></Group>
          <Group title="Rating"><One value={f.minRating} options={RATINGS} onChange={minRating => set({ minRating })} /></Group>
          {people && <Group title="Home visit price"><One value={f.maxPrice} options={PRICES} onChange={maxPrice => set({ maxPrice })} /></Group>}
          {people && languages.length > 1 && (
            <Group title="Speaks"><Many value={f.languages} options={languages.map(l => [l, l] as const)} onChange={v => set({ languages: v })} /></Group>
          )}
          {places && (
            <Group title="Services">
              <Switch label="Home sample collection" hint="Labs that come to you" checked={f.homeCollection} onChange={homeCollection => set({ homeCollection })} />
              <Switch label="Emergency care" hint="Hospitals with an emergency department" checked={f.emergency} onChange={emergency => set({ emergency })} />
              <Switch label="Ambulance" hint="Hospitals with an ambulance" checked={f.ambulance} onChange={ambulance => set({ ambulance })} />
            </Group>
          )}
        </div>

        <footer className="flex items-center gap-3 border-t border-line px-5 pb-[max(14px,env(safe-area-inset-bottom))] pt-3.5">
          <Button variant="ghost" className="flex-none whitespace-nowrap" onClick={() => setF(NO_FILTERS)}>Clear all</Button>
          <Button block onClick={() => { onApply(f); onClose(); }}>{count === 0 ? "No results" : `Show ${count} result${count === 1 ? "" : "s"}`}</Button>
        </footer>
      </div>
    </div>
  );
}
