"use client";
import { useMemo, useState } from "react";
import { SegmentedControl, cx, focusRing } from "@/components/ds";

// Earliest bookable time: at least 1 hour from now (same rule as before)
const LEAD_MS = 60 * 60 * 1000;
const FIRST_HOUR = 8;
const LAST_HOUR = 19;
const DAYS = 7;

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function slotLabel(hour: number) {
  const h = hour % 12 || 12;
  return `${h}:00 ${hour < 12 ? "am" : "pm"}`;
}

export default function SchedulePicker({
  onChange,
}: {
  // scheduledAt is null for ASAP; ready is false only when "Schedule"
  // is selected but no time has been picked yet — callers should block
  // booking in that case rather than silently falling back to ASAP.
  onChange: (scheduledAt: string | null, ready: boolean) => void;
}) {
  const [mode, setMode] = useState<"asap" | "scheduled">("asap");
  const [dayIndex, setDayIndex] = useState(0);
  const [hour, setHour] = useState<number | null>(null);

  const days = useMemo(() => {
    const today = startOfDay(new Date());
    return Array.from({ length: DAYS }, (_, i) => new Date(today.getTime() + i * 86_400_000));
  }, []);

  const earliest = Date.now() + LEAD_MS;
  const slotTime = (day: Date, h: number) => {
    const t = new Date(day);
    t.setHours(h, 0, 0, 0);
    return t;
  };
  const hours = Array.from({ length: LAST_HOUR - FIRST_HOUR + 1 }, (_, i) => FIRST_HOUR + i);

  function emit(nextDay: number, nextHour: number | null) {
    if (nextHour === null) { onChange(null, false); return; }
    onChange(slotTime(days[nextDay], nextHour).toISOString(), true);
  }

  function selectMode(m: "asap" | "scheduled") {
    setMode(m);
    if (m === "asap") onChange(null, true);
    else emit(dayIndex, hour);
  }

  function selectDay(i: number) {
    setDayIndex(i);
    // A time that is too soon on the new day is cleared
    const keep = hour !== null && slotTime(days[i], hour).getTime() >= earliest ? hour : null;
    setHour(keep);
    emit(i, keep);
  }

  function selectHour(h: number) {
    setHour(h);
    emit(dayIndex, h);
  }

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
            {hours.map(h => {
              const tooSoon = slotTime(days[dayIndex], h).getTime() < earliest;
              const on = hour === h;
              return (
                <button
                  key={h}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  disabled={tooSoon}
                  onClick={() => selectHour(h)}
                  className={cx(
                    "min-h-11 rounded-[14px] border-[1.5px] text-[13px] font-bold",
                    on ? "border-accent bg-accent-soft text-accent" : "border-line bg-surface text-ink",
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
            {hour === null ? "Choose a time to continue. Times within the next hour aren't available." : "Your provider confirms the time when they accept."}
          </p>
          {/* TODO(design): greyed "taken" slots need the provider's booked times (no availability query yet). */}
        </>
      ) : (
        <p className="mt-2.5 text-ds-sm text-muted">We send your request straight away to a provider who can come now.</p>
      )}
    </section>
  );
}
