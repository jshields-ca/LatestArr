// Cron can express "every day"/"every week on day X"/"every month on day X"
// exactly, so those three map to a friendly picker with zero ambiguity.
// Genuine biweekly/etc. can't be expressed correctly with plain 5-field cron
// (the day-of-month `*/N` trick resets at the start of every month, so the
// actual gap between fires drifts near month boundaries) — that's why it's
// deliberately not offered here. Anything that isn't one of these three
// shapes falls back to the raw cron field ("Advanced").

export type Frequency = "daily" | "weekly" | "monthly";

export interface SimpleSchedule {
  frequency: Frequency;
  hour: number;
  minute: number;
  /** 0 (Sunday) – 6 (Saturday). Only meaningful for "weekly". */
  dayOfWeek: number;
  /** 1–28, capped to stay valid in every month. Only meaningful for "monthly". */
  dayOfMonth: number;
}

export const DEFAULT_SIMPLE_SCHEDULE: SimpleSchedule = {
  frequency: "weekly",
  hour: 8,
  minute: 0,
  dayOfWeek: 1,
  dayOfMonth: 1,
};

export const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

export function simpleScheduleToCron(schedule: SimpleSchedule): string {
  const { frequency, hour, minute, dayOfWeek, dayOfMonth } = schedule;
  if (frequency === "daily") return `${minute} ${hour} * * *`;
  if (frequency === "weekly") return `${minute} ${hour} * * ${dayOfWeek}`;
  return `${minute} ${hour} ${dayOfMonth} * *`;
}

// Only recognizes the exact shapes simpleScheduleToCron produces — anything
// else (a hand-written cron, or one crafted before this feature existed)
// falls back to "Advanced" mode showing the raw string rather than
// misrepresenting it as a simple schedule it doesn't actually match.
export function parseCronToSimpleSchedule(cron: string): SimpleSchedule | null {
  const fields = cron.trim().split(/\s+/);
  if (fields.length !== 5) return null;
  const [minuteStr, hourStr, domStr, monthStr, dowStr] = fields;

  if (monthStr !== "*") return null;
  const minute = Number(minuteStr);
  const hour = Number(hourStr);
  if (!Number.isInteger(minute) || minute < 0 || minute > 59) return null;
  if (!Number.isInteger(hour) || hour < 0 || hour > 23) return null;

  if (domStr === "*" && dowStr === "*") {
    return { frequency: "daily", hour, minute, dayOfWeek: 1, dayOfMonth: 1 };
  }
  if (domStr === "*" && dowStr !== "*") {
    const dayOfWeek = Number(dowStr);
    if (!Number.isInteger(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6) return null;
    return { frequency: "weekly", hour, minute, dayOfWeek, dayOfMonth: 1 };
  }
  if (domStr !== "*" && dowStr === "*") {
    const dayOfMonth = Number(domStr);
    if (!Number.isInteger(dayOfMonth) || dayOfMonth < 1 || dayOfMonth > 28) return null;
    return { frequency: "monthly", hour, minute, dayOfWeek: 1, dayOfMonth };
  }
  return null;
}

// Intl.supportedValuesOf("timeZone") doesn't include "UTC" itself (it's a
// valid IANA identifier, just not one this returns) — prepended explicitly
// since it's the app's own default.
export const TIMEZONES: string[] = [
  "UTC",
  ...Intl.supportedValuesOf("timeZone").sort((a, b) => a.localeCompare(b)),
];

export function formatHourMinute(hour: number, minute: number): string {
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

export function parseHourMinute(value: string): { hour: number; minute: number } | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return { hour, minute };
}
