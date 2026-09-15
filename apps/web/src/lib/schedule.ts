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

function formatTime12h(hour: number, minute: number): string {
  const period = hour < 12 ? "AM" : "PM";
  const displayHour = hour % 12 === 0 ? 12 : hour % 12;
  return `${displayHour}:${String(minute).padStart(2, "0")} ${period}`;
}

// 11/12/13 (and their hundreds, e.g. 111/112/113) are the exception to the
// usual 1/2/3 -> st/nd/rd pattern — every other number falls through to its
// last digit.
function ordinal(n: number): string {
  const rem100 = n % 100;
  if (rem100 >= 11 && rem100 <= 13) return `${n}th`;
  switch (n % 10) {
    case 1:
      return `${n}st`;
    case 2:
      return `${n}nd`;
    case 3:
      return `${n}rd`;
    default:
      return `${n}th`;
  }
}

// Newsletter cards used to show the raw cron string even for schedules
// created through the Simple picker, which defeats the point of offering a
// friendly picker in the first place. Recognized shapes get a plain-English
// sentence; a genuinely custom cron (parseCronToSimpleSchedule returns null)
// still falls back to the raw string, which is the right call for power
// users in Advanced mode.
export function formatScheduleForDisplay(cron: string, timezone: string): string {
  const parsed = parseCronToSimpleSchedule(cron);
  if (!parsed) return `${cron} (${timezone})`;

  const time = formatTime12h(parsed.hour, parsed.minute);
  let sentence: string;
  if (parsed.frequency === "daily") {
    sentence = `Daily at ${time}`;
  } else if (parsed.frequency === "weekly") {
    sentence = `Weekly on ${DAY_NAMES[parsed.dayOfWeek]} at ${time}`;
  } else {
    sentence = `Monthly on the ${ordinal(parsed.dayOfMonth)} at ${time}`;
  }
  return `${sentence} (${timezone})`;
}

// The "Add newsletter" dialog used to default Timezone to "UTC" no matter
// what the browser actually reports, silently mismatching the schedule for
// anyone not in UTC. Guarded against an environment reporting a timezone
// this build's TIMEZONES list doesn't contain (or resolvedOptions() being
// unavailable at all) — either case falls back to the same "UTC" default as
// before rather than setting a value the picker can't actually show.
export function detectBrowserTimezone(): string {
  try {
    const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (detected && TIMEZONES.includes(detected)) return detected;
  } catch {
    // Fall through to the UTC default below.
  }
  return "UTC";
}

export function parseHourMinute(value: string): { hour: number; minute: number } | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return { hour, minute };
}
