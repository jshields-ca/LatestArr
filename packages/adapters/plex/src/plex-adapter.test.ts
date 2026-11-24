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

// With no libraries chosen, it then reads the library list (#466): one
// library, of the type the test's items come from.
function mockLibraries(type = "movie") {
  mockFetch.mockResolvedValueOnce(jsonResponse({ MediaContainer: { Directory: [{ key: "1", title: "Library", type }] } }));
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
            { key: "3", title: "Music", type: "artist" },
          ],
        },
      }),
    );

    const libraries = await plexAdapter.listLibraries(config);
    expect(libraries).toEqual([
      { id: "1", name: "Movies", kind: "movie" },
      { id: "2", name: "TV Shows", kind: "tv_episode" },
      { id: "3", name: "Music", kind: "album" },
    ]);
  });
});

describe("getServerId", () => {
  it("reports the server's machine identifier, as a Tautulli watching it does", async () => {
    mockIdentity("srv-abc123");
    await expect(plexAdapter.getServerId!(config)).resolves.toBe("plex:srv-abc123");
    expect(String(mockFetch.mock.calls[0]![0])).toContain("/identity");
  });

  it("says it doesn't know when the server reports no identifier", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ MediaContainer: {} }));
    await expect(plexAdapter.getServerId!(config)).resolves.toBeUndefined();
  });
});

