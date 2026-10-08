// Sorting and searching people's names the way people expect: numbers
// before letters, "Item 2" before "Item 10", and capitals and accents not
// mattering ("émile" sorts and matches with "Emile").

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });

export function compareText(a: string, b: string): number {
  return collator.compare(a, b);
}

/** Lower-cased with accents removed, for "contains" matching. */
export function foldForSearch(text: string): string {
  return text.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
}

/** Whether any of `fields` contains `query`, ignoring case and accents. */
export function matchesSearch(query: string, ...fields: (string | null | undefined)[]): boolean {
  const q = foldForSearch(query.trim());
  if (!q) return true;
  return fields.some((field) => field && foldForSearch(field).includes(q));
}
