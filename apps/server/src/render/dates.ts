// Dates as newsletters show them, in the newsletter's own timezone when
// one is given (the server's otherwise), so the subject (subject.ts) and
// the email (mjml-template.ts) always agree.

interface DateParts {
  year: number;
  /** 1–12 */
  month: number;
  day: number;
  /** "Sep" */
  monthShort: string;
  /** "September" */
  monthLong: string;
}

function partsOf(date: Date, timeZone?: string): DateParts {
  const format = (options: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat("en-US", { ...options, timeZone }).format(date);
  return {
    year: Number(format({ year: "numeric" })),
    month: Number(format({ month: "numeric" })),
    day: Number(format({ day: "numeric" })),
    monthShort: format({ month: "short" }),
    monthLong: format({ month: "long" }),
  };
}

// An unknown timezone (a typo in an old setting) falls back to the server's.
function safeTimeZone(timeZone?: string): string | undefined {
  if (!timeZone) return undefined;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone });
    return timeZone;
  } catch {
    return undefined;
  }
}

/** "September 29, 2026" */
export function formatDate(date: Date, timeZone?: string): string {
  const p = partsOf(date, safeTimeZone(timeZone));
  return `${p.monthLong} ${p.day}, ${p.year}`;
}

/** "Sep 29" */
export function formatShortDate(date: Date, timeZone?: string): string {
  const p = partsOf(date, safeTimeZone(timeZone));
  return `${p.monthShort} ${p.day}`;
}

/** "September" and "2026" */
export function monthAndYear(date: Date, timeZone?: string): { month: string; year: string } {
  const p = partsOf(date, safeTimeZone(timeZone));
  return { month: p.monthLong, year: String(p.year) };
}

/** The lookback window ending at `end`: "Sep 21 – 28, 2026", "Aug 30 – Sep 5, 2026", or across years in full. */
export function formatPeriod(end: Date, days: number, timeZone?: string): string {
  const zone = safeTimeZone(timeZone);
  const start = partsOf(new Date(end.getTime() - days * 24 * 60 * 60 * 1000), zone);
  const last = partsOf(end, zone);
  if (start.year !== last.year) {
    return `${start.monthShort} ${start.day}, ${start.year} – ${last.monthShort} ${last.day}, ${last.year}`;
  }
  const endPart = start.month === last.month ? `${last.day}` : `${last.monthShort} ${last.day}`;
  return `${start.monthShort} ${start.day} – ${endPart}, ${last.year}`;
}
