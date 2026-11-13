import { describe, expect, it } from "vitest";

import { previewSubject, subjectProblem } from "./subject";

describe("subjectProblem", () => {
  it("flags names in braces that aren't variables", () => {
    expect(subjectProblem("The latest from {date}")).toBeNull();
    expect(subjectProblem("The latest from {dat}")).toBe("{dat} isn't a variable. Pick one from the list.");
    expect(subjectProblem("x".repeat(201))).toMatch(/under 200 characters/);
  });
});

describe("previewSubject", () => {
  it("fills in the variables like a send would, in the newsletter's timezone", () => {
    // 02:00 UTC on Oct 1 is still Sep 30 in Vancouver.
    const now = new Date("2026-10-01T02:00:00Z");
    expect(
      previewSubject("{newsletter}: {period} ({count} new, {counts}) {shortDate} {nope}", {
        name: "Weekly Digest",
        timeZone: "America/Vancouver",
        lookbackDays: 7,
        now,
      }),
    ).toBe("Weekly Digest: Sep 23 – 30, 2026 (12 new, 8 movies, 4 episodes) Sep 30 {nope}");
    expect(previewSubject("  ", { name: "x", timeZone: "UTC", lookbackDays: 7 })).toBeNull();
  });

  // #390: as the server writes them for a design that puts the day first.
  it("puts the day first when the newsletter's design does", () => {
    const options = { name: "Weekly Digest", timeZone: "UTC", lookbackDays: 7, dateOrder: "dayFirst" as const };
    expect(previewSubject("{date} | {shortDate} | {period}", { ...options, now: new Date("2026-09-29T12:00:00Z") })).toBe(
      "29 September 2026 | 29 Sep | 22 – 29 Sep 2026",
    );
    expect(previewSubject("{period}", { ...options, now: new Date("2026-10-03T12:00:00Z") })).toBe("26 Sep – 3 Oct 2026");
    expect(previewSubject("{period}", { ...options, now: new Date("2027-01-03T12:00:00Z") })).toBe("27 Dec 2026 – 3 Jan 2027");
  });
});
