import { describe, expect, it, vi } from "vitest";
import { MAX_RECENT_ITEMS, RECENT_PAGE_SIZE, readNewest } from "./paging.js";

// A source with `total` items, newest first: item n was added n hours
// before `now`.
const now = new Date("2026-10-17T12:00:00Z");
const hoursAgo = (n: number) => new Date(now.getTime() - n * 3_600_000);
function source(total: number) {
  const all = Array.from({ length: total }, (_, n) => ({ id: `i${n}`, added: hoursAgo(n) }));
  const fetchPage = vi.fn(async (offset: number, size: number) => all.slice(offset, offset + size));
  return { all, fetchPage };
}
const read = (fetchPage: (offset: number, size: number) => Promise<{ id: string; added: Date }[]>, since: Date, limit?: number) =>
  readNewest({ fetchPage, addedAt: (item) => item.added, key: (item) => item.id, since, limit });

describe("readNewest", () => {
  it("reads past one page until items are older than the window", async () => {
    const { fetchPage } = source(1000);
    // 250 items in the last 250 hours; the page that reaches older ones is the last.
    const items = await read(fetchPage, hoursAgo(249.5));
    expect(fetchPage).toHaveBeenCalledTimes(3);
    expect(items).toHaveLength(300);
    expect(items.filter((item) => item.added >= hoursAgo(249.5))).toHaveLength(250);
  });

  it("stops at a short page", async () => {
    const { fetchPage } = source(130);
    expect(await read(fetchPage, hoursAgo(10_000))).toHaveLength(130);
    expect(fetchPage).toHaveBeenCalledTimes(2);
  });

  it("stops at the safety cap", async () => {
    const { fetchPage } = source(MAX_RECENT_ITEMS + 500);
    const items = await read(fetchPage, hoursAgo(100_000));
    expect(items).toHaveLength(MAX_RECENT_ITEMS);
    expect(fetchPage).toHaveBeenCalledTimes(MAX_RECENT_ITEMS / RECENT_PAGE_SIZE);
  });

  it("reads a fixed number when given a limit", async () => {
    const { fetchPage } = source(500);
    expect(await read(fetchPage, hoursAgo(100_000), 25)).toHaveLength(25);
    expect(fetchPage).toHaveBeenCalledWith(0, 25);
    expect(fetchPage).toHaveBeenCalledTimes(1);
  });

  it("stops when a source ignores paging and repeats a page", async () => {
    const { all } = source(100);
    const fetchPage = vi.fn(async () => all);
    expect(await read(fetchPage, hoursAgo(100_000))).toHaveLength(100);
    expect(fetchPage).toHaveBeenCalledTimes(2);
  });

  it("throws a first-page error, but keeps what it has when a later page fails", async () => {
    await expect(read(async () => Promise.reject(new Error("down")), hoursAgo(1))).rejects.toThrow("down");
    const { all } = source(300);
    const fetchPage = vi.fn(async (offset: number, size: number) => {
      if (offset > 0) throw new Error("timeout");
      return all.slice(offset, offset + size);
    });
    expect(await read(fetchPage, hoursAgo(100_000))).toHaveLength(100);
  });
});
