// Subject variables (#267). Mirrors apps/server/src/render/subject.ts and
// render/dates.ts, which fill them in when sending: keep the two in step.
// Used here to flag typos as you type and to preview the next subject.

export const SUBJECT_VARIABLES: { name: string; description: string }[] = [
  { name: "newsletter", description: "The newsletter's name" },
  { name: "date", description: "The send date: September 29, 2026" },
  { name: "shortDate", description: "The send date, short: Sep 29" },
  { name: "period", description: "The lookback window: Sep 22 – 29, 2026" },
  { name: "month", description: "The month: September" },
  { name: "year", description: "The year: 2026" },
  { name: "count", description: "How many items are new: 12" },
  { name: "counts", description: "New items by type: 8 movies, 4 episodes" },
];

export const MAX_SUBJECT_LENGTH = 200;

const VARIABLE_PATTERN = /\{([A-Za-z]+)\}/g;
const KNOWN = new Set(SUBJECT_VARIABLES.map((variable) => variable.name));

export function unknownSubjectVariables(template: string): string[] {
  const unknown = new Set<string>();
  for (const [, name] of template.matchAll(VARIABLE_PATTERN)) {
    if (!KNOWN.has(name!)) unknown.add(name!);
  }
  return [...unknown];
}

/** What's wrong with a subject, as the server would refuse it. */
export function subjectProblem(template: string): string | null {
  if (template.length > MAX_SUBJECT_LENGTH) return `Keep the subject under ${MAX_SUBJECT_LENGTH} characters.`;
  const unknown = unknownSubjectVariables(template);
  if (unknown.length === 0) return null;
  const names = unknown.map((name) => `{${name}}`).join(", ");
  return `${names} ${unknown.length === 1 ? "isn't a variable" : "aren't variables"}. Pick one from the list.`;
}

function safeTimeZone(timeZone: string): string | undefined {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone });
    return timeZone;
  } catch {
    return undefined;
  }
}

function parts(date: Date, timeZone?: string) {
  const format = (options: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("en-US", { ...options, timeZone }).format(date);
  return {
    year: Number(format({ year: "numeric" })),
    month: Number(format({ month: "numeric" })),
    day: Number(format({ day: "numeric" })),
    monthShort: format({ month: "short" }),
    monthLong: format({ month: "long" }),
  };
}

/**
 * The subject a send right now would get, with example counts (the real
 * ones depend on what's new when it sends). Null for a blank subject.
 */
export function previewSubject(
  template: string,
  { name, timeZone, lookbackDays, now = new Date() }: { name: string; timeZone: string; lookbackDays: number; now?: Date },
): string | null {
  if (!template.trim()) return null;
  const zone = safeTimeZone(timeZone);
  const today = parts(now, zone);
  const days = Number.isInteger(lookbackDays) && lookbackDays > 0 ? lookbackDays : 7;
  const start = parts(new Date(now.getTime() - days * 24 * 60 * 60 * 1000), zone);
  const period =
    start.year !== today.year
      ? `${start.monthShort} ${start.day}, ${start.year} – ${today.monthShort} ${today.day}, ${today.year}`
      : `${start.monthShort} ${start.day} – ${start.month === today.month ? today.day : `${today.monthShort} ${today.day}`}, ${today.year}`;
  const values: Record<string, string> = {
    newsletter: name || "Your newsletter",
    date: `${today.monthLong} ${today.day}, ${today.year}`,
    shortDate: `${today.monthShort} ${today.day}`,
    period,
    month: today.monthLong,
    year: String(today.year),
    count: "12",
    counts: "8 movies, 4 episodes",
  };
  return template
    .replace(VARIABLE_PATTERN, (match, variable: string) => values[variable] ?? match)
    .replace(/\s+/g, " ")
    .trim();
}
