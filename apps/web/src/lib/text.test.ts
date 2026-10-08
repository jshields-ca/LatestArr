import { describe, expect, it } from "vitest";

import { compareText, matchesSearch } from "./text";

describe("compareText", () => {
  it("sorts numbers before letters, numerically, ignoring case and accents", () => {
    const names = ["zoe", "Émile", "10 Downing", "2 Fast", "adam", "Effuse"];
    expect([...names].sort(compareText)).toEqual(["2 Fast", "10 Downing", "adam", "Effuse", "Émile", "zoe"]);
  });
});

describe("matchesSearch", () => {
  it("matches any field anywhere in the text, ignoring case and accents", () => {
    expect(matchesSearch("effuse", "Effuse Gaming", "e@example.com")).toBe(true);
    expect(matchesSearch("emile", "Émile")).toBe(true);
    expect(matchesSearch("EXAMPLE.COM", null, "x@example.com")).toBe(true);
    expect(matchesSearch("nobody", "Effuse", "e@example.com")).toBe(false);
  });

  it("matches everything for an empty query", () => {
    expect(matchesSearch("  ", "anything")).toBe(true);
  });
});
