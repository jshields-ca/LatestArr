// Parses a block of pasted text or an uploaded CSV's raw contents into
// recipient rows, tolerating the handful of formats people actually paste:
// one bare email per line, "email,Name" or "Name,email" CSV-style pairs,
// "Name <email>" mailto-style entries, and a single flat comma/semicolon
// list of addresses copied straight from a mail client's To field. Final
// validation authority is the server (POST /recipients/import) — this is
// just good-enough client-side parsing to build a review table before
// anything is submitted.

export interface ParsedRecipientRow {
  email: string;
  displayName?: string;
}

export interface ParseRecipientImportResult {
  rows: ParsedRecipientRow[];
  unparsedLines: string[];
}

const EMAIL_RE = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/;

function looksLikeEmail(value: string): boolean {
  return EMAIL_RE.test(value.trim());
}

// "Name <email@example.com>" — the format many mail clients and CSV
// exports produce when copying a list of people.
const NAME_EMAIL_RE = /^(.*)<([^<>]+)>$/;

function stripQuotes(value: string): string {
  return value.trim().replace(/^["']|["']$/g, "").trim();
}

function isLikelyHeaderRow(line: string): boolean {
  const normalized = line.toLowerCase().replace(/["']/g, "").trim();
  return (
    /^(email|e-mail)\s*[,;]\s*(name|display ?name)$/.test(normalized) ||
    /^(name|display ?name)\s*[,;]\s*(email|e-mail)$/.test(normalized)
  );
}

function parseLine(trimmed: string): ParsedRecipientRow[] | null {
  const angleMatch = trimmed.match(NAME_EMAIL_RE);
  if (angleMatch) {
    const email = angleMatch[2]!.trim();
    if (!looksLikeEmail(email)) return null;
    const displayName = stripQuotes(angleMatch[1]!) || undefined;
    return [{ email, displayName }];
  }

  const parts = trimmed
    .split(/[,;]/)
    .map((part) => stripQuotes(part))
    .filter(Boolean);

  if (parts.length === 1) {
    return looksLikeEmail(parts[0]!) ? [{ email: parts[0]! }] : null;
  }

  // Every part looks like an email on its own — a flat address list, not
  // a single "email, name" pair.
  if (parts.every(looksLikeEmail)) {
    return parts.map((email) => ({ email }));
  }

  // Exactly one part is an email and the rest form the display name —
  // covers both "email, Name" and "Name, email" ordering.
  const emailParts = parts.filter(looksLikeEmail);
  if (emailParts.length === 1) {
    const email = emailParts[0]!;
    const displayName = parts.filter((part) => part !== email).join(" ") || undefined;
    return [{ email, displayName }];
  }

  return null;
}

export function parseRecipientImportText(text: string): ParseRecipientImportResult {
  const rows: ParsedRecipientRow[] = [];
  const unparsedLines: string[] = [];

  const lines = text.split(/\r?\n/);
  lines.forEach((rawLine, index) => {
    const trimmed = rawLine.trim();
    if (!trimmed) return;
    if (index === 0 && isLikelyHeaderRow(trimmed)) return;

    const parsed = parseLine(trimmed);
    if (parsed === null) {
      unparsedLines.push(trimmed);
    } else {
      rows.push(...parsed);
    }
  });

  return { rows, unparsedLines };
}
