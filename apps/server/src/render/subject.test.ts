import type { NewItem } from "@latestarr/adapter-core";
import { describe, expect, it } from "vitest";
import { renderSubject, unknownSubjectVariables } from "./subject.js";

const item = (kind: NewItem["kind"], n: number): NewItem => ({
  id: `${kind}-${n}`,
  externalId: `${kind}-${n}`,
  kind,
  title: `${kind} ${n}`,
  addedAt: new Date("2026-09-27T12:00:00Z"),
});
const items = [item("movie", 1), item("tv_episode", 1), item("tv_episode", 2), item("tv_episode", 3)];
// 9 AM on Sep 29 in Vancouver is 16:00 UTC.
const context = {
  newsletterName: "Weekly Digest",
  generatedAt: new Date("2026-09-29T16:00:00Z"),
  lookbackDays: 7,
  timeZone: "America/Vancouver",
  items,
};

describe("renderSubject", () => {
  it("fills in every variable", () => {
    expect(
      renderSubject("{newsletter} | {date} | {shortDate} | {period} | {month} {year} | {count} new ({counts})", context),
    ).toBe("Weekly Digest | September 29, 2026 | Sep 29 | Sep 22 – 29, 2026 | September 2026 | 4 new (3 episodes, 1 movie)");
  });

  it("uses the newsletter's timezone for dates", () => {
    // 02:00 UTC on Oct 1 is still Sep 30 in Vancouver.
    const late = { ...context, generatedAt: new Date("2026-10-01T02:00:00Z") };
    expect(renderSubject("{date}", late)).toBe("September 30, 2026");
    expect(renderSubject("{date}", { ...late, timeZone: "UTC" })).toBe("October 1, 2026");
  });

  it("uses the name when there's no subject, and leaves other braces alone", () => {
    expect(renderSubject("", context)).toBe("Weekly Digest");
    expect(renderSubject(null, context)).toBe("Weekly Digest");
    expect(renderSubject("New {stuff} for {month}", context)).toBe("New {stuff} for September");
  });

  it("says nothing's new rather than 0 new", () => {
    expect(renderSubject("{count} new ({counts})", { ...context, items: [] })).toBe("Weekly Digest: nothing new");
    expect(renderSubject("The latest from {date}", { ...context, items: [] })).toBe("The latest from September 29, 2026");
  });

  it("keeps the subject to one plain line of a sensible length", () => {
    expect(renderSubject("Hello\r\nBcc: someone@example.com\t{newsletter}", context)).toBe(
      "Hello Bcc: someone@example.com Weekly Digest",
    );
    const long = renderSubject(`${"x".repeat(250)}`, context);
    expect(long).toHaveLength(200);
    expect(long.endsWith("…")).toBe(true);
    // A newsletter name with a line break can't sneak one in either.
    expect(renderSubject("{newsletter}", { ...context, newsletterName: "A\nB" })).toBe("A B");
  });
});

describe("unknownSubjectVariables", () => {
  it("lists names in braces that aren't variables", () => {
    expect(unknownSubjectVariables("{dat} and {date} and {Count} and {dat}")).toEqual(["dat", "Count"]);
    expect(unknownSubjectVariables("No variables here {}")).toEqual([]);
  });
});
