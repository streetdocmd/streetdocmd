"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Star, Search, Zap, Clock, Lock } from "lucide-react";
import { SERVICE_LABELS, SERVICE_PROFESSION, formatNaira } from "@/lib/shared";
import { serviceChargeFor } from "@/lib/service-charge";
import type { ServiceType } from "@/lib/shared";
import FamilyMemberPicker from "./FamilyMemberPicker";
import SchedulePicker from "./SchedulePicker";
import LocationPicker from "@/components/LocationPicker";
import { Avatar, Button, Card, Chip, EmergencyNotice, Notice, Pill, TopBar, VerifiedBadge, cx, focusRing } from "@/components/ds";
import { createClient } from "@/lib/supabase";
import ProviderSchedule, { useBusySlots } from "./ProviderSchedule";
import type { WeeklyHours } from "@/lib/working-hours";

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
  /** Weekly working hours; scheduled visits only fall inside them (null = any time) */
  hours?: WeeklyHours | null;
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
  serviceChargeRate,
  openProviderId,
}: {
  /** Open this provider's profile straight away (links from Search) */
  openProviderId?: string;
  /** Patient service charge rate (platform_settings); the server applies the same rate */
  serviceChargeRate: number;
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
  const [viewing, setViewing] = useState<BookableProvider | null>(
    () => (openProviderId ? providers.find(p => p.id === openProviderId) ?? null : null),
  );
  // A time picked on the provider's calendar, carried into the When step
  const [presetAt, setPresetAt] = useState<string | null>(null);
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
  const busy = useBusySlots(chosen?.id ?? null);

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
        serviceChargeRate={serviceChargeRate}
        presetAt={presetAt}
        onPick={setPresetAt}
        onBack={() => { setViewing(null); setPresetAt(null); }}
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
          <Button block size="lg" className="mt-3" onClick={() => setChoice("nearest")}>
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
  const ready = !!coords && scheduleReady;
  return (
    <div className="mx-auto max-w-md">
      {followUpId ? (
        <TopBar title="Book a visit" backHref="/dashboard" className="-mx-5 -mt-2 md:mx-0" />
      ) : (
        <TopBar title="Book a visit" onBack={() => { setChoice(null); setError(""); }} className="-mx-5 -mt-2 md:mx-0" />
      )}
      <div className="mb-4 flex gap-1.5" aria-hidden>
        <span className="h-[5px] flex-1 rounded bg-accent" />
        <span className="h-[5px] flex-1 rounded bg-line" />
        <span className="h-[5px] flex-1 rounded bg-line" />
      </div>

      <EmergencyNotice className="mb-4" />

      {/* What is being booked */}
      <div className="flex items-center gap-3 rounded-[20px] border border-line bg-surface p-3.5">
        {chosen ? (
          <>
            <Avatar name={chosen.name} src={chosen.photo_url} size="sm" />
            <div className="min-w-0 flex-1">
              <b className="block truncate text-ds-control text-ink">{chosen.name}</b>
              <small className="text-ds-xs text-muted">{title}</small>
            </div>
            <span className="font-extrabold text-navy tabular-nums">{formatNaira(chosen.price)}</span>
          </>
        ) : (
          <div className="min-w-0 flex-1">
            <b className="block text-ds-control text-ink">{title}</b>
            {description && <small className="block text-ds-xs italic text-muted">&ldquo;{description}&rdquo;</small>}
            <small className="block text-ds-xs text-muted">
              {followUpId
                ? "Follow up pricing applies: discounted from your provider's rate. You'll see the total before you pay."
                : "We'll send the nearest available verified provider. You'll see the price before you pay."}
            </small>
          </div>
        )}
      </div>

      <div className="mt-[26px] space-y-[26px]">
        {!followUpId && <FamilyMemberPicker onChange={setFamilyMemberId} />}
        {!followUpId && (
          <SchedulePicker
            key={`${chosen?.id ?? "nearest"}-${presetAt ?? ""}`}
            busy={busy}
            hours={chosen?.hours ?? null}
            initialAt={chosen ? presetAt : null}
            onChange={(v, ready) => { setScheduledAt(v); setScheduleReady(ready); }}
          />
        )}
        <LocationPicker
          onReady={(c, a) => { setCoords(c); setAddress(a); }}
          onReset={() => { setCoords(null); setAddress(""); }}
        />
      </div>

      {error && <Notice tone="danger" className="mt-4">{error}</Notice>}

      <div className="sticky bottom-[76px] z-20 mt-6 rounded-ds-lg border border-line bg-surface/95 p-3.5 shadow-ds backdrop-blur md:bottom-4">
        <div className="flex items-center gap-3.5">
          <div>
            <small className="block text-ds-2xs font-bold text-muted">{chosen ? "Total with service charge" : "Price"}</small>
            <b className="text-[20px] tracking-[-0.01em] text-navy tabular-nums">
              {chosen ? formatNaira(chosen.price + serviceChargeFor(chosen.price, serviceChargeRate)) : "Before you pay"}
            </b>
          </div>
          <Button className="flex-1" onClick={book} disabled={booking || !ready} aria-busy={booking}>
            {booking
              ? (chosen ? "Sending request…" : scheduledAt ? "Confirming your slot…" : "Finding your provider…")
              : "Continue"}
          </Button>
        </div>
        <p className="mt-2 text-center text-ds-xs text-muted">
          {!coords
            ? "Add the visit address to continue."
            : chosen
              ? `${chosen.name} will be notified and can accept or decline. Payment is due before they set off.`
              : "We'll match you with the nearest available provider. Payment due after confirmation."}
        </p>
      </div>
    </div>
  );
}

