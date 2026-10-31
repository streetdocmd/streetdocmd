"use client";
import { useCallback, useState } from "react";
import Link from "next/link";
import { Building2, Clock, FlaskConical, Search, SlidersHorizontal, Star, Truck } from "lucide-react";
import { formatNaira } from "@/lib/shared";
import { Avatar, Button, Pill, SegmentedControl, VerifiedBadge, cx, focusRing } from "@/components/ds";
import FilterSheet from "./FilterSheet";
import {
  FACILITY_TYPES, NO_FILTERS, PERSON_TYPES, countFilters, filterFacilities, filterProviders,
  type FacilityResult, type Filters, type ProviderResult,
} from "./filters";

export type { FacilityResult, ProviderResult };

// Star average with the number of reviews behind it, so a 5.0 from one
// review isn't mistaken for a 4.8 from two hundred
function Rating({ value, count, empty }: { value: number; count: number; empty: string }) {
  if (!count || value <= 0) return <span className="text-[13px] font-semibold text-muted">{empty}</span>;
  return (
    <span className="inline-flex items-center gap-1 text-[13px] font-extrabold text-ink" aria-label={`Rated ${value.toFixed(1)} out of 5 from ${count} review${count === 1 ? "" : "s"}`}>
      <Star size={14} className="fill-amber-500 text-amber-500" aria-hidden />
      {value.toFixed(1)}
      <span className="font-semibold text-muted">({count})</span>
    </span>
  );
}

const REGULATOR: Record<string, string> = { doctor: "MDCN", nurse: "NMCN", physiotherapist: "MRTB", pharmacy: "PCN", lab: "MLSCN", hospital: "Ministry of Health" };
const TYPE_LABEL: Record<string, string> = { pharmacy: "Pharmacy", lab: "Diagnostic lab", hospital: "Hospital" };
const NOTE_ICON = { pharmacy: Truck, lab: FlaskConical, hospital: Building2 };
const TINT: Record<string, string> = { pharmacy: "var(--tint-yellow)", lab: "var(--tint-mint)", hospital: "var(--tint-rose)" };

const cardClass = cx(
  "mb-3 flex w-full gap-3.5 rounded-ds-lg border border-line bg-surface p-4 text-left shadow-ds-sm transition-[transform,border-color] hover:border-accent/40 active:scale-[0.99]",
  focusRing,
);

