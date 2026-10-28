"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, MapPin } from "lucide-react";
import { createClient } from "@/lib/supabase";
import { Button, Card, Pill, cx, focusRing } from "@/components/ds";

export interface CalendarVisit {
  id: string;
  at: string;
  service: string;
  patient: string;
  area: string;
  asap: boolean;
}

const BUSY_AT = 4; // a day with this many visits shows as busy
const dayKey = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Lagos" }).format(d);

// The design's provider calendar: month view coloured by bookings, the chosen
// day's agenda, and Block this day / Remove time off (provider_time_off, migration 060).
export default function CalendarClient({ providerId, visits, timeOff, timeOffAvailable }: {
  providerId: string;
  visits: CalendarVisit[];
  timeOff: string[];
  /** False until migration 060 is applied */
  timeOffAvailable: boolean;
}) {
  const router = useRouter();
  const today = useMemo(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; }, []);
  const [monthOffset, setMonthOffset] = useState(0);
  const [selected, setSelected] = useState(dayKey(today));
  const [off, setOff] = useState(() => new Set(timeOff));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const byDay = useMemo(() => {
    const m = new Map<string, CalendarVisit[]>();
    for (const v of visits) {
      const k = dayKey(new Date(v.at));
      m.set(k, [...(m.get(k) ?? []), v]);
    }
    return m;
  }, [visits]);

  const month = new Date(today.getFullYear(), today.getMonth() + monthOffset, 1);
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const selectedDate = new Date(`${selected}T00:00:00`);
  const dayVisits = (byDay.get(selected) ?? []).slice().sort((a, b) => a.at.localeCompare(b.at));
  const isOff = off.has(selected);
  const isPast = selectedDate < today;

  async function toggleTimeOff() {
    setSaving(true);
    setError("");
    const supabase = createClient();
    const { error: err } = isOff
      ? await supabase.from("provider_time_off").delete().eq("provider_id", providerId).eq("day", selected)
      : await supabase.from("provider_time_off").insert({ provider_id: providerId, day: selected });
    setSaving(false);
    if (err) { setError("Couldn't save. Check your connection and try again."); return; }
    setOff(prev => { const n = new Set(prev); if (isOff) n.delete(selected); else n.add(selected); return n; });
    router.refresh();
  }

  return (
    <>
      <Card>
        <div className="mb-3 flex items-center justify-between">
          <b className="text-ds-control text-navy">{month.toLocaleDateString("en-GB", { month: "long", year: "numeric" })}</b>
          <div className="flex items-center gap-1.5">
            <span className="mr-1 text-ds-sm text-muted">Tap a day</span>
            <button type="button" aria-label="Previous month" disabled={monthOffset <= 0} onClick={() => setMonthOffset(m => m - 1)}
              className={cx("grid h-[34px] w-[34px] place-items-center rounded-xl border border-line bg-surface text-navy disabled:opacity-40", focusRing)}>
              <ChevronLeft size={16} aria-hidden />
            </button>
            <button type="button" aria-label="Next month" disabled={monthOffset >= 2} onClick={() => setMonthOffset(m => m + 1)}
              className={cx("grid h-[34px] w-[34px] place-items-center rounded-xl border border-line bg-surface text-navy disabled:opacity-40", focusRing)}>
              <ChevronRight size={16} aria-hidden />
            </button>
          </div>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(d => (
            <div key={d} className="pb-1 text-ds-2xs font-bold uppercase text-muted">{d}</div>
          ))}
          {Array.from({ length: month.getDay() }, (_, i) => <span key={`b${i}`} />)}
          {Array.from({ length: daysInMonth }, (_, i) => {
            const d = new Date(month.getFullYear(), month.getMonth(), i + 1);
            const k = dayKey(d);
            const n = byDay.get(k)?.length ?? 0;
            const dayOff = off.has(k);
            return (
              <button key={k} type="button" aria-pressed={selected === k} onClick={() => setSelected(k)}
                aria-label={`${d.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}${dayOff ? ", time off" : n ? `, ${n} booking${n === 1 ? "" : "s"}` : ""}`}
                className={cx(
                  "relative aspect-square rounded-[10px] text-ds-sm font-bold",
                  dayOff ? "bg-pending-bg text-muted line-through" : n >= BUSY_AT ? "bg-danger-bg text-ink" : n > 0 ? "bg-success-bg text-ink" : d < today ? "text-disabled-fg" : "text-ink",
                  k === dayKey(today) && "ring-1 ring-inset ring-navy/30",
                  selected === k && "ring-2 ring-inset ring-accent",
                  focusRing,
                )}>
                {i + 1}
                {n > 0 && !dayOff && <span className="absolute bottom-0.5 left-0 right-0 text-[9px] font-bold text-muted">{n}</span>}
              </button>
            );
          })}
        </div>
        <div className="mt-3 flex flex-wrap gap-3 text-ds-xs text-muted">
          {([["bg-success-bg", "Some bookings"], ["bg-danger-bg", "Busy"], ["bg-pending-bg", "Time off"]] as const).map(([c, l]) => (
            <span key={l} className="inline-flex items-center gap-1.5"><i className={`h-3 w-3 rounded ${c}`} aria-hidden />{l}</span>
          ))}
        </div>
      </Card>

      <section className="mt-[26px]">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-[17px] font-bold text-navy">
            {selectedDate.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}
          </h2>
          <span className="text-ds-sm text-muted">{isOff ? "Time off" : `${dayVisits.length} booking${dayVisits.length === 1 ? "" : "s"}`}</span>
        </div>

        {isOff ? (
          <div className="rounded-[20px] border border-dashed border-muted/40 bg-surface px-4 py-[18px] text-center text-ds-sm text-muted">
            You have blocked this day. Patients cannot book.
          </div>
        ) : dayVisits.length ? (
          <div className="grid gap-2.5">
            {dayVisits.map(v => (
              <Link key={v.id} href={`/dashboard/active/${v.id}`}
                className={cx("flex items-stretch gap-3 rounded-[18px] border border-line bg-surface px-3.5 py-3", focusRing)}>
                <span className="w-[66px] flex-none pt-0.5 text-[13px] font-extrabold text-navy">
                  {v.asap ? "Now" : new Date(v.at).toLocaleTimeString("en-NG", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: "Africa/Lagos" }).toLowerCase()}
                </span>
                <span className="min-w-0 flex-1">
                  <b className="block text-ds-sm text-ink">{v.patient}</b>
                  <small className="text-ds-xs text-muted">{v.service}</small>
                </span>
                {v.area && <Pill tone="info" icon={MapPin}>{v.area}</Pill>}
              </Link>
            ))}
          </div>
        ) : (
          <div className="rounded-[20px] border border-dashed border-muted/40 bg-surface px-4 py-[18px] text-center text-ds-sm text-muted">
            No bookings yet. Your profile is visible on this day.
          </div>
        )}

        {timeOffAvailable && !isPast && (
          <div id="block">
            <Button variant="secondary" block className="mt-3.5" onClick={toggleTimeOff} disabled={saving || (!isOff && dayVisits.length > 0)}>
              {saving ? "Saving…" : isOff ? "Remove time off" : "Block this day"}
            </Button>
            {!isOff && dayVisits.length > 0 && (
              <p className="mt-2 text-center text-ds-xs text-muted">You have bookings on this day, so it can&apos;t be blocked.</p>
            )}
          </div>
        )}
        {error && <p className="mt-2 text-center text-ds-xs font-semibold text-danger">{error}</p>}
      </section>
    </>
  );
}
