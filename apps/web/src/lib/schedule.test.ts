import { afterEach, describe, expect, it, vi } from "vitest";
import {
  describeScheduleParts,
  detectBrowserTimezone,
  formatHourMinute,
  formatScheduleForDisplay,
  parseCronToSimpleSchedule,
  parseHourMinute,
  simpleScheduleToCron,
  TIMEZONES,
} from "./schedule";

describe("simpleScheduleToCron", () => {
  it("builds a daily cron expression", () => {
    expect(
      simpleScheduleToCron({ frequency: "daily", hour: 8, minute: 30, dayOfWeek: 1, dayOfMonth: 1 }),
    ).toBe("30 8 * * *");
  });

  it("builds a weekly cron expression", () => {
    expect(
      simpleScheduleToCron({ frequency: "weekly", hour: 9, minute: 0, dayOfWeek: 2, dayOfMonth: 1 }),
    ).toBe("0 9 * * 2");
  });

  it("builds a monthly cron expression", () => {
    expect(
      simpleScheduleToCron({ frequency: "monthly", hour: 7, minute: 15, dayOfWeek: 1, dayOfMonth: 15 }),
    ).toBe("15 7 15 * *");
  });
});

describe("parseCronToSimpleSchedule", () => {
  it("round-trips a daily schedule", () => {
    const schedule = { frequency: "daily" as const, hour: 8, minute: 30, dayOfWeek: 1, dayOfMonth: 1 };
    expect(parseCronToSimpleSchedule(simpleScheduleToCron(schedule))).toEqual(schedule);
  });

  it("round-trips a weekly schedule", () => {
    const schedule = { frequency: "weekly" as const, hour: 9, minute: 0, dayOfWeek: 5, dayOfMonth: 1 };
    expect(parseCronToSimpleSchedule(simpleScheduleToCron(schedule))).toEqual(schedule);
  });

  it("round-trips a monthly schedule", () => {
    const schedule = { frequency: "monthly" as const, hour: 7, minute: 15, dayOfWeek: 1, dayOfMonth: 15 };
    expect(parseCronToSimpleSchedule(simpleScheduleToCron(schedule))).toEqual(schedule);
  });

  it("returns null for a cron pattern with both day-of-month and day-of-week set", () => {
    expect(parseCronToSimpleSchedule("0 8 15 * 2")).toBeNull();
  });

  it("returns null for a cron pattern with a non-wildcard month", () => {
    expect(parseCronToSimpleSchedule("0 8 1 6 *")).toBeNull();
  });

  it("returns null for a malformed cron string", () => {
    expect(parseCronToSimpleSchedule("not a cron")).toBeNull();
    expect(parseCronToSimpleSchedule("0 8 * *")).toBeNull();
    expect(parseCronToSimpleSchedule("60 8 * * *")).toBeNull();
    expect(parseCronToSimpleSchedule("0 25 * * *")).toBeNull();
  });

  it("returns null for a day-of-month outside the safe 1-28 range", () => {
    expect(parseCronToSimpleSchedule("0 8 30 * *")).toBeNull();
  });
});

describe("formatHourMinute / parseHourMinute", () => {
  it("formats and parses back to the same value", () => {
    expect(formatHourMinute(8, 5)).toBe("08:05");
    expect(parseHourMinute("08:05")).toEqual({ hour: 8, minute: 5 });
  });

  it("rejects an invalid time string", () => {
    expect(parseHourMinute("nonsense")).toBeNull();
    expect(parseHourMinute("25:00")).toBeNull();
    expect(parseHourMinute("12:60")).toBeNull();
  });
});

describe("TIMEZONES", () => {
  it("includes UTC and a real IANA zone, sorted", () => {
    expect(TIMEZONES[0]).toBe("UTC");
    expect(TIMEZONES).toContain("America/Winnipeg");
    expect(TIMEZONES.length).toBeGreaterThan(300);
  });
});

