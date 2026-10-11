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
  /** From a Group column (#288): groups to add this person to. */
  groups?: string[];
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

type Delimiter = "," | ";" | "\t";
const ALL_DELIMITERS: Delimiter[] = [",", ";", "\t"];

// Splits one line into cells on commas, semicolons or tabs (a paste from a
// spreadsheet), or only on \`delimiters\` when given, keeping a quoted cell
// whole: "Smith, Jane" is one name. "" inside quotes is a literal quote.
export function splitCells(line: string, delimiters: Delimiter[] = ALL_DELIMITERS): string[] {
  const cells: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i]!;
    if (quoted) {
      if (char === '"' && line[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (char === '"') {
        quoted = false;
      } else {
        cell += char;
      }
    } else if (char === '"' && cell.trim() === "") {
      quoted = true;
      cell = "";
    } else if ((delimiters as string[]).includes(char)) {
      cells.push(cell.trim());
      cell = "";
    } else {
      cell += char;
    }
  }
  cells.push(cell.trim());
  return cells;
}

// The column headings an import understands (#288), ignoring case, spaces,
// dashes and underscores. Other columns are ignored.
export const EMAIL_HEADERS = ["Email", "E-mail", "Email address"];
export const NAME_HEADERS = ["Name", "Full name", "Display name"];
export const GROUP_HEADERS = ["Groups", "Group"];
const normalizeHeader = (value: string) => value.toLowerCase().replace(/[\s_-]+/g, "");
const EMAIL_KEYS = new Set([...EMAIL_HEADERS, "Mail"].map(normalizeHeader));
const NAME_KEYS = new Set(NAME_HEADERS.map(normalizeHeader));
const GROUP_KEYS = new Set(GROUP_HEADERS.map(normalizeHeader));

interface HeaderColumns {
  /** The file's own delimiter, so a cell like "Family;Friends" in a
   * comma-separated file stays one cell. */
  delimiter: Delimiter;
  email: number;
  name: number | null;
  groups: number | null;
}

// The delimiter a heading row uses: a tab (pasted from a spreadsheet),
// else a comma, else a semicolon.
function delimiterOf(line: string): Delimiter {
  if (line.includes("	")) return "	";
  return line.includes(",") ? "," : ";";
}

// Several groups in one cell are separated by semicolons (or a bar), or by
// commas in a file that is itself separated by semicolons.
function splitGroups(cell: string, delimiter: Delimiter): string[] {
  const separator = delimiter === ";" ? /[,|]/ : /[;|]/;
  return cell
    .split(separator)
    .map((group) => group.trim())
    .filter(Boolean);
}

// A first line naming an email column (and maybe a name column) is a
// heading row, and the lines after it are read by those columns.
function headerColumns(line: string): HeaderColumns | null {
  const delimiter = delimiterOf(line);
  const keys = splitCells(line, [delimiter]).map((cell) => normalizeHeader(stripQuotes(cell)));
  if (keys.some((key) => key.includes("@"))) return null;
  const email = keys.findIndex((key) => EMAIL_KEYS.has(key));
  if (email < 0) return null;
  const column = (names: Set<string>) => {
    const index = keys.findIndex((key) => names.has(key));
    return index < 0 ? null : index;
  };
  return { delimiter, email, name: column(NAME_KEYS), groups: column(GROUP_KEYS) };
}

function parseLine(trimmed: string): ParsedRecipientRow[] | null {
  const angleMatch = trimmed.match(NAME_EMAIL_RE);
  if (angleMatch) {
    const email = angleMatch[2]!.trim();
    if (!looksLikeEmail(email)) return null;
    const displayName = stripQuotes(angleMatch[1]!) || undefined;
    return [{ email, displayName }];
  }

  const parts = splitCells(trimmed)
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

  // A spreadsheet's CSV export can start with a byte-order mark.
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/);
  const firstLine = lines.findIndex((line) => line.trim());
  const columns = firstLine >= 0 ? headerColumns(lines[firstLine]!) : null;

  lines.forEach((rawLine, index) => {
    const trimmed = rawLine.trim();
    if (!trimmed) return;
    if (columns) {
      if (index === firstLine) return;
      const cells = splitCells(trimmed, [columns.delimiter]);
      const email = stripQuotes(cells[columns.email] ?? "");
      if (!looksLikeEmail(email)) {
        unparsedLines.push(trimmed);
        return;
      }
      const displayName = columns.name === null ? "" : stripQuotes(cells[columns.name] ?? "");
      const groups = columns.groups === null ? [] : splitGroups(cells[columns.groups] ?? "", columns.delimiter);
      rows.push({ email, ...(displayName && { displayName }), ...(groups.length > 0 && { groups }) });
      return;
    }

    const parsed = parseLine(trimmed);
    if (parsed === null) {
      unparsedLines.push(trimmed);
    } else {
      rows.push(...parsed);
    }
  });

  return { rows, unparsedLines };
}
