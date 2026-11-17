import { describe, expect, it } from "vitest";

import { formatDate, formatDateTime, formatDay, formatExactDateTime, isSameDay } from "./dates";

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

  // #454: the Logs page's line between days.
  it("names a day: Today, Yesterday, then the weekday and date", () => {
    expect(formatDay(new Date(2026, 10, 12, 0, 0, 1), now)).toBe("Today");
    expect(formatDay(new Date(2026, 10, 11, 23, 59), now)).toBe("Yesterday");
    expect(formatDay(new Date(2026, 10, 11, 0, 0), now)).toBe("Yesterday");
    const older = formatDay(thisYear, now);
    expect(older).toMatch(/Sunday/);
    expect(older).toMatch(/November/);
    expect(older).toContain("8");
    expect(older).not.toContain("2026");
    expect(formatDay(new Date(2025, 11, 31), now)).toContain("2025");
  });

  it("counts days by the calendar, not by 24 hours", () => {
    // An hour ago, across midnight, is Yesterday, and so is 47 hours ago.
    expect(formatDay(new Date(2026, 10, 11, 23, 30), new Date(2026, 10, 12, 0, 30))).toBe("Yesterday");
    expect(formatDay(new Date(2026, 10, 11, 0, 30), new Date(2026, 10, 12, 23, 30))).toBe("Yesterday");
    expect(formatDay(new Date(2026, 10, 10, 23, 30), new Date(2026, 10, 12, 0, 30))).not.toBe("Yesterday");
  });

  it("tells whether two moments are on the same day", () => {
    expect(isSameDay(new Date(2026, 10, 12, 0, 0), new Date(2026, 10, 12, 23, 59))).toBe(true);
    expect(isSameDay(new Date(2026, 10, 12, 0, 0), new Date(2026, 10, 11, 23, 59))).toBe(false);
    expect(isSameDay(new Date(2026, 10, 12), new Date(2025, 10, 12))).toBe(false);
  });

  it("writes a date with no time", () => {
    const text = formatDate(thisYear);
    expect(text).toContain("2026");
    expect(text).not.toMatch(/\d:\d\d/);
  });
});
