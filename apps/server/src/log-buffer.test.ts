import { afterEach, describe, expect, it } from "vitest";
import { clearLogBuffer, getRecentLogs, logBufferStream } from "./log-buffer.js";

function write(entry: Record<string, unknown>): void {
  logBufferStream.write(JSON.stringify(entry) + "\n");
}

afterEach(() => {
  clearLogBuffer();
});

describe("logBufferStream / getRecentLogs", () => {
  it("captures a written JSON line", () => {
    write({ time: 1, level: 50, msg: "Newsletter send failed" });
    expect(getRecentLogs()).toEqual([{ time: 1, level: 50, msg: "Newsletter send failed" }]);
  });

  it("drops Fastify's routine per-request log messages", () => {
    write({ time: 1, level: 30, msg: "incoming request" });
    write({ time: 2, level: 30, msg: "request completed" });
    write({ time: 3, level: 50, msg: "Something actually worth seeing" });
    expect(getRecentLogs()).toHaveLength(1);
    expect(getRecentLogs()[0]?.msg).toBe("Something actually worth seeing");
  });

  it("returns most-recent-first", () => {
    write({ time: 1, level: 30, msg: "first" });
    write({ time: 2, level: 30, msg: "second" });
    expect(getRecentLogs().map((e) => e.msg)).toEqual(["second", "first"]);
  });

  it("caps the buffer at its max size, dropping the oldest entries", () => {
    for (let i = 0; i < 510; i++) {
      write({ time: i, level: 30, msg: `entry-${i}` });
    }
    const all = getRecentLogs(600);
    expect(all).toHaveLength(500);
    // Newest entries are kept, oldest ones fell off the front.
    expect(all[0]?.msg).toBe("entry-509");
    expect(all.at(-1)?.msg).toBe("entry-10");
  });

  it("respects the limit parameter", () => {
    write({ time: 1, level: 30, msg: "a" });
    write({ time: 2, level: 30, msg: "b" });
    write({ time: 3, level: 30, msg: "c" });
    expect(getRecentLogs(2).map((e) => e.msg)).toEqual(["c", "b"]);
  });

  it("ignores a malformed line instead of throwing", () => {
    expect(() => logBufferStream.write("not json\n")).not.toThrow();
    expect(getRecentLogs()).toEqual([]);
  });
});
