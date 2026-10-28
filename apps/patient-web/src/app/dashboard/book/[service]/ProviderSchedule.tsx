"use client";
import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { createClient } from "@/lib/supabase";
import { Card, cx, focusRing } from "@/components/ds";
import { withinHours, type WeeklyHours } from "@/lib/working-hours";

// Bookable hours shown to patients (same slots as SchedulePicker)
export const FIRST_HOUR = 8;
export const LAST_HOUR = 19;
export const HOURS = Array.from({ length: LAST_HOUR - FIRST_HOUR + 1 }, (_, i) => FIRST_HOUR + i);
const LEAD_MS = 60 * 60 * 1000;
const WINDOW_DAYS = 60;

export type BusySlot = { start: number; end: number };

/** A provider's taken times for the next 60 days (migration 057). Empty until loaded or if unavailable. */
export function useBusySlots(providerId: string | null): BusySlot[] {
  const [slots, setSlots] = useState<BusySlot[]>([]);
  useEffect(() => {
    if (!providerId) return;
    let cancelled = false;
    const from = new Date();
    from.setHours(0, 0, 0, 0);
    const to = new Date(from.getTime() + WINDOW_DAYS * 86_400_000);
    createClient()
      .rpc("provider_busy_slots", { p_provider_id: providerId, p_from: from.toISOString(), p_to: to.toISOString() })
      .then(({ data, error }) => {
        if (cancelled || error || !data) return;
        setSlots((data as { starts_at: string; ends_at: string }[]).map(s => ({ start: Date.parse(s.starts_at), end: Date.parse(s.ends_at) })));
      });
    return () => { cancelled = true; };
  }, [providerId]);
  return slots;
}

export function slotStart(day: Date, hour: number) {
  const t = new Date(day);
  t.setHours(hour, 0, 0, 0);
  return t;
}

/** A one hour slot is taken when any busy booking overlaps it. */
export function isTaken(slots: BusySlot[], start: Date) {
  const s = start.getTime();
  const e = s + 60 * 60 * 1000;
  return slots.some(b => b.start < e && b.end > s);
}

export function slotLabel(hour: number) {
  const h = hour % 12 || 12;
  return `${h}:00 ${hour < 12 ? "am" : "pm"}`;
}

type DayState = "past" | "open" | "booked" | "full";

const DAY_STYLE: Record<DayState, string> = {
  past: "text-disabled-fg",
  open: "bg-success-bg text-ink",
  booked: "bg-danger-bg text-ink",
  full: "bg-pending-bg text-muted line-through",
};

