import { describe, expect, it } from "vitest";
import { parseRecipientImportText } from "./recipient-import";

describe("parseRecipientImportText", () => {
  it("parses one bare email per line", () => {
    const result = parseRecipientImportText("a@example.com\nb@example.com");
    expect(result.rows).toEqual([{ email: "a@example.com" }, { email: "b@example.com" }]);
    expect(result.unparsedLines).toEqual([]);
  });

  it("parses email,Name and Name,email CSV-style pairs", () => {
    const result = parseRecipientImportText("a@example.com,Alice\nBob,b@example.com");
    expect(result.rows).toEqual([
      { email: "a@example.com", displayName: "Alice" },
      { email: "b@example.com", displayName: "Bob" },
    ]);
  });

  it("parses Name <email> mailto-style entries", () => {
    const result = parseRecipientImportText('Alice Smith <a@example.com>\n"Bob" <b@example.com>');
    expect(result.rows).toEqual([
      { email: "a@example.com", displayName: "Alice Smith" },
      { email: "b@example.com", displayName: "Bob" },
    ]);
  });

  it("splits a flat comma/semicolon list of addresses into separate rows", () => {
    const result = parseRecipientImportText("a@example.com, b@example.com; c@example.com");
    expect(result.rows).toEqual([
      { email: "a@example.com" },
      { email: "b@example.com" },
      { email: "c@example.com" },
    ]);
  });

  it("skips a recognized email,name or name,email header row", () => {
    const result = parseRecipientImportText("email,name\na@example.com,Alice");
    expect(result.rows).toEqual([{ email: "a@example.com", displayName: "Alice" }]);
    expect(result.unparsedLines).toEqual([]);
  });

  it("collects unparseable lines instead of silently dropping them", () => {
    const result = parseRecipientImportText("a@example.com\nnot an email at all\n,,,");
    expect(result.rows).toEqual([{ email: "a@example.com" }]);
    expect(result.unparsedLines).toEqual(["not an email at all"]);
  });

  it("ignores blank lines", () => {
    const result = parseRecipientImportText("a@example.com\n\n\n   \nb@example.com");
    expect(result.rows).toHaveLength(2);
  });

  it("returns nothing for empty input", () => {
    const result = parseRecipientImportText("");
    expect(result.rows).toEqual([]);
    expect(result.unparsedLines).toEqual([]);
  });
});
