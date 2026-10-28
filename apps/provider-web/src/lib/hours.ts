// Weekly working hours (providers.weekly_hours, migration 060):
// {"mon":["08:00","18:00"], ...}; a missing day means not working.
// Before a provider sets them, working_hours_start/end apply to every weekday.

export const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
export type Day = (typeof DAYS)[number];
export type WeeklyHours = Partial<Record<Day, [string, string]>>;

export const DAY_LABEL: Record<Day, string> = {
  mon: "Monday", tue: "Tuesday", wed: "Wednesday", thu: "Thursday", fri: "Friday", sat: "Saturday", sun: "Sunday",
};

export function weeklyHoursOf(p: { weekly_hours?: unknown; working_hours_start?: string | null; working_hours_end?: string | null }): WeeklyHours {
  if (p.weekly_hours && typeof p.weekly_hours === "object") return p.weekly_hours as WeeklyHours;
  if (p.working_hours_start && p.working_hours_end) {
    const h: [string, string] = [p.working_hours_start.slice(0, 5), p.working_hours_end.slice(0, 5)];
    return { mon: h, tue: h, wed: h, thu: h, fri: h };
  }
  return {};
}

export function timeLabel(hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number);
  const suffix = h < 12 ? "am" : "pm";
  return `${h % 12 || 12}:${String(m ?? 0).padStart(2, "0")} ${suffix}`;
}

/** Human summary: "Weekdays 8:00 am to 6:00 pm", "Saturday 9:00 am to 2:00 pm" */
export function hoursSummary(hours: WeeklyHours): { label: string; value: string }[] {
  const rows: { label: string; value: string }[] = [];
  const same = (a?: [string, string], b?: [string, string]) => !!a && !!b && a[0] === b[0] && a[1] === b[1];
  const weekdays = DAYS.slice(0, 5);
  if (weekdays.every(d => same(hours[d], hours.mon))) {
    rows.push({ label: "Weekdays", value: `${timeLabel(hours.mon![0])} to ${timeLabel(hours.mon![1])}` });
  } else {
    for (const d of weekdays) if (hours[d]) rows.push({ label: DAY_LABEL[d], value: `${timeLabel(hours[d]![0])} to ${timeLabel(hours[d]![1])}` });
  }
  for (const d of ["sat", "sun"] as Day[]) if (hours[d]) rows.push({ label: `${DAY_LABEL[d]}s`, value: `${timeLabel(hours[d]![0])} to ${timeLabel(hours[d]![1])}` });
  return rows;
}