// Latest written reviews for a provider (reviews are publicly readable)
function ProviderReviews({ providerId }: { providerId: string }) {
  const [reviews, setReviews] = useState<{ rating: number; comment: string | null; created_at: string }[] | null>(null);
  const [count, setCount] = useState(0);
  useEffect(() => {
    let cancelled = false;
    createClient()
      .from("reviews")
      .select("rating, comment, created_at", { count: "exact" })
      .eq("provider_id", providerId)
      .not("comment", "is", null)
      .order("created_at", { ascending: false })
      .limit(3)
      .then(({ data, count: c }) => { if (!cancelled) { setReviews(data ?? []); setCount(c ?? 0); } });
    return () => { cancelled = true; };
  }, [providerId]);

  if (!reviews || reviews.length === 0) return null;
  return (
    <section className="mt-[26px]">
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="text-[17px] font-bold text-navy">Patient reviews</h2>
        <span className="text-ds-sm text-muted">{count} written</span>
      </div>
      <div className="space-y-3">
        {reviews.map((r, i) => (
          <Card key={i}>
            <div className="flex items-center justify-between">
              <span className="inline-flex gap-0.5" aria-label={`${r.rating} out of 5`}>
                {[1, 2, 3, 4, 5].map(n => (
                  <Star key={n} size={14} className={n <= r.rating ? "fill-amber-500 text-amber-500" : "fill-line text-line"} aria-hidden />
                ))}
              </span>
              <span className="text-ds-xs text-muted">{timeAgo(r.created_at)}</span>
            </div>
            <p className="mt-2 text-ds-sm text-ink/85">{r.comment}</p>
          </Card>
        ))}
      </div>
    </section>
  );
}

function timeAgo(iso: string) {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days < 1) return "Today";
  if (days < 7) return `${days} day${days === 1 ? "" : "s"} ago`;
  if (days < 30) return `${Math.floor(days / 7)} week${days < 14 ? "" : "s"} ago`;
  const months = Math.floor(days / 30);
  return `${months} month${months === 1 ? "" : "s"} ago`;
}

// Regulator that licenses each profession; every listed provider is verified against it
const REGULATOR: Record<string, string> = { doctor: "MDCN", nurse: "NMCN", physiotherapist: "MRTB" };

const sentence = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : s);

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
function ProviderProfile({ provider: p, regulator, serviceChargeRate, presetAt, onPick, onBack, onBook }: {
  provider: BookableProvider;
  regulator: string;
  serviceChargeRate: number;
  presetAt: string | null;
  onPick: (iso: string) => void;
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

      <section className="mt-[26px]">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-[17px] font-bold text-navy">Schedule</h2>
          <span className="text-ds-sm text-muted">Times in Lagos time</span>
        </div>
        <ProviderSchedule providerId={p.id} hours={p.hours ?? null} onPick={onPick} />
      </section>

      <section className="mt-[26px]">
        <h2 className="mb-3 text-[17px] font-bold text-navy">Home visit fee</h2>
        <Card>
          {[
            ["Visit fee", formatNaira(p.price)],
            ["Service charge", formatNaira(serviceChargeFor(p.price, serviceChargeRate))],
            ["Total", formatNaira(p.price + serviceChargeFor(p.price, serviceChargeRate))],
          ].map(([k, v], i) => (
            <div key={k} className={`flex items-center justify-between border-b border-line py-2.5 text-ds-sm last:border-b-0 ${i === 2 ? "font-extrabold" : ""}`}>
              <span className={i === 2 ? "text-ink" : "text-muted"}>{k}</span>
              <b className="text-ink tabular-nums">{v}</b>
            </div>
          ))}
        </Card>
      </section>

      <ProviderReviews providerId={p.id} />

      <div className="mt-5 flex gap-2.5 rounded-ds bg-sky p-3 text-ds-xs leading-normal text-navy">
        <Lock size={18} className="mt-px flex-none text-brand" aria-hidden />
        <span>Booked times are shown as taken, but patient details are never shared with other patients.</span>
      </div>

      {/* Sticky price bar, sitting above the mobile tab bar */}
      <div className="sticky bottom-[76px] z-20 mt-6 flex items-center gap-3.5 rounded-ds-lg border border-line bg-surface/95 p-3.5 shadow-ds backdrop-blur md:bottom-4">
        <div>
          <small className="block text-ds-2xs font-bold text-muted">Home visit</small>
          <b className="text-[20px] tracking-[-0.01em] text-navy tabular-nums">{formatNaira(p.price)}</b>
          <small className="block text-ds-2xs text-muted">plus {formatNaira(serviceChargeFor(p.price, serviceChargeRate))} service charge</small>
        </div>
        <Button className="flex-1" onClick={onBook}>
          {presetAt
            ? `Book ${new Date(presetAt).toLocaleDateString("en-NG", { weekday: "short" })}, ${new Date(presetAt).toLocaleTimeString("en-NG", { hour: "numeric", hour12: true }).toLowerCase()}`
            : "Book visit"}
        </Button>
      </div>
    </div>
  );
}