/** Month calendar with open, partly booked and fully booked days, then the chosen day's times. */
export default function ProviderSchedule({ providerId, hours, onPick }: {
  providerId: string;
  /** The provider's weekly hours; other times aren't offered */
  hours: WeeklyHours | null;
  /** Called with the chosen start time (ISO) */
  onPick: (iso: string) => void;
}) {
  const busy = useBusySlots(providerId);
  const today = useMemo(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; }, []);
  const [monthOffset, setMonthOffset] = useState(0);
  const [day, setDay] = useState<Date>(today);
  const [hour, setHour] = useState<number | null>(null);

  const month = new Date(today.getFullYear(), today.getMonth() + monthOffset, 1);
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const lastBookable = new Date(today.getTime() + (WINDOW_DAYS - 1) * 86_400_000);
  const earliest = Date.now() + LEAD_MS;

  function state(d: Date): DayState {
    if (d < today || d > lastBookable) return "past";
    const open = HOURS.filter(h => slotStart(d, h).getTime() >= earliest && withinHours(hours, slotStart(d, h)));
    if (open.length === 0) return "past";
    const taken = open.filter(h => isTaken(busy, slotStart(d, h))).length;
    return taken === 0 ? "open" : taken >= open.length ? "full" : "booked";
  }

  const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  const dayState = state(day);

  return (
    <Card>
      <div className="mb-3 flex items-center justify-between">
        <b className="text-ds-control text-navy">{month.toLocaleDateString("en-GB", { month: "long", year: "numeric" })}</b>
        <div className="flex gap-1.5">
          <button type="button" aria-label="Previous month" disabled={monthOffset === 0} onClick={() => setMonthOffset(m => m - 1)}
            className={cx("grid h-[34px] w-[34px] place-items-center rounded-xl border border-line bg-surface text-navy disabled:opacity-40", focusRing)}>
            <ChevronLeft size={16} aria-hidden />
          </button>
          <button type="button" aria-label="Next month" disabled={monthOffset >= 1} onClick={() => setMonthOffset(m => m + 1)}
            className={cx("grid h-[34px] w-[34px] place-items-center rounded-xl border border-line bg-surface text-navy disabled:opacity-40", focusRing)}>
            <ChevronRight size={16} aria-hidden />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center" role="grid" aria-label="Choose a day">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(d => (
          <div key={d} className="pb-1 text-ds-2xs font-bold uppercase text-muted">{d}</div>
        ))}
        {Array.from({ length: month.getDay() }, (_, i) => <span key={`b${i}`} />)}
        {Array.from({ length: daysInMonth }, (_, i) => {
          const d = new Date(month.getFullYear(), month.getMonth(), i + 1);
          const st = state(d);
          const sel = sameDay(d, day);
          return (
            <button
              key={i}
              type="button"
              disabled={st === "past" || st === "full"}
              aria-pressed={sel}
              aria-label={`${d.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}, ${st === "full" ? "fully booked" : st === "booked" ? "partly booked" : st === "open" ? "open" : "unavailable"}`}
              onClick={() => { setDay(d); setHour(null); }}
              className={cx(
                "aspect-square rounded-[10px] text-ds-sm font-bold disabled:cursor-not-allowed",
                DAY_STYLE[st],
                sameDay(d, today) && "ring-1 ring-inset ring-navy/30",
                sel && "ring-2 ring-inset ring-accent",
                focusRing,
              )}
            >
              {i + 1}
            </button>
          );
        })}
      </div>

      <div className="mt-3 flex flex-wrap gap-3 text-ds-xs text-muted">
        {([["bg-success-bg", "Open"], ["bg-danger-bg", "Partly booked"], ["bg-pending-bg", "Fully booked"]] as const).map(([c, l]) => (
          <span key={l} className="inline-flex items-center gap-1.5"><i className={`h-3 w-3 rounded ${c}`} aria-hidden />{l}</span>
        ))}
      </div>

      <div className="mt-4">
        <b className="text-ds-sm text-ink">{day.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}</b>
        {dayState === "past" ? (
          <p className="mt-2 text-ds-xs text-muted">Pick a day from today onwards.</p>
        ) : (
          <>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {HOURS.map(h => {
                const start = slotStart(day, h);
                const taken = isTaken(busy, start);
                const tooSoon = start.getTime() < earliest || !withinHours(hours, start);
                return (
                  <button
                    key={h}
                    type="button"
                    disabled={taken || tooSoon}
                    aria-pressed={hour === h}
                    onClick={() => { setHour(h); onPick(start.toISOString()); }}
                    className={cx(
                      "min-h-11 rounded-[14px] border-[1.5px] text-[13px] font-bold",
                      hour === h ? "border-accent bg-accent-soft text-accent" : "border-line bg-surface text-ink",
                      taken && "line-through",
                      "disabled:cursor-not-allowed disabled:border-disabled disabled:bg-disabled disabled:text-disabled-fg",
                      focusRing,
                    )}
                  >
                    {slotLabel(h)}
                  </button>
                );
              })}
            </div>
            <p className="mt-3 text-ds-xs text-muted">
              {HOURS.some(h => isTaken(busy, slotStart(day, h)))
                ? "Greyed times are already booked by other patients."
                : HOURS.some(h => !withinHours(hours, slotStart(day, h)))
                  ? "Greyed times are outside this provider's working hours."
                  : "All times are open. Choose one to start a booking."}
            </p>
          </>
        )}
      </div>
    </Card>
  );
}
