import { describe, expect, it } from "vitest";
import { parseRecipientImportText, splitCells } from "./recipient-import";

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

// #288: spreadsheet exports, with a heading row and other columns.
describe("parseRecipientImportText with a heading row", () => {
  it("reads columns by their headings, in any order, ignoring the rest", () => {
    const result = parseRecipientImportText(
      "﻿Full Name,Phone,E-mail Address\n\"Smith, Jane\",555,jane@example.com\nBob,,bob@example.com\nNo email,1,\n",
    );
    expect(result.rows).toEqual([
      { email: "jane@example.com", displayName: "Smith, Jane" },
      { email: "bob@example.com", displayName: "Bob" },
    ]);
    expect(result.unparsedLines).toEqual(["No email,1,"]);
  });

  it("reads a tab-separated paste from a spreadsheet", () => {
    const result = parseRecipientImportText("Email\tName\na@example.com\tAlice");
    expect(result.rows).toEqual([{ email: "a@example.com", displayName: "Alice" }]);
  });

  it("keeps a quoted name with a comma whole without a heading row too", () => {
    const result = parseRecipientImportText('"Smith, Jane",jane@example.com');
    expect(result.rows).toEqual([{ email: "jane@example.com", displayName: "Smith, Jane" }]);
  });
});

describe("splitCells", () => {
  it("splits on commas, semicolons and tabs, honouring quotes", () => {
    expect(splitCells('a, "b, c";d\t"say ""hi"""')).toEqual(["a", "b, c", "d", 'say "hi"']);
  });
});

describe("parseRecipientImportText with a Group column (#288)", () => {
  it("reads several groups per person, separated by semicolons", () => {
    const result = parseRecipientImportText("email,name,groups\na@example.com,Ann,Family;Book club\nb@example.com,,\nc@example.com,Cy, Friends | Family ");
    expect(result.rows).toEqual([
      { email: "a@example.com", displayName: "Ann", groups: ["Family", "Book club"] },
      { email: "b@example.com" },
      { email: "c@example.com", displayName: "Cy", groups: ["Friends", "Family"] },
    ]);
  });

  it("uses commas between groups in a file separated by semicolons", () => {
    const result = parseRecipientImportText("Email;Group\na@example.com;Family, Friends");
    expect(result.rows).toEqual([{ email: "a@example.com", groups: ["Family", "Friends"] }]);
  });
});
