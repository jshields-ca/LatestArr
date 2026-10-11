import type { NewItem } from "@latestarr/adapter-core";
import { formatDate, formatPeriod, formatShortDate, monthAndYear } from "./dates.js";
import { kindCounts } from "./mjml-template.js";

// A newsletter's subject line, with {variables} filled in on each send
// (#267). Deliberately not Handlebars: a subject is a plain-text header, so
// there's no HTML escaping and no template errors to reach an inbox. Only
// a known variable in braces is replaced; anything else is left as typed.

export const SUBJECT_VARIABLES = ["newsletter", "date", "shortDate", "period", "month", "year", "count", "counts"] as const;
export type SubjectVariable = (typeof SUBJECT_VARIABLES)[number];

export const MAX_SUBJECT_LENGTH = 200;

const VARIABLE_PATTERN = /\{([A-Za-z]+)\}/g;
const KNOWN = new Set<string>(SUBJECT_VARIABLES);

/** The {names} in a subject that aren't variables, e.g. a typo like {dat}. */
export function unknownSubjectVariables(template: string): string[] {
  const unknown = new Set<string>();
  for (const [, name] of template.matchAll(VARIABLE_PATTERN)) {
    if (!KNOWN.has(name!)) unknown.add(name!);
  }
  return [...unknown];
}

export interface SubjectContext {
  newsletterName: string;
  generatedAt: Date;
  lookbackDays: number;
  /** The newsletter's timezone, so dates match the email's. */
  timeZone?: string;
  /** What's new in this issue. */
  items: NewItem[];
}

// Line breaks and other control characters could add email headers, so
// they become spaces.
function clean(text: string): string {
  // eslint-disable-next-line no-control-regex -- removing control characters is the point
  const plain = text.replace(/[\u0000-\u001f\u007f]+/g, " ").replace(/\s+/g, " ").trim();
  return plain.length > MAX_SUBJECT_LENGTH ? `${plain.slice(0, MAX_SUBJECT_LENGTH - 1).trimEnd()}…` : plain;
}

/**
 * The subject for one send. A blank template uses the newsletter's name,
 * as before. With nothing new, a subject built around {count} or {counts}
 * would read "0 new", so it becomes "<name>: nothing new" instead (a send
 * with nothing new is usually skipped anyway).
 */
export function renderSubject(template: string | null | undefined, context: SubjectContext): string {
  const source = template?.trim() || context.newsletterName;
  const usesCounts = /\{counts?\}/.test(source);
  if (usesCounts && context.items.length === 0) return clean(`${context.newsletterName}: nothing new`);

  const { month, year } = monthAndYear(context.generatedAt, context.timeZone);
  const values: Record<SubjectVariable, () => string> = {
    newsletter: () => context.newsletterName,
    date: () => formatDate(context.generatedAt, context.timeZone),
    shortDate: () => formatShortDate(context.generatedAt, context.timeZone),
    period: () => formatPeriod(context.generatedAt, context.lookbackDays, context.timeZone),
    month: () => month,
    year: () => year,
    count: () => String(context.items.length),
    counts: () => kindCounts(context.items).join(", "),
  };
  return clean(
    source.replace(VARIABLE_PATTERN, (match, name: string) =>
      KNOWN.has(name) ? values[name as SubjectVariable]() : match,
    ),
  );
}
