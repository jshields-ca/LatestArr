import { describe, expect, it } from "vitest";

import { parseRecipientImportText } from "./recipient-import";
import { sheetToText } from "./spreadsheet";

describe("sheetToText", () => {
  it("turns a sheet into text the import reads like a spreadsheet paste", () => {
    const text = sheetToText([
      ["Email", "Full name", "Groups", "Joined"],
      ["jane@example.com", "Smith, Jane", "Family;Book club", new Date("2026-01-02T00:00:00Z")],
      [null, null, null, null],
      ["bo@example.com", 'Bo "B" Lee\nJr', null, 42],
    ]);
    expect(parseRecipientImportText(text).rows).toEqual([
      { email: "jane@example.com", displayName: "Smith, Jane", groups: ["Family", "Book club"] },
      { email: "bo@example.com", displayName: 'Bo "B" Lee Jr' },
    ]);
  });
});