export default function SearchClient({ providers, facilities, initialSeg, initialFilter, initialQuery }: {
  providers: ProviderResult[];
  facilities: FacilityResult[];
  initialSeg: "providers" | "facilities";
  initialFilter: string;
  initialQuery: string;
}) {
  const [seg, setSeg] = useState<"providers" | "facilities">(initialSeg);
  const [filters, setFilters] = useState<Filters>({ ...NO_FILTERS, types: initialFilter !== "all" ? [initialFilter] : [] });
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [query, setQuery] = useState(initialQuery);
  const closeFilters = useCallback(() => setFiltersOpen(false), []);

  const shownProviders = filterProviders(providers, filters, query);
  const shownFacilities = filterFacilities(facilities, filters, query);
  const active = countFilters(filters);
  const results = seg === "providers" ? shownProviders.length : shownFacilities.length;
  const clear = () => setFilters(NO_FILTERS);

  // Picking only one kind under Provider opens its tab; picking both keeps this
  // one, and the tab labels show how many results wait on each side.
  function applyFilters(next: Filters) {
    setFilters(next);
    const people = next.types.some(t => PERSON_TYPES.includes(t));
    const places = next.types.some(t => FACILITY_TYPES.includes(t));
    if (people !== places) setSeg(people ? "providers" : "facilities");
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="pb-3 text-center text-[17px] font-bold text-navy">Find care</h1>

      <div className="flex gap-2.5">
        <label className="flex h-[54px] min-w-0 flex-1 items-center gap-2.5 rounded-[18px] border-[1.5px] border-line bg-surface px-4 focus-within:border-accent focus-within:ring-4 focus-within:ring-accent-soft">
          <Search size={20} className="flex-none text-navy" aria-hidden />
          <input
            className="min-w-0 flex-1 bg-transparent text-ds-control text-ink outline-none placeholder:text-muted"
            placeholder="Name, specialty or facility"
            aria-label="Search"
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
        </label>
        <button
          type="button"
          onClick={() => setFiltersOpen(true)}
          aria-haspopup="dialog"
          aria-label={active ? `Filters, ${active} on` : "Filters"}
          className={cx(
            "relative grid h-[54px] w-[54px] flex-none place-items-center rounded-[18px] border-[1.5px] transition-colors",
            active ? "border-accent bg-accent-soft text-accent" : "border-line bg-surface text-navy hover:border-accent",
            focusRing,
          )}
        >
          <SlidersHorizontal size={20} aria-hidden />
          {active > 0 && (
            <span className="absolute -right-1.5 -top-1.5 grid h-5 min-w-5 place-items-center rounded-pill bg-accent px-1 text-[11px] font-bold text-white">{active}</span>
          )}
        </button>
      </div>

      <SegmentedControl
        className="mt-3.5"
        label="What to search"
        value={seg}
        onChange={setSeg}
        options={[
          { value: "providers", label: active ? `Individuals · ${shownProviders.length}` : "Individuals" },
          { value: "facilities", label: active ? `Facilities · ${shownFacilities.length}` : "Facilities" },
        ]}
      />

      <div className="mb-3 mt-3 flex items-center justify-between gap-3 text-ds-xs text-muted">
        <span aria-live="polite">
          {results} {seg === "providers" ? (results === 1 ? "provider" : "providers") : (results === 1 ? "facility" : "facilities")}
        </span>
        {active > 0 && <button type="button" onClick={clear} className={cx("font-bold text-accent hover:underline rounded-sm", focusRing)}>Clear filters</button>}
      </div>

      {results === 0 && (
        <div className="py-[18px] text-center">
          <p className="text-ds-sm text-muted">{active ? "Nothing matches these filters." : "Nothing matches that yet. Try another name."}</p>
          {active > 0 && <Button variant="secondary" size="sm" className="mt-3" onClick={clear}>Clear filters</Button>}
        </div>
      )}

      {seg === "providers"
        ? shownProviders.map(p => (
            <Link key={p.id} href={p.href} className={cardClass}>
              <Avatar name={p.name} src={p.photo_url} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-ds-control font-extrabold text-navy">{p.name}</span>
                {p.role && <span className="mt-0.5 block truncate text-[13px] text-muted">{p.role}</span>}
                <span className="mt-1 flex items-center gap-2.5">
                  <Rating value={p.rating} count={p.reviews} empty="New provider" />
                  {p.visits > 0 && <span className="text-ds-sm text-muted">{p.visits} {p.visits === 1 ? "visit" : "visits"}</span>}
                </span>
                <VerifiedBadge className="mt-1">{REGULATOR[p.profession]} verified</VerifiedBadge>
                <span className="mt-3 flex items-center justify-between gap-2">
                  {p.available ? <Pill tone="ok" icon={Clock}>Available now</Pill> : <Pill tone="idle" icon={Clock}>Not online now</Pill>}
                  <span className="text-right text-ds-md font-extrabold text-navy tabular-nums">
                    {formatNaira(p.price)}
                    <small className="block text-ds-2xs font-semibold text-muted">Home visit</small>
                  </span>
                </span>
              </span>
            </Link>
          ))
        : shownFacilities.map(f => (
            <Link key={`${f.type}-${f.id}`} href={f.href} className={cardClass}>
              <Avatar name={f.name} src={f.logo_url} tint={TINT[f.type]} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-ds-control font-extrabold text-navy">{f.name}</span>
                <span className="mt-0.5 block truncate text-[13px] text-muted">{[TYPE_LABEL[f.type], f.area].filter(Boolean).join(" · ")}</span>
                <span className="mt-1 block"><Rating value={f.rating} count={f.reviews} empty="No ratings yet" /></span>
                <VerifiedBadge className="mt-1">{REGULATOR[f.type]} verified</VerifiedBadge>
                <span className="mt-3 block"><Pill tone="teal" icon={NOTE_ICON[f.type]}>{f.note}</Pill></span>
              </span>
            </Link>
          ))}

      {filtersOpen && (
        <FilterSheet tab={seg} providers={providers} facilities={facilities} value={filters} query={query} onApply={applyFilters} onClose={closeFilters} />
      )}
    </div>
  );
}