describe("listUsers", () => {
  it("maps accounts to SourceUser with no email, and drops the local account (id 0)", async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({
        MediaContainer: {
          Account: [
            { id: 0, name: "local" },
            { id: 1, name: "alice" },
            { id: 2, name: "bob" },
          ],
        },
      }),
    );

    const users = await plexAdapter.listUsers!(config);
    expect(users).toEqual([
      { externalId: "1", username: "alice" },
      { externalId: "2", username: "bob" },
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
    mockLibraries();
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

  // #354: music arrives as albums, from a real Plex's recently-added list.
  it("maps albums: the artist underneath, the track count and the cover", async () => {
    mockIdentity();
    mockLibraries("artist");
    mockFetch.mockResolvedValueOnce(
      jsonResponse({
        MediaContainer: {
          viewGroup: "album",
          Metadata: [
            {
              ratingKey: "49",
              parentRatingKey: "48",
              type: "album",
              title: "Summer Mix",
              parentTitle: "Various Artists",
              summary: "",
              year: 2026,
              thumb: "/library/metadata/49/thumb/1795035865",
              originallyAvailableAt: "2026-01-01",
              leafCount: 5,
              addedAt: 1795035863,
            },
            {
              ratingKey: "26",
              parentRatingKey: "25",
              type: "album",
              title: "Paper Boats",
              parentTitle: "Paper Boats",
              summary: "The first single.",
              thumb: "/library/metadata/26/thumb/1795035834",
              originallyAvailableAt: "2026-03-14",
              leafCount: 1,
              addedAt: 1795035833,
            },
          ],
        },
      }),
    );

    const items = await plexAdapter.fetchRecentItems(config, { since: new Date(0), mediaKinds: ["album"] });

    expect(items.map(({ raw: _raw, ...item }) => item)).toEqual([
      {
        id: "49",
        externalId: "49",
        kind: "album",
        title: "Summer Mix",
        subtitle: "Various Artists",
        overview: undefined,
        addedAt: new Date(1795035863 * 1000),
        // Only a year in the tags, so Plex's 1 January isn't shown as a date.
        releaseDate: undefined,
        posterUrl: "http://plex.local:32400/library/metadata/49/thumb/1795035865?X-Plex-Token=tok123",
        trackCount: 5,
        externalUrl: expect.stringContaining("/server/srv-abc123/details?key=%2Flibrary%2Fmetadata%2F49"),
      },
      expect.objectContaining({
        title: "Paper Boats",
        subtitle: "Paper Boats",
        overview: "The first single.",
        releaseDate: new Date("2026-03-14"),
        trackCount: 1,
      }),
    ]);
  });

  it("leaves music out unless asked for, and skips tracks and artists", async () => {
    expect(plexAdapter.capabilities.defaultMediaKinds).toEqual(["movie", "tv_episode", "tv_season"]);
    expect(plexAdapter.capabilities.supportsMediaKinds).toContain("album");
    mockIdentity();
    mockLibraries();
    mockFetch.mockResolvedValueOnce(
      jsonResponse({
        MediaContainer: {
          Metadata: [
            { ...baseItem, ratingKey: "1", type: "movie", addedAt: 1700000003 },
            { ...baseItem, ratingKey: "2", type: "album", parentTitle: "Lantern Field", addedAt: 1700000002 },
            { ...baseItem, ratingKey: "3", type: "track", addedAt: 1700000001 },
            { ...baseItem, ratingKey: "4", type: "artist", addedAt: 1700000000 },
          ],
        },
      }),
    );

    const items = await plexAdapter.fetchRecentItems(config, {
      since: new Date(0),
      mediaKinds: plexAdapter.capabilities.defaultMediaKinds,
    });
    expect(items.map((item) => item.externalId)).toEqual(["1"]);
  });

  it("falls back to the bare episode title/no subtitle when Plex gives no grandparentTitle", async () => {
    mockIdentity();
    mockLibraries();
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
    mockLibraries();
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
    mockLibraries();
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
    mockLibraries();
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

  it("uses the series poster for an episode, and its own thumb for a season", async () => {
    mockIdentity();
    mockLibraries();
    mockFetch.mockResolvedValueOnce(
      jsonResponse({
        MediaContainer: {
          Metadata: [
            {
              ...baseItem,
              ratingKey: "1",
              type: "episode",
              addedAt: 1700000000,
              thumb: "/library/metadata/1/thumb/still",
              grandparentThumb: "/library/metadata/9/thumb/poster",
            },
            {
              ...baseItem,
              ratingKey: "2",
              type: "season",
              addedAt: 1700000000,
              thumb: "/library/metadata/2/thumb/season",
              grandparentThumb: "/library/metadata/9/thumb/poster",
            },
          ],
        },
      }),
    );

    const items = await plexAdapter.fetchRecentItems(config, { since: new Date(0) });
    expect(new URL(items[0]!.posterUrl!).pathname).toBe("/library/metadata/9/thumb/poster");
    expect(new URL(items[1]!.posterUrl!).pathname).toBe("/library/metadata/2/thumb/season");
  });

  it("omits posterUrl when Plex gives no thumb", async () => {
    mockIdentity();
    mockLibraries();
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
    mockLibraries();
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
    mockLibraries();
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

  // #466: the server-wide list folds a new episode into its season, dated
  // when the season first arrived, so an episode of a season already there
  // was left out. Each library's own list dates every episode.
  it("reads each library's own list when none are chosen, so a new episode keeps its own date", async () => {
    const since = new Date("2026-11-20T00:00:00Z");
    const epoch = (iso: string) => new Date(iso).getTime() / 1000;
    mockIdentity();
    mockFetch.mockResolvedValueOnce(
      jsonResponse({
        MediaContainer: {
          Directory: [
            { key: "1", title: "Movies", type: "movie" },
            { key: "2", title: "TV Shows", type: "show" },
            { key: "3", title: "Music", type: "artist" },
            { key: "4", title: "Photos", type: "photo" },
          ],
        },
      }),
    );
    mockFetch.mockResolvedValueOnce(
      jsonResponse({ MediaContainer: { Metadata: [{ ...baseItem, ratingKey: "1", type: "movie", addedAt: epoch("2026-11-20T09:00:00Z") }] } }),
    );
    mockFetch.mockResolvedValueOnce(
      jsonResponse({
        MediaContainer: {
          Metadata: [
            {
              ...baseItem,
              ratingKey: "88",
              parentRatingKey: "80",
              title: "Judith & Michael",
              type: "episode",
              grandparentTitle: "Cupertino",
              parentIndex: 1,
              index: 8,
              addedAt: epoch("2026-11-20T07:19:00Z"),
            },
            { ...baseItem, ratingKey: "87", parentRatingKey: "80", type: "episode", grandparentTitle: "Cupertino", addedAt: epoch("2026-11-13T07:00:00Z") },
          ],
        },
      }),
    );

    const items = await plexAdapter.fetchRecentItems(config, {
      since,
      mediaKinds: plexAdapter.capabilities.defaultMediaKinds,
    });

    const paths = mockFetch.mock.calls.map(([input]) => new URL(input as string).pathname);
    // Music is off by default and photos aren't listed, so neither is read.
    expect(paths).toEqual(["/identity", "/library/sections", "/library/sections/1/recentlyAdded", "/library/sections/2/recentlyAdded"]);
    expect(paths).not.toContain("/library/recentlyAdded");
    expect(items.map((item) => [item.externalId, item.kind, item.subtitle])).toEqual([
      ["1", "movie", undefined],
      ["88", "tv_episode", "S01E08 - Judith & Michael"],
    ]);
    expect(items[1]?.seasonId).toBe("80");
  });

  it("lists the newest first across libraries", async () => {
    mockIdentity();
    mockFetch.mockResolvedValueOnce(
      jsonResponse({
        MediaContainer: {
          Directory: [
            { key: "1", title: "Movies", type: "movie" },
            { key: "2", title: "4K Movies", type: "movie" },
          ],
        },
      }),
    );
    mockFetch.mockResolvedValueOnce(
      jsonResponse({
        MediaContainer: {
          Metadata: [
            { ...baseItem, ratingKey: "1", type: "movie", addedAt: 1700000020 },
            { ...baseItem, ratingKey: "2", type: "movie", addedAt: 1700000000 },
          ],
        },
      }),
    );
    mockFetch.mockResolvedValueOnce(
      jsonResponse({ MediaContainer: { Metadata: [{ ...baseItem, ratingKey: "3", type: "movie", addedAt: 1700000030 }] } }),
    );

    const items = await plexAdapter.fetchRecentItems(config, { since: new Date(0) });

    expect(items.map((item) => item.externalId)).toEqual(["3", "1", "2"]);
  });

  it("reads music libraries once music is turned on", async () => {
    mockIdentity();
    mockFetch.mockResolvedValueOnce(
      jsonResponse({
        MediaContainer: {
          Directory: [
            { key: "1", title: "Movies", type: "movie" },
            { key: "3", title: "Music", type: "artist" },
          ],
        },
      }),
    );
    mockFetch.mockResolvedValueOnce(jsonResponse({ MediaContainer: { Metadata: [] } }));

    await plexAdapter.fetchRecentItems(config, { since: new Date(0), mediaKinds: ["album"] });

    const paths = mockFetch.mock.calls.map(([input]) => new URL(input as string).pathname);
    expect(paths).toEqual(["/identity", "/library/sections", "/library/sections/3/recentlyAdded"]);
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
      mockLibraries();
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

    it("gives an episode links to its season and series", async () => {
      mockIdentity("srv-abc123");
      mockLibraries();
      mockFetch.mockResolvedValueOnce(
        jsonResponse({
          MediaContainer: {
            Metadata: [
              { ...baseItem, ratingKey: "42", type: "episode", parentRatingKey: "41", grandparentRatingKey: "40", addedAt: 1700000000 },
            ],
          },
        }),
      );

      const items = await plexAdapter.fetchRecentItems({ ...config, publicUrl: "https://app.plex.tv" }, { since: new Date(0) });

      const link = (key: string) => `https://app.plex.tv/desktop#!/server/srv-abc123/details?key=%2Flibrary%2Fmetadata%2F${key}`;
      expect(items[0]).toMatchObject({ externalUrl: link("42"), seasonUrl: link("41"), seriesUrl: link("40") });
    });

    it("builds the deep link from publicUrl instead of baseUrl when configured", async () => {
      mockIdentity("srv-abc123");
      mockLibraries();
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
      mockLibraries();
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

// 150 items added an hour apart, newest first: more than one page of 100.
const PAGED_NOW = new Date("2026-10-17T12:00:00Z");
const pagedAt = (n: number) => new Date(PAGED_NOW.getTime() - n * 3_600_000);
const pagedSince = new Date(PAGED_NOW.getTime() - 7 * 24 * 3_600_000);
const PAGED_TOTAL = 150;
const pagedSlice = (start: number, size: number) =>
  Array.from({ length: PAGED_TOTAL }, (_, n) => n).slice(start, start + size);

describe("reading past one page", () => {
  it("pages with X-Plex-Container-Start until it has everything in the window", async () => {
    mockFetch.mockImplementation(async (input: string) => {
      const url = new URL(input);
      if (url.pathname === "/identity") return jsonResponse({ MediaContainer: { machineIdentifier: "srv" } });
      if (url.pathname === "/library/sections") {
        return jsonResponse({ MediaContainer: { Directory: [{ key: "1", title: "Movies", type: "movie" }] } });
      }
      const start = Number(url.searchParams.get("X-Plex-Container-Start"));
      const size = Number(url.searchParams.get("X-Plex-Container-Size"));
      return jsonResponse({
        MediaContainer: {
          Metadata: pagedSlice(start, size).map((n) => ({
            ratingKey: String(n),
            title: `Movie ${n}`,
            type: "movie",
            addedAt: pagedAt(n).getTime() / 1000,
          })),
        },
      });
    });

    const items = await plexAdapter.fetchRecentItems(config, { since: pagedSince });

    expect(items).toHaveLength(PAGED_TOTAL);
    const starts = mockFetch.mock.calls
      .map(([input]) => new URL(input as string).searchParams.get("X-Plex-Container-Start"))
      .filter((start) => start !== null);
    expect(starts).toEqual(["0", "100"]);
  });
});
