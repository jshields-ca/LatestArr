// One way to write dates across the app (#332), in the viewer's own locale.

type DateInput = string | number | Date;

/**
 * A date and time for reading at a glance: "Sun, Nov 8, 9:46 PM". No
 * seconds, and the year only when it isn't this one.
 */
export function formatDateTime(value: DateInput, now: Date = new Date()): string {
  const date = new Date(value);
  return date.toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    ...(date.getFullYear() === now.getFullYear() ? {} : { year: "numeric" }),
    hour: "numeric",
    minute: "2-digit",
  });
}

/** The same moment in full, to the second and with its time zone, for a tooltip. */
export function formatExactDateTime(value: DateInput): string {
  return new Date(value).toLocaleString(undefined, { dateStyle: "full", timeStyle: "long" });
}

/**
 * A day on its own, for a heading over that day's entries (#454): "Today",
 * "Yesterday", then "Saturday, November 14", with the year only when it
 * isn't this one.
 */
export function formatDay(value: DateInput, now: Date = new Date()): string {
  const date = new Date(value);
  const startOf = (day: Date) => new Date(day.getFullYear(), day.getMonth(), day.getDate()).getTime();
  // Rounded, as a day around a clock change is 23 or 25 hours long.
  const daysAgo = Math.round((startOf(now) - startOf(date)) / 86_400_000);
  if (daysAgo === 0) return "Today";
  if (daysAgo === 1) return "Yesterday";
  return date.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    ...(date.getFullYear() === now.getFullYear() ? {} : { year: "numeric" }),
  });
}

/** Whether two moments fall on the same day, where the viewer is. */
export function isSameDay(a: DateInput, b: DateInput): boolean {
  return new Date(a).toDateString() === new Date(b).toDateString();
}

/** A date with no time: "Nov 8, 2026". */
export function formatDate(value: DateInput): string {
  return new Date(value).toLocaleDateString(undefined, { dateStyle: "medium" });
}
