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

// fetchRecentItems fetches /identity once, before looping over sections, to
// resolve the machineIdentifier a per-item deep link needs — every test
// below that exercises fetchRecentItems queues this response first.
function mockIdentity(machineIdentifier: string | undefined = "srv-abc123") {
  mockFetch.mockResolvedValueOnce(jsonResponse({ MediaContainer: { machineIdentifier } }));
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
    mockIdentity();
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
    // The series name belongs in the prominent title, not the bare episode
    // name — see plex-adapter.ts's buildEpisodeTitle for why.
    expect(items[1]?.title).toBe("Show");
    expect(items[1]?.subtitle).toBe("S01E01 - Ep");
  });

  it("falls back to the bare episode title/no subtitle when Plex gives no grandparentTitle", async () => {
    mockIdentity();
    mockFetch.mockResolvedValueOnce(
      jsonResponse({
        MediaContainer: {
          Metadata: [{ ...baseItem, ratingKey: "1", title: "Ep", type: "episode", addedAt: 1700000000 }],
        },
      }),
    );

    const items = await plexAdapter.fetchRecentItems(config, { since: new Date(0) });

    expect(items[0]?.title).toBe("Ep");
    expect(items[0]?.subtitle).toBeUndefined();
  });

  it("uses the show name as title and the season name as subtitle when Plex gives a parentTitle, alongside a real externalUrl", async () => {
    // Regression test for the tv_season title fix and the clickable-links
    // feature landing in the same function: a season item needs both its
    // show-name title/subtitle mapping AND a real per-item deep link built
    // from the same fetch's machineIdentifier lookup.
    mockIdentity("srv-abc123");
    mockFetch.mockResolvedValueOnce(
      jsonResponse({
        MediaContainer: {
          Metadata: [
            {
              ...baseItem,
              ratingKey: "1",
              title: "Season 1",
              type: "season",
              parentTitle: "Show",
              addedAt: 1700000000,
            },
          ],
        },
      }),
    );

    const items = await plexAdapter.fetchRecentItems(config, { since: new Date(0) });

    expect(items[0]?.kind).toBe("tv_season");
    expect(items[0]?.title).toBe("Show");
    expect(items[0]?.subtitle).toBe("Season 1");
    expect(items[0]?.externalUrl).toBe(
      "http://plex.local:32400/web/index.html#!/server/srv-abc123/details?key=%2Flibrary%2Fmetadata%2F1",
    );
  });

  it("falls back to the bare season title/no subtitle when Plex gives no parentTitle", async () => {
    mockIdentity();
    mockFetch.mockResolvedValueOnce(
      jsonResponse({
        MediaContainer: {
          Metadata: [
            { ...baseItem, ratingKey: "1", title: "Season 1", type: "season", addedAt: 1700000000 },
          ],
        },
      }),
    );

    const items = await plexAdapter.fetchRecentItems(config, { since: new Date(0) });

    expect(items[0]?.title).toBe("Season 1");
    expect(items[0]?.subtitle).toBeUndefined();
  });

  it("builds an absolute, token-bearing posterUrl from a relative thumb path", async () => {
    mockIdentity();
    mockFetch.mockResolvedValueOnce(
      jsonResponse({
        MediaContainer: {
          Metadata: [
            {
              ...baseItem,
              ratingKey: "1",
              type: "movie",
              addedAt: 1700000000,
              thumb: "/library/metadata/1/thumb/999",
            },
          ],
        },
      }),
    );

    const items = await plexAdapter.fetchRecentItems(config, { since: new Date(0) });

    expect(items[0]?.posterUrl).toBe(
      "http://plex.local:32400/library/metadata/1/thumb/999?X-Plex-Token=tok123",
    );
  });

  it("omits posterUrl when Plex gives no thumb", async () => {
    mockIdentity();
    mockFetch.mockResolvedValueOnce(
      jsonResponse({
        MediaContainer: {
          Metadata: [{ ...baseItem, ratingKey: "1", type: "movie", addedAt: 1700000000 }],
        },
      }),
    );

    const items = await plexAdapter.fetchRecentItems(config, { since: new Date(0) });
    expect(items[0]?.posterUrl).toBeUndefined();
  });

  it("filters out items added before the since cutoff", async () => {
    mockIdentity();
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
    mockIdentity();
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
    mockIdentity();
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

    expect(mockFetch).toHaveBeenCalledTimes(3);
    expect(items.map((item) => item.externalId).sort()).toEqual(["1", "2"]);
  });

  describe("externalUrl", () => {
    it("builds a Plex web deep link from baseUrl when no publicUrl is configured", async () => {
      mockIdentity("srv-abc123");
      mockFetch.mockResolvedValueOnce(
        jsonResponse({
          MediaContainer: { Metadata: [{ ...baseItem, ratingKey: "42", type: "movie", addedAt: 1700000000 }] },
        }),
      );

      const items = await plexAdapter.fetchRecentItems(config, { since: new Date(0) });

      expect(items[0]?.externalUrl).toBe(
        "http://plex.local:32400/web/index.html#!/server/srv-abc123/details?key=%2Flibrary%2Fmetadata%2F42",
      );
    });

    it("builds the deep link from publicUrl instead of baseUrl when configured", async () => {
      mockIdentity("srv-abc123");
      mockFetch.mockResolvedValueOnce(
        jsonResponse({
          MediaContainer: { Metadata: [{ ...baseItem, ratingKey: "42", type: "movie", addedAt: 1700000000 }] },
        }),
      );

      const publicConfig: SourceConnectionConfig = { ...config, publicUrl: "https://plex.example.com" };
      const items = await plexAdapter.fetchRecentItems(publicConfig, { since: new Date(0) });

      expect(items[0]?.externalUrl).toBe(
        "https://plex.example.com/web/index.html#!/server/srv-abc123/details?key=%2Flibrary%2Fmetadata%2F42",
      );
    });

    it("falls back to a plain library link when the identity lookup fails", async () => {
      mockFetch.mockRejectedValueOnce(new Error("ECONNREFUSED"));
      mockFetch.mockResolvedValueOnce(
        jsonResponse({
          MediaContainer: { Metadata: [{ ...baseItem, ratingKey: "42", type: "movie", addedAt: 1700000000 }] },
        }),
      );

      const items = await plexAdapter.fetchRecentItems(config, { since: new Date(0) });

      expect(items[0]?.externalUrl).toBe("http://plex.local:32400/web/index.html");
    });
  });
});

describe("fetchImageBytes", () => {
  it("fetches the item's posterUrl directly and returns its bytes and content type", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "image/jpeg" }),
      arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer,
    });

    const result = await plexAdapter.fetchImageBytes!(config, {
      id: "1",
      externalId: "1",
      kind: "movie",
      title: "A Movie",
      addedAt: new Date(),
      posterUrl: "http://plex.local:32400/library/metadata/1/thumb/999?X-Plex-Token=tok123",
    });

    expect(result).toEqual({ data: new Uint8Array([1, 2, 3]), contentType: "image/jpeg" });
  });

  it("returns null when the item has no posterUrl", async () => {
    const result = await plexAdapter.fetchImageBytes!(config, {
      id: "1",
      externalId: "1",
      kind: "movie",
      title: "A Movie",
      addedAt: new Date(),
    });

    expect(result).toBeNull();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("returns null instead of throwing on a failed fetch", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 404 });

    const result = await plexAdapter.fetchImageBytes!(config, {
      id: "1",
      externalId: "1",
      kind: "movie",
      title: "A Movie",
      addedAt: new Date(),
      posterUrl: "http://plex.local:32400/library/metadata/1/thumb/999?X-Plex-Token=tok123",
    });

    expect(result).toBeNull();
  });
});
