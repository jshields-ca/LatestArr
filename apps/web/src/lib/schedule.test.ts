import { describe, expect, it } from "vitest";
import {
  formatHourMinute,
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
