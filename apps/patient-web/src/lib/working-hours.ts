// A provider's weekly working hours (providers.weekly_hours, migration 060):
// {"mon":["08:00","18:00"], ...}; a missing day means not working.
// Without weekly hours, working_hours_start/end apply to weekdays; with neither,
// every time is allowed (as before hours existed).

export type WeeklyHours = Partial<Record<"mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun", [string, string]>>;

const KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;

export function weeklyHoursOf(p: { weekly_hours?: unknown; working_hours_start?: string | null; working_hours_end?: string | null }): WeeklyHours | null {
  if (p.weekly_hours && typeof p.weekly_hours === "object") return p.weekly_hours as WeeklyHours;
  if (p.working_hours_start && p.working_hours_end) {
    const h: [string, string] = [p.working_hours_start.slice(0, 5), p.working_hours_end.slice(0, 5)];
    return { mon: h, tue: h, wed: h, thu: h, fri: h };
  }
  return null;
}

const minutes = (hhmm: string) => { const [h, m] = hhmm.split(":").map(Number); return h * 60 + (m || 0); };

/** Whether a one hour slot starting at `start` falls inside the provider's hours */
export function withinHours(hours: WeeklyHours | null | undefined, start: Date, slotMinutes = 60): boolean {
  if (!hours) return true;
  const day = hours[KEYS[start.getDay()]];
  if (!day) return false;
  const s = start.getHours() * 60 + start.getMinutes();
  return s >= minutes(day[0]) && s + slotMinutes <= minutes(day[1]);
}
