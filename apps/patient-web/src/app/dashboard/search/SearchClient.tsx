"use client";
import { useState } from "react";
import Link from "next/link";
import { Building2, Clock, FlaskConical, Search, Star, Truck } from "lucide-react";
import { formatNaira } from "@/lib/shared";
import { Avatar, Chip, Pill, SegmentedControl, VerifiedBadge, cx, focusRing } from "@/components/ds";

export interface ProviderResult {
  id: string;
  name: string;
  photo_url: string | null;
  role: string;
  profession: string;
  rating: number;
  visits: number;
  available: boolean;
  price: number;
  href: string;
}

export interface FacilityResult {
  id: string;
  type: "pharmacy" | "lab" | "hospital";
  name: string;
  area: string | null;
  note: string;
  href: string;
}

const PROVIDER_FILTERS = [["all", "All"], ["doctor", "Doctors"], ["nurse", "Nurses"], ["physiotherapist", "Physiotherapy"]] as const;
const FACILITY_FILTERS = [["all", "All"], ["pharmacy", "Pharmacies"], ["lab", "Labs"], ["hospital", "Hospitals"]] as const;
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
  const [filter, setFilter] = useState(initialFilter);
  const [query, setQuery] = useState(initialQuery);
  const q = query.trim().toLowerCase();
  const filters = seg === "providers" ? PROVIDER_FILTERS : FACILITY_FILTERS;

  const shownProviders = providers.filter(p =>
    (filter === "all" || p.profession === filter) && (!q || `${p.name} ${p.role} ${p.profession}`.toLowerCase().includes(q)));
  const shownFacilities = facilities.filter(f =>
    (filter === "all" || f.type === filter) && (!q || `${f.name} ${f.area ?? ""} ${f.type}`.toLowerCase().includes(q)));
  const empty = seg === "providers" ? shownProviders.length === 0 : shownFacilities.length === 0;

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="pb-3 text-center text-[17px] font-bold text-navy">Find care</h1>

      <label className="flex h-[54px] items-center gap-2.5 rounded-[18px] border-[1.5px] border-line bg-surface px-4 focus-within:border-accent focus-within:ring-4 focus-within:ring-accent-soft">
        <Search size={20} className="flex-none text-navy" aria-hidden />
        <input
          className="min-w-0 flex-1 bg-transparent text-ds-control text-ink outline-none placeholder:text-muted"
          placeholder="Name, specialty, pharmacy or lab"
          aria-label="Search"
          value={query}
          onChange={e => setQuery(e.target.value)}
        />
      </label>

      <SegmentedControl
        className="mt-3.5"
        label="What to search"
        value={seg}
        onChange={v => { setSeg(v); setFilter("all"); }}
        options={[{ value: "providers", label: "Individuals" }, { value: "facilities", label: "Facilities" }]}
      />

      <div className="mt-3.5 flex gap-2 overflow-x-auto pb-1" role="group" aria-label="Filter">
        {filters.map(([id, label]) => (
          <Chip key={id} selected={filter === id} onClick={() => setFilter(id)}>{label}</Chip>
        ))}
      </div>

      <p className="mb-3 mt-3 text-ds-xs text-muted">
        {seg === "providers"
          ? "Verified doctors, nurses and physiotherapists who visit you."
          : "Pharmacies, labs and hospitals. Each shows what it stocks or offers."}
      </p>

      {empty && <p className="py-[18px] text-center text-ds-sm text-muted">Nothing matches that yet. Try another name, or clear the filter.</p>}

      {seg === "providers"
        ? shownProviders.map(p => (
            <Link key={p.id} href={p.href} className={cardClass}>
              <Avatar name={p.name} src={p.photo_url} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-ds-control font-extrabold text-navy">{p.name}</span>
                {p.role && <span className="mt-0.5 block truncate text-[13px] text-muted">{p.role}</span>}
                <span className="mt-1 flex items-center gap-2.5">
                  {p.rating > 0
                    ? <span className="inline-flex items-center gap-1 text-[13px] font-extrabold text-ink"><Star size={14} className="fill-amber-500 text-amber-500" aria-hidden />{p.rating.toFixed(1)}</span>
                    : <span className="text-[13px] font-semibold text-muted">New provider</span>}
                  {p.visits > 0 && <span className="text-ds-sm text-muted">{p.visits} visits</span>}
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
              <Avatar name={f.name} tint={TINT[f.type]} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-ds-control font-extrabold text-navy">{f.name}</span>
                <span className="mt-0.5 block truncate text-[13px] text-muted">{[TYPE_LABEL[f.type], f.area].filter(Boolean).join(" · ")}</span>
                <VerifiedBadge className="mt-1">{REGULATOR[f.type]} verified</VerifiedBadge>
                <span className="mt-3 block"><Pill tone="teal" icon={NOTE_ICON[f.type]}>{f.note}</Pill></span>
              </span>
            </Link>
          ))}
    </div>
  );
}
