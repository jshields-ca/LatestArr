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
});