describe("formatScheduleForDisplay", () => {
  it("formats a daily schedule", () => {
    expect(formatScheduleForDisplay("30 8 * * *", "UTC")).toBe("Daily at 8:30 AM (UTC)");
  });

  it("formats a weekly schedule with the day name", () => {
    expect(formatScheduleForDisplay("0 8 * * 1", "UTC")).toBe("Weekly on Monday at 8:00 AM (UTC)");
  });

  it("formats a monthly schedule with an ordinal day", () => {
    expect(formatScheduleForDisplay("0 8 15 * *", "UTC")).toBe("Monthly on the 15th at 8:00 AM (UTC)");
  });

  it("uses the right ordinal suffix for 1st/2nd/3rd/4th/11th/21st", () => {
    expect(formatScheduleForDisplay("0 8 1 * *", "UTC")).toContain("the 1st");
    expect(formatScheduleForDisplay("0 8 2 * *", "UTC")).toContain("the 2nd");
    expect(formatScheduleForDisplay("0 8 3 * *", "UTC")).toContain("the 3rd");
    expect(formatScheduleForDisplay("0 8 4 * *", "UTC")).toContain("the 4th");
    expect(formatScheduleForDisplay("0 8 11 * *", "UTC")).toContain("the 11th");
    expect(formatScheduleForDisplay("0 8 21 * *", "UTC")).toContain("the 21st");
  });

  it("uses PM and 12-hour wraparound correctly", () => {
    expect(formatScheduleForDisplay("0 0 * * *", "UTC")).toBe("Daily at 12:00 AM (UTC)");
    expect(formatScheduleForDisplay("0 12 * * *", "UTC")).toBe("Daily at 12:00 PM (UTC)");
    expect(formatScheduleForDisplay("0 13 * * *", "UTC")).toBe("Daily at 1:00 PM (UTC)");
  });

  it("appends a non-UTC timezone the same way the raw display used to", () => {
    expect(formatScheduleForDisplay("0 8 * * 1", "America/Winnipeg")).toBe(
      "Weekly on Monday at 8:00 AM (America/Winnipeg)",
    );
  });

  it("falls back to the raw cron string for a schedule the simple picker can't express", () => {
    expect(formatScheduleForDisplay("*/15 * * * *", "UTC")).toBe("*/15 * * * * (UTC)");
  });
});

describe("describeScheduleParts", () => {
  it("splits a daily schedule into frequency and time", () => {
    expect(describeScheduleParts("30 8 * * *", "UTC")).toEqual({
      frequency: "Daily",
      when: "8:30 AM",
      timezone: "UTC",
    });
  });

  it("splits a weekly schedule into frequency and 'day, time'", () => {
    expect(describeScheduleParts("0 8 * * 1", "America/Winnipeg")).toEqual({
      frequency: "Weekly",
      when: "Monday, 8:00 AM",
      timezone: "America/Winnipeg",
    });
  });

  it("splits a monthly schedule into frequency and 'the Nth, time'", () => {
    expect(describeScheduleParts("0 8 15 * *", "UTC")).toEqual({
      frequency: "Monthly",
      when: "the 15th, 8:00 AM",
      timezone: "UTC",
    });
  });

  it("labels an unrecognized cron as Custom and keeps the raw expression", () => {
    expect(describeScheduleParts("*/15 * * * *", "UTC")).toEqual({
      frequency: "Custom",
      when: "*/15 * * * *",
      timezone: "UTC",
    });
  });
});

describe("detectBrowserTimezone", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns the browser's detected zone when it's a recognized timezone", () => {
    vi.spyOn(Intl, "DateTimeFormat").mockImplementation(
      () => ({ resolvedOptions: () => ({ timeZone: "America/Winnipeg" }) }) as unknown as Intl.DateTimeFormat,
    );
    expect(detectBrowserTimezone()).toBe("America/Winnipeg");
  });

  it("falls back to UTC when the detected zone isn't in the TIMEZONES list", () => {
    vi.spyOn(Intl, "DateTimeFormat").mockImplementation(
      () => ({ resolvedOptions: () => ({ timeZone: "Not/AZone" }) }) as unknown as Intl.DateTimeFormat,
    );
    expect(detectBrowserTimezone()).toBe("UTC");
  });

  it("falls back to UTC when Intl.DateTimeFormat throws", () => {
    vi.spyOn(Intl, "DateTimeFormat").mockImplementation(() => {
      throw new Error("not available");
    });
    expect(detectBrowserTimezone()).toBe("UTC");
  });
});
