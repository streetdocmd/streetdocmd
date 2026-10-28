"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Star, Search, ArrowLeft, Zap, Clock } from "lucide-react";
import { SERVICE_LABELS, SERVICE_PROFESSION, formatNaira } from "@/lib/shared";
import type { ServiceType } from "@/lib/shared";
import FamilyMemberPicker from "./FamilyMemberPicker";
import SchedulePicker from "./SchedulePicker";
import LocationPicker from "@/components/LocationPicker";
import { Avatar, Button, Card, Chip, Pill, TopBar, VerifiedBadge, cx, focusRing } from "@/components/ds";

export interface BookableProvider {
  id: string;
  name: string;
  photo_url: string | null;
  specialty: string;
  bio: string | null;
  rating: number;
  total_visits: number;
  years_experience: number;
  available: boolean;
  /** This provider's own price for the service (the booking API charges the same) */
  price: number;
}

// "nearest" = let dispatch send the nearest available provider (no provider chosen)
type Choice = BookableProvider | "nearest" | null;

export default function BookProviderClient({
  service,
  providers,
  description,
  careEpisodeId,
  followUpId,
  title,
  subtitle,
}: {
  /** Page heading, shown above the provider list only */
  title: string;
  subtitle: string;
  service: ServiceType;
  providers: BookableProvider[];
  description?: string;
  careEpisodeId?: string;
  followUpId?: string;
}) {
  const router = useRouter();
  // A follow-up goes to the continuing provider, so skip straight to the booking steps
  const [choice, setChoice] = useState<Choice>(followUpId ? "nearest" : null);
  // Provider whose profile is open (before choosing them)
  const [viewing, setViewing] = useState<BookableProvider | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "now">("all");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [address, setAddress] = useState("");
  const [booking, setBooking] = useState(false);
  const [error, setError] = useState("");
  const [familyMemberId, setFamilyMemberId] = useState<string | null>(null);
  const [scheduledAt, setScheduledAt] = useState<string | null>(null);
  const [scheduleReady, setScheduleReady] = useState(true);

  const chosen = choice && choice !== "nearest" ? choice : null;
  const serviceLabel = (SERVICE_LABELS as Record<string, string>)[service];

  async function book() {
    if (!coords || !scheduleReady) return;
    setBooking(true);
    setError("");

    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          service_type: service,
          targeted_provider_id: chosen?.id ?? null,
          patient_lat: coords.lat,
          patient_lng: coords.lng,
          patient_address: address,
          notes: description ?? null,
          care_episode_id: careEpisodeId ?? null,
          follow_up_id: followUpId ?? null,
          family_member_id: familyMemberId,
          scheduled_at: scheduledAt,
        }),
      });

      let json: any = null;
      try {
        json = await res.json();
      } catch {
        // Server returned a non-JSON body (e.g. a crash page) — fall through to the generic message below.
      }

      if (!res.ok) {
        setError(json?.error ?? `Could not create booking (${res.status}). Please try again.`);
        setBooking(false);
        return;
      }

      router.push(`/dashboard/book/payment/${json.booking_id}`);
    } catch {
      setError("Could not reach the server. Check your connection and try again.");
      setBooking(false);
    }
  }

  // ── Provider profile (between the list and the booking steps) ──
  if (!choice && viewing) {
    return (
      <ProviderProfile
        provider={viewing}
        regulator={REGULATOR[SERVICE_PROFESSION[service]]}
        onBack={() => setViewing(null)}
        onBook={() => setChoice(viewing)}
      />
    );
  }

  // ── Step 1: choose a provider ───────────────────────────────
  if (!choice) {
    const q = query.trim().toLowerCase();
    const shown = providers.filter(p =>
      (filter === "all" || p.available) && (!q || `${p.name} ${p.specialty}`.toLowerCase().includes(q)),
    );

    return (
      <div className="mx-auto max-w-2xl">
        <TopBar title={title} backHref="/dashboard" className="-mx-5 -mt-2 md:mx-0" />
        <p className="mb-3 text-ds-xs text-muted">{subtitle}</p>
        {description && <p className="mb-3 text-ds-sm italic text-muted">&ldquo;{description}&rdquo;</p>}

        {providers.length > 0 && (
          <>
            <label className="flex h-[54px] items-center gap-2.5 rounded-[18px] border-[1.5px] border-line bg-surface px-4 text-muted focus-within:border-accent focus-within:ring-4 focus-within:ring-accent-soft">
              <Search size={20} className="flex-none text-navy" aria-hidden />
              <input
                className="min-w-0 flex-1 bg-transparent text-ds-control text-ink outline-none placeholder:text-muted"
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Name or specialty"
                aria-label="Search providers"
              />
            </label>
            <div className="mt-3.5 flex gap-2 overflow-x-auto pb-1" role="group" aria-label="Filter providers">
              <Chip selected={filter === "all"} onClick={() => setFilter("all")}>All</Chip>
              <Chip selected={filter === "now"} onClick={() => setFilter("now")}>Available now</Chip>
            </div>
          </>
        )}

        <div className="mt-3">
          {providers.length === 0 ? (
            <Card className="text-center">
              <p className="font-bold text-navy">No providers are listed for {sentence(serviceLabel)} yet</p>
              <p className="mt-1 text-ds-sm text-muted">We can still send you the nearest available verified provider.</p>
            </Card>
          ) : shown.length === 0 ? (
            <p className="py-[18px] text-center text-ds-sm text-muted">
              Nothing matches that yet. Try another name, or clear the filter.
            </p>
          ) : (
            <ul>
              {shown.map(p => (
                <li key={p.id} className="mb-3">
                  <button
                    type="button"
                    onClick={() => setViewing(p)}
                    className={cx(
                      "flex w-full gap-3.5 rounded-ds-lg border border-line bg-surface p-4 text-left shadow-ds-sm transition-[transform,border-color] hover:border-accent/40 active:scale-[0.99]",
                      focusRing,
                    )}
                  >
                    <Avatar name={p.name} src={p.photo_url} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-ds-control font-extrabold text-navy">{p.name}</span>
                      {p.specialty && <span className="mt-0.5 block truncate text-[13px] text-muted">{p.specialty}</span>}
                      <span className="mt-1 flex items-center gap-2.5">
                        <Rating provider={p} />
                        {p.total_visits > 0 && <span className="text-ds-sm text-muted">{p.total_visits} visits</span>}
                      </span>
                      <VerifiedBadge className="mt-1">{REGULATOR[SERVICE_PROFESSION[service]]} verified</VerifiedBadge>
                      <span className="mt-3 flex items-center justify-between gap-2">
                        <AvailabilityPill available={p.available} />
                        <span className="text-right text-ds-md font-extrabold text-navy tabular-nums">
                          {formatNaira(p.price)}
                          <small className="block text-ds-2xs font-semibold text-muted">Home visit</small>
                        </span>
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {providers.length === 0 ? (
          <Button block className="mt-3 min-h-[52px]" onClick={() => setChoice("nearest")}>
            Send me the nearest available provider
          </Button>
        ) : (
          <button
            type="button"
            onClick={() => setChoice("nearest")}
            className={cx("flex w-full items-center gap-3 rounded-[20px] border border-line bg-surface p-3.5 text-left shadow-ds-sm hover:border-accent/40", focusRing)}
          >
            <span className="grid h-10 w-10 flex-none place-items-center rounded-[13px] bg-sky text-brand">
              <Zap size={18} aria-hidden />
            </span>
            <span>
              <span className="block text-ds-sm font-bold text-ink">No preference? Send the nearest available provider</span>
              <span className="block text-ds-xs text-muted">The fastest option. You&apos;ll see the price before you pay.</span>
            </span>
          </button>
        )}
      </div>
    );
  }

  // ── Step 2: who, when, where ────────────────────────────────
  return (
    <div className="max-w-md mx-auto space-y-5">
      <div>
        <h1 className="text-[24px] font-extrabold leading-tight tracking-[-0.02em] text-navy">{title}</h1>
        <p className="mt-0.5 text-ds-xs text-muted">{subtitle}</p>
      </div>
      {!followUpId && (
        <button
          type="button"
          onClick={() => { setChoice(null); setError(""); }}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-gray-900"
        >
          <ArrowLeft size={15} aria-hidden /> Choose a different provider
        </button>
      )}

      <div className="card p-5">
        {chosen ? (
          <div className="flex items-start gap-4">
            <ProviderAvatar provider={chosen} />
            <div className="min-w-0 flex-1">
              <p className="font-bold text-gray-900">{chosen.name}</p>
              <p className="text-sm text-gray-500">{serviceLabel}</p>
              <div className="mt-1 text-xs text-gray-500"><Rating provider={chosen} /></div>
            </div>
            <p className="text-lg font-bold text-blue-brand shrink-0">{formatNaira(chosen.price)}</p>
          </div>
        ) : (
          <div>
            <p className="font-bold text-gray-900 text-lg">{serviceLabel}</p>
            {description && <p className="text-sm text-gray-500 mt-1 italic">&ldquo;{description}&rdquo;</p>}
            <p className="text-xs text-gray-500 mt-1">
              {followUpId
                ? "Follow-up pricing applies: discounted from your provider's rate. You'll see the total before you pay."
                : "We'll send the nearest available verified provider. You'll see the price before you pay."}
            </p>
          </div>
        )}
      </div>

      {/* Who is this for */}
      {!followUpId && <FamilyMemberPicker onChange={setFamilyMemberId} />}

      {/* When */}
      {!followUpId && <SchedulePicker onChange={(v, ready) => { setScheduledAt(v); setScheduleReady(ready); }} />}

      {/* Location step */}
      <LocationPicker
        onReady={(c, a) => { setCoords(c); setAddress(a); }}
        onReset={() => { setCoords(null); setAddress(""); }}
      />

      {coords && (
        <div className="space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
              {error}
            </div>
          )}

          <button
            onClick={book}
            disabled={booking || !scheduleReady}
            className="btn-primary w-full text-base py-3 flex justify-center"
          >
            {booking ? (
              <>
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2 mt-0.5" />
                {chosen ? `Sending your request to ${chosen.name}…` : scheduledAt ? "Confirming your slot…" : "Finding your provider…"}
              </>
            ) : followUpId ? (
              "Book Follow-up"
            ) : chosen ? (
              `Book with ${chosen.name} · ${formatNaira(chosen.price)}`
            ) : scheduledAt ? (
              "Confirm Booking"
            ) : (
              "Book Now"
            )}
          </button>
          <p className="text-xs text-center text-gray-400">
            {chosen
              ? `${chosen.name} will be notified and can accept or decline. Payment is due before they set off.`
              : "We'll match you with the nearest available provider. Payment due after confirmation."}
          </p>
        </div>
      )}
    </div>
  );
}

function ProviderAvatar({ provider }: { provider: BookableProvider }) {
  return provider.photo_url ? (
    <img src={provider.photo_url} alt="" className="w-14 h-14 rounded-full object-cover shrink-0" />
  ) : (
    <div className="w-14 h-14 rounded-full bg-blue-light text-blue-brand flex items-center justify-center font-bold text-lg shrink-0" aria-hidden>
      {provider.name.replace(/^(dr|nurse|mr|mrs|ms)\.?\s+/i, "").charAt(0).toUpperCase()}
    </div>
  );
}

// Regulator that licenses each profession; every listed provider is verified against it
const REGULATOR: Record<string, string> = { doctor: "MDCN", nurse: "NMCN", physiotherapist: "MRTB" };

const sentence = (s: string) => (s ? s.charAt(0) + s.slice(1).toLowerCase() : s);

function Rating({ provider }: { provider: BookableProvider }) {
  return provider.rating > 0 ? (
    <span className="inline-flex items-center gap-1 text-[13px] font-extrabold text-ink">
      <Star size={14} className="fill-amber-500 text-amber-500" aria-hidden />
      {provider.rating.toFixed(1)}
    </span>
  ) : (
    <span className="text-[13px] font-semibold text-muted">New provider</span>
  );
}

function AvailabilityPill({ available }: { available: boolean }) {
  return available
    ? <Pill tone="ok" icon={Clock}>Available now</Pill>
    : <Pill tone="idle" icon={Clock}>Not online now</Pill>;
}

// Design screen "Provider profile", built from the data the list already has.
function ProviderProfile({ provider: p, regulator, onBack, onBook }: {
  provider: BookableProvider;
  regulator: string;
  onBack: () => void;
  onBook: () => void;
}) {
  const stats = [
    [p.years_experience > 0 ? `${p.years_experience} yrs` : "New", "Experience"],
    [String(p.total_visits), "Visits"],
    [p.rating > 0 ? p.rating.toFixed(1) : "New", "Rating"],
  ];
  return (
    <div className="mx-auto max-w-2xl">
      <div className="-mx-5 -mt-5 rounded-b-[32px] px-0 pb-1 md:mx-0 md:mt-0 md:rounded-[32px]"
        style={{ background: "linear-gradient(170deg, var(--sky) 0%, var(--bg) 100%)" }}>
        <TopBar title="" onBack={onBack} className="pt-3.5" />
      </div>

      <div className="pt-[18px]">
        <Avatar name={p.name} src={p.photo_url} size="lg" />
        <h1 className="mt-3 text-[24px] font-extrabold leading-tight tracking-[-0.02em] text-navy">{p.name}</h1>
        {p.specialty && <p className="mt-1 text-ds-sm text-muted">{p.specialty}</p>}
        <div className="mt-2.5 flex flex-wrap items-center gap-3">
          <VerifiedBadge>{regulator} verified</VerifiedBadge>
          <Rating provider={p} />
          <AvailabilityPill available={p.available} />
        </div>
        <div className="mt-[18px] grid grid-cols-3 gap-2.5">
          {stats.map(([v, l]) => (
            <div key={l} className="rounded-[18px] border border-line bg-surface px-2 py-3 text-center">
              <b className="block text-[17px] text-navy">{v}</b>
              <small className="text-ds-2xs font-semibold text-muted">{l}</small>
            </div>
          ))}
        </div>
      </div>

      {p.bio && (
        <Card className="mt-5">
          <h2 className="mb-2.5 text-ds-control font-bold text-navy">About {p.name.split(" ").slice(-1)[0]}</h2>
          <p className="text-ds-sm leading-[1.6] text-ink/80">{p.bio}</p>
        </Card>
      )}

      {/* TODO(design): month schedule (open, partly booked, fully booked days) needs a provider availability query; patients can't read other bookings. */}

      <section className="mt-[26px]">
        <h2 className="mb-3 text-[17px] font-bold text-navy">Home visit fee</h2>
        <Card>
          <div className="flex items-center justify-between text-ds-sm">
            <span className="text-muted">Visit fee</span>
            <b className="text-ink tabular-nums">{formatNaira(p.price)}</b>
          </div>
          {/* TODO(design): service charge and travel lines need the patient service fee, which isn't implemented. */}
        </Card>
      </section>

      {/* TODO(design): patient reviews need the provider's reviews loaded (reviews table exists, not queried here). */}

      {/* TODO(design): privacy note ("Booked times are shown as taken...") returns with the schedule. */}

      {/* Sticky price bar, sitting above the mobile tab bar */}
      <div className="sticky bottom-[76px] z-20 mt-6 flex items-center gap-3.5 rounded-ds-lg border border-line bg-surface/95 p-3.5 shadow-ds backdrop-blur md:bottom-4">
        <div>
          <small className="block text-ds-2xs font-bold text-muted">Home visit</small>
          <b className="text-[20px] tracking-[-0.01em] text-navy tabular-nums">{formatNaira(p.price)}</b>
        </div>
        <Button className="flex-1" onClick={onBook}>Book visit</Button>
      </div>
    </div>
  );
}
