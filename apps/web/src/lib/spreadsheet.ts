// Reads the first sheet of an .xlsx file into the same text the import box
// takes (#288): one line per row, cells separated by tabs, as if pasted
// from a spreadsheet. It's read in the browser, so the server never parses
// a spreadsheet. read-excel-file never runs formulas (it reads the values
// the spreadsheet app saved) and refuses the old binary .xls format, and is
// loaded only when a spreadsheet is chosen.

export const MAX_SPREADSHEET_BYTES = 5 * 1024 * 1024;
// The server takes up to 1000 rows per import, plus a heading row.
export const MAX_SPREADSHEET_ROWS = 1001;

export class SpreadsheetError extends Error {}

export function isSpreadsheet(file: File): boolean {
  return (
    file.name.toLowerCase().endsWith(".xlsx") ||
    file.type === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  );
}

function cellText(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  // A line break inside a cell would start a new row.
  return String(value).replace(/\s*[\r\n]+\s*/g, " ").trim();
}

// Quoted when it holds a separator or a quote, so splitCells keeps it whole.
function quoteCell(text: string): string {
  return /[\t,;"]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function sheetToText(rows: unknown[][]): string {
  return rows
    .map((row) => row.map((cell) => quoteCell(cellText(cell))))
    .filter((cells) => cells.some(Boolean))
    .map((cells) => cells.join("\t"))
    .join("\n");
}

export async function readSpreadsheetAsText(file: File): Promise<string> {
  if (file.size > MAX_SPREADSHEET_BYTES) {
    throw new SpreadsheetError("Spreadsheets can be up to 5 MB. Try saving just the columns you need, or as CSV.");
  }
  const { readSheet, InvalidInputError } = await import("read-excel-file/browser");
  let rows: unknown[][];
  try {
    rows = await readSheet(file);
  } catch (err) {
    if (err instanceof InvalidInputError && err.code === "XLS_FILE_NOT_SUPPORTED") {
      throw new SpreadsheetError("Older .xls files aren't supported. Save it as .xlsx or CSV and try again.");
    }
    throw new SpreadsheetError("That spreadsheet couldn't be read. Try saving it again as .xlsx or CSV.");
  }
  if (rows.length > MAX_SPREADSHEET_ROWS) {
    throw new SpreadsheetError("An import can add up to 1000 people. Split the spreadsheet into smaller ones.");
  }
  return sheetToText(rows);
}
