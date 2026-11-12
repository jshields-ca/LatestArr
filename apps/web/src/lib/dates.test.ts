import { describe, expect, it } from "vitest";

import { formatDate, formatDateTime, formatExactDateTime } from "./dates";

describe("dates", () => {
  const now = new Date(2026, 10, 12, 10, 0, 0);
  const thisYear = new Date(2026, 10, 8, 21, 46, 50);

  it("writes a date and time with the weekday, no seconds, and no year for this year", () => {
    const text = formatDateTime(thisYear, now);
    expect(text).toContain("Nov");
    expect(text).toContain("8");
    expect(text).toMatch(/Sun/);
    expect(text).toMatch(/9:46/);
    expect(text).not.toMatch(/:50/);
    expect(text).not.toContain("2026");
  });

  it("adds the year when it isn't this one", () => {
    expect(formatDateTime(new Date(2025, 11, 31, 8, 5), now)).toContain("2025");
  });

  it("takes ISO strings as well as dates", () => {
    expect(formatDateTime(thisYear.toISOString(), now)).toBe(formatDateTime(thisYear, now));
  });

  it("writes the exact time to the second, for tooltips", () => {
    expect(formatExactDateTime(thisYear)).toMatch(/9:46:50/);
    expect(formatExactDateTime(thisYear)).toContain("2026");
  });

  it("writes a date with no time", () => {
    const text = formatDate(thisYear);
    expect(text).toContain("2026");
    expect(text).not.toMatch(/\d:\d\d/);
  });
});
