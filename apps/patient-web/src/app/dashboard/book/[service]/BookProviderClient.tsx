"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Star, BadgeCheck, Search, ArrowLeft, Zap } from "lucide-react";
import { SERVICE_LABELS, formatNaira } from "@/lib/shared";
import type { ServiceType } from "@/lib/shared";
import FamilyMemberPicker from "./FamilyMemberPicker";
import SchedulePicker from "./SchedulePicker";
import LocationPicker from "@/components/LocationPicker";

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
}: {
  service: ServiceType;
  providers: BookableProvider[];
  description?: string;
  careEpisodeId?: string;
  followUpId?: string;
}) {
  const router = useRouter();
  // A follow-up goes to the continuing provider, so skip straight to the booking steps
  const [choice, setChoice] = useState<Choice>(followUpId ? "nearest" : null);
  const [query, setQuery] = useState("");
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

  // ── Step 1: choose a provider ───────────────────────────────
  if (!choice) {
    const q = query.trim().toLowerCase();
    const shown = q
      ? providers.filter(p => `${p.name} ${p.specialty}`.toLowerCase().includes(q))
      : providers;

    return (
      <div className="max-w-2xl mx-auto space-y-4">
        {description && (
          <p className="text-sm text-gray-500 italic">&ldquo;{description}&rdquo;</p>
        )}

        {providers.length > 6 && (
          <div className="relative">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" aria-hidden />
            <input
              className="input pl-10"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search by name or specialty"
              aria-label="Search providers"
            />
          </div>
        )}

        {providers.length === 0 ? (
          <div className="card p-6 text-center">
            <p className="font-semibold text-gray-900">No providers are listed for {serviceLabel} yet</p>
            <p className="text-sm text-gray-500 mt-1">
              We can still send you the nearest available verified provider.
            </p>
          </div>
        ) : shown.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-6">No providers match &ldquo;{query}&rdquo;.</p>
        ) : (
          <ul className="space-y-3">
            {shown.map(p => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => setChoice(p)}
                  className="card w-full p-4 text-left flex items-start gap-4 hover:shadow-card-md hover:border-blue-mid active:scale-[0.99] transition-all"
                >
                  <Avatar provider={p} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-semibold text-gray-900 flex items-center gap-1.5">
                          <span className="truncate">{p.name}</span>
                          <BadgeCheck size={16} className="text-blue-brand shrink-0" aria-label="Verified" />
                        </p>
                        {p.specialty && <p className="text-sm text-gray-500 truncate">{p.specialty}</p>}
                      </div>
                      <p className="text-lg font-bold text-blue-brand shrink-0">{formatNaira(p.price)}</p>
                    </div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500">
                      <Rating provider={p} />
                      {p.years_experience > 0 && <span>{p.years_experience} yrs experience</span>}
                      {p.available && (
                        <span className="inline-flex items-center gap-1 font-semibold text-green-700">
                          <span className="w-1.5 h-1.5 rounded-full bg-green-500" aria-hidden /> Available now
                        </span>
                      )}
                    </div>
                    {p.bio && <p className="text-sm text-gray-600 mt-2 line-clamp-2">{p.bio}</p>}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}

        <button
          type="button"
          onClick={() => setChoice("nearest")}
          className={providers.length === 0 ? "btn-primary w-full text-base py-3" : "card w-full p-4 text-left flex items-center gap-3 hover:border-blue-mid transition-all"}
        >
          {providers.length === 0 ? (
            "Send me the nearest available provider"
          ) : (
            <>
              <span className="w-10 h-10 rounded-xl bg-blue-light flex items-center justify-center shrink-0">
                <Zap size={18} className="text-blue-brand" aria-hidden />
              </span>
              <span>
                <span className="block text-sm font-semibold text-gray-900">No preference? Send the nearest available provider</span>
                <span className="block text-xs text-gray-500">The fastest option. You&apos;ll see the price before you pay.</span>
              </span>
            </>
          )}
        </button>
      </div>
    );
  }

  // ── Step 2: who, when, where ────────────────────────────────
  return (
    <div className="max-w-md mx-auto space-y-5">
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
            <Avatar provider={chosen} />
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

function Avatar({ provider }: { provider: BookableProvider }) {
  return provider.photo_url ? (
    <img src={provider.photo_url} alt="" className="w-14 h-14 rounded-full object-cover shrink-0" />
  ) : (
    <div className="w-14 h-14 rounded-full bg-blue-light text-blue-brand flex items-center justify-center font-bold text-lg shrink-0" aria-hidden>
      {provider.name.replace(/^(dr|nurse|mr|mrs|ms)\.?\s+/i, "").charAt(0).toUpperCase()}
    </div>
  );
}

function Rating({ provider }: { provider: BookableProvider }) {
  return provider.rating > 0 ? (
    <span className="inline-flex items-center gap-1">
      <Star size={12} className="text-amber-500 fill-amber-500" aria-hidden />
      {provider.rating.toFixed(1)} · {provider.total_visits} visit{provider.total_visits === 1 ? "" : "s"}
    </span>
  ) : (
    <span>New provider</span>
  );
}
