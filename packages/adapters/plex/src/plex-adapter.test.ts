import type { SourceConnectionConfig } from "@latestarr/adapter-core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { plexAdapter } from "./plex-adapter.js";

const mockFetch = vi.fn();

beforeEach(() => {
  vi.stubGlobal("fetch", mockFetch);
});

afterEach(() => {
  vi.unstubAllGlobals();
  mockFetch.mockReset();
});

function jsonResponse(body: unknown, ok = true, status = 200) {
  return { ok, status, json: async () => body };
}

const config: SourceConnectionConfig = {
  baseUrl: "http://plex.local:32400",
  credentials: { token: "tok123" },
};

describe("testConnection", () => {
  it("returns ok on a successful call", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ MediaContainer: { Directory: [] } }));
    await expect(plexAdapter.testConnection(config)).resolves.toEqual({ ok: true });
  });

  it("returns a failure message instead of throwing", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({}, false, 401));
    const result = await plexAdapter.testConnection(config);
    expect(result.ok).toBe(false);
    expect(result.message).toContain("401");
  });
});

describe("listLibraries", () => {
  it("maps section type to our MediaKind", async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({
        MediaContainer: {
          Directory: [
            { key: "1", title: "Movies", type: "movie" },
            { key: "2", title: "TV Shows", type: "show" },
          ],
        },
      }),
    );

    const libraries = await plexAdapter.listLibraries(config);
    expect(libraries).toEqual([
      { id: "1", name: "Movies", kind: "movie" },
      { id: "2", name: "TV Shows", kind: "tv_episode" },
    ]);
  });
});

describe("fetchRecentItems", () => {
  const baseItem = {
    ratingKey: "100",
    title: "Some Movie",
    summary: "A movie.",
  };

  it("maps movie/episode items and skips unmapped media types", async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({
        MediaContainer: {
          Metadata: [
            { ...baseItem, ratingKey: "1", type: "movie", addedAt: 1700000000 },
            {
              ...baseItem,
              ratingKey: "2",
              title: "Ep",
              type: "episode",
              grandparentTitle: "Show",
              parentIndex: 1,
              index: 1,
              addedAt: 1700000001,
            },
            { ...baseItem, ratingKey: "3", type: "track", addedAt: 1700000002 },
          ],
        },
      }),
    );

    const items = await plexAdapter.fetchRecentItems(config, { since: new Date(0) });

    expect(items).toHaveLength(2);
    expect(items[0]?.kind).toBe("movie");
    expect(items[1]?.kind).toBe("tv_episode");
    expect(items[1]?.subtitle).toBe("Show - S01E01 - Ep");
  });

  it("filters out items added before the since cutoff", async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({
        MediaContainer: {
          Metadata: [
            { ...baseItem, ratingKey: "1", type: "movie", addedAt: 1000 },
            { ...baseItem, ratingKey: "2", type: "movie", addedAt: 2000 },
          ],
        },
      }),
    );

    const items = await plexAdapter.fetchRecentItems(config, { since: new Date(1500 * 1000) });

    expect(items).toHaveLength(1);
    expect(items[0]?.externalId).toBe("2");
  });

  it("filters by mediaKinds when provided", async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({
        MediaContainer: {
          Metadata: [
            { ...baseItem, ratingKey: "1", type: "movie", addedAt: 1700000000 },
            { ...baseItem, ratingKey: "2", type: "episode", addedAt: 1700000000 },
          ],
        },
      }),
    );

    const items = await plexAdapter.fetchRecentItems(config, {
      since: new Date(0),
      mediaKinds: ["movie"],
    });

    expect(items).toHaveLength(1);
    expect(items[0]?.kind).toBe("movie");
  });

  it("issues one request per library id and merges the results", async () => {
    mockFetch
      .mockResolvedValueOnce(
        jsonResponse({
          MediaContainer: {
            Metadata: [{ ...baseItem, ratingKey: "1", type: "movie", addedAt: 1700000000 }],
          },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          MediaContainer: {
            Metadata: [{ ...baseItem, ratingKey: "2", type: "movie", addedAt: 1700000000 }],
          },
        }),
      );

    const items = await plexAdapter.fetchRecentItems(config, {
      since: new Date(0),
      libraryIds: ["1", "2"],
    });

    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(items.map((item) => item.externalId).sort()).toEqual(["1", "2"]);
  });
});
