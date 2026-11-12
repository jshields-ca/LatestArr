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

/** A date with no time: "Nov 8, 2026". */
export function formatDate(value: DateInput): string {
  return new Date(value).toLocaleDateString(undefined, { dateStyle: "medium" });
}
