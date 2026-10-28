"use client";
import { useEffect, useMemo, useState } from "react";
import { SegmentedControl, cx, focusRing } from "@/components/ds";
import { HOURS, isTaken, slotLabel, slotStart, type BusySlot } from "./ProviderSchedule";

// Earliest bookable time: at least 1 hour from now
const LEAD_MS = 60 * 60 * 1000;
const DAYS = 7;

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export default function SchedulePicker({
  onChange,
  busy = [],
  initialAt = null,
}: {
  // scheduledAt is null for ASAP; ready is false only when "Schedule"
  // is selected but no time has been picked yet — callers should block
  // booking in that case rather than silently falling back to ASAP.
  onChange: (scheduledAt: string | null, ready: boolean) => void;
  /** The chosen provider's taken times; those slots are disabled */
  busy?: BusySlot[];
  /** A time already picked on the provider's calendar */
  initialAt?: string | null;
}) {
  // The strip starts today, or on the day picked on the calendar when that's further out
  const days = useMemo(() => {
    const today = startOfDay(new Date());
    const picked = initialAt ? startOfDay(new Date(initialAt)) : null;
    const first = picked && picked.getTime() > today.getTime() + (DAYS - 1) * 86_400_000 ? picked : today;
    return Array.from({ length: DAYS }, (_, i) => new Date(first.getTime() + i * 86_400_000));
  }, [initialAt]);

  const initial = useMemo(() => {
    if (!initialAt) return null;
    const t = new Date(initialAt);
    const i = days.findIndex(d => d.toDateString() === t.toDateString());
    return i >= 0 && HOURS.includes(t.getHours()) ? { dayIndex: i, hour: t.getHours() } : null;
  }, [initialAt, days]);

  const [mode, setMode] = useState<"asap" | "scheduled">(initial ? "scheduled" : "asap");
  const [dayIndex, setDayIndex] = useState(initial?.dayIndex ?? 0);
  const [hour, setHour] = useState<number | null>(initial?.hour ?? null);

  // A time picked on the calendar counts as chosen
  useEffect(() => {
    if (initial) onChange(slotStart(days[initial.dayIndex], initial.hour).toISOString(), true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const earliest = Date.now() + LEAD_MS;
  const unavailable = (d: Date, h: number) => slotStart(d, h).getTime() < earliest || isTaken(busy, slotStart(d, h));

  function emit(nextDay: number, nextHour: number | null) {
    if (nextHour === null) { onChange(null, false); return; }
    onChange(slotStart(days[nextDay], nextHour).toISOString(), true);
  }

  function selectMode(m: "asap" | "scheduled") {
    setMode(m);
    if (m === "asap") onChange(null, true);
    else emit(dayIndex, hour);
  }

  function selectDay(i: number) {
    setDayIndex(i);
    // A time that isn't available on the new day is cleared
    const keep = hour !== null && !unavailable(days[i], hour) ? hour : null;
    setHour(keep);
    emit(i, keep);
  }

  function selectHour(h: number) {
    setHour(h);
    emit(dayIndex, h);
  }

  const anyTaken = HOURS.some(h => isTaken(busy, slotStart(days[dayIndex], h)));

  return (
    <section>
      <h3 className="mb-3 text-[17px] font-bold text-navy">When?</h3>
      <SegmentedControl
        label="When"
        value={mode}
        onChange={selectMode}
        options={[{ value: "asap", label: "Now" }, { value: "scheduled", label: "Schedule" }]}
      />

      {mode === "scheduled" ? (
        <>
          <div className="mt-3.5 flex gap-2 overflow-x-auto pb-1.5" role="radiogroup" aria-label="Day">
            {days.map((d, i) => {
              const on = i === dayIndex;
              return (
                <button
                  key={d.toISOString()}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => selectDay(i)}
                  className={cx(
                    "w-[60px] flex-none rounded-ds border-[1.5px] py-2.5 text-center",
                    on ? "border-accent bg-accent-soft" : "border-line bg-surface",
                    focusRing,
                  )}
                >
                  <small className="block text-ds-2xs font-bold uppercase text-muted">
                    {d.toLocaleDateString("en-GB", { weekday: "short" })}
                  </small>
                  <b className="text-ds-lg text-navy">{d.getDate()}</b>
                </button>
              );
            })}
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2" role="radiogroup" aria-label="Time">
            {HOURS.map(h => {
              const taken = isTaken(busy, slotStart(days[dayIndex], h));
              const on = hour === h;
              return (
                <button
                  key={h}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  aria-label={`${slotLabel(h)}${taken ? ", already booked" : ""}`}
                  disabled={unavailable(days[dayIndex], h)}
                  onClick={() => selectHour(h)}
                  className={cx(
                    "min-h-11 rounded-[14px] border-[1.5px] text-[13px] font-bold",
                    on ? "border-accent bg-accent-soft text-accent" : "border-line bg-surface text-ink",
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
            {hour === null
              ? anyTaken
                ? "Greyed times are already booked or within the next hour."
                : "Choose a time to continue. Times within the next hour aren't available."
              : "Your provider confirms the time when they accept."}
          </p>
        </>
      ) : (
        <p className="mt-2.5 text-ds-sm text-muted">We send your request straight away to a provider who can come now.</p>
      )}
    </section>
  );
}
