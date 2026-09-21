import type { SourceConnectionConfig } from "@latestarr/adapter-core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { tautulliAdapter } from "./tautulli-adapter.js";

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

// fetchRecentItems and fetchPopularItems each fetch get_server_id once,
// before their own item requests, but only when the connection has a
// publicUrl configured (see buildExternalUrl's comment: without a
// publicUrl there's no link to build regardless of machineIdentifier, so
// the lookup is skipped entirely) — only the externalUrl tests below that
// use a publicUrl-carrying config need this queued.
function mockServerId(pmsIdentifier: string | undefined = "srv-abc123") {
  mockFetch.mockResolvedValueOnce(
    jsonResponse({ response: { result: "success", message: null, data: { pms_identifier: pmsIdentifier } } }),
  );
}

const config: SourceConnectionConfig = {
  baseUrl: "http://tautulli.local:8181",
  credentials: { apiKey: "key123" },
};

describe("testConnection", () => {
  it("returns ok on a successful call", async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({ response: { result: "success", message: null, data: [] } }),
    );
    await expect(tautulliAdapter.testConnection(config)).resolves.toEqual({ ok: true });
  });

  it("returns a failure message instead of throwing", async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({ response: { result: "error", message: "Invalid apikey", data: null } }),
    );
    const result = await tautulliAdapter.testConnection(config);
    expect(result.ok).toBe(false);
    expect(result.message).toBe("Invalid apikey");
  });
});

describe("listLibraries", () => {
  it("maps section_type to our MediaKind", async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({
        response: {
          result: "success",
          message: null,
          data: [
            { section_id: "1", section_name: "Movies", section_type: "movie" },
            { section_id: "2", section_name: "TV Shows", section_type: "show" },
          ],
        },
      }),
    );

    const libraries = await tautulliAdapter.listLibraries(config);
    expect(libraries).toEqual([
      { id: "1", name: "Movies", kind: "movie" },
      { id: "2", name: "TV Shows", kind: "tv_episode" },
    ]);
  });
});

describe("fetchRecentItems", () => {
  const baseItem = {
    rating_key: "100",
    title: "Some Movie",
    full_title: "Some Movie",
    summary: "A movie.",
    genres: ["Action"],
  };

  it("maps movie/episode items and skips unmapped media types", async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({
        response: {
          result: "success",
          message: null,
          data: {
            recently_added: [
              { ...baseItem, rating_key: "1", media_type: "movie", added_at: "1700000000" },
              {
                ...baseItem,
                rating_key: "2",
                title: "Ep",
                full_title: "Show - S01E01 - Ep",
                media_type: "episode",
                added_at: "1700000001",
              },
              { ...baseItem, rating_key: "3", media_type: "track", added_at: "1700000002" },
            ],
          },
        },
      }),
    );

    const items = await tautulliAdapter.fetchRecentItems(config, { since: new Date(0) });

    expect(items).toHaveLength(2);
    expect(items[0]?.kind).toBe("movie");
    expect(items[1]?.kind).toBe("tv_episode");
    // No grandparent_title on this fixture, so it falls back to the
    // pre-existing full_title-based subtitle rather than the structured
    // "SxxExx - Episode" form.
    expect(items[1]?.title).toBe("Ep");
    expect(items[1]?.subtitle).toBe("Show - S01E01 - Ep");
  });

  it("uses the series title and SxxExx when Tautulli gives grandparent/episode info", async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({
        response: {
          result: "success",
          message: null,
          data: {
            recently_added: [
              {
                ...baseItem,
                rating_key: "2",
                title: "Winter Is Coming",
                full_title: "Game of Thrones - S01E01 - Winter Is Coming",
                media_type: "episode",
                added_at: "1700000000",
                grandparent_title: "Game of Thrones",
                parent_media_index: 1,
                media_index: 1,
              },
            ],
          },
        },
      }),
    );

    const items = await tautulliAdapter.fetchRecentItems(config, { since: new Date(0) });

    expect(items[0]?.title).toBe("Game of Thrones");
    expect(items[0]?.subtitle).toBe("S01E01 - Winter Is Coming");
  });

  it("uses the show name as title and the season name as subtitle when Tautulli gives parent_title, alongside a real externalUrl", async () => {
    // Regression test for the tv_season title fix and the clickable-links
    // feature landing in the same function: a season item needs both its
    // show-name title/subtitle mapping AND a real per-item deep link built
    // from the same fetch's get_server_id lookup (only made here because
    // publicConfig below carries a publicUrl).
    mockServerId("srv-abc123");
    mockFetch.mockResolvedValueOnce(
      jsonResponse({
        response: {
          result: "success",
          message: null,
          data: {
            recently_added: [
              {
                ...baseItem,
                rating_key: "1",
                title: "Season 1",
                full_title: "Show - Season 1",
                media_type: "season",
                added_at: "1700000000",
                parent_title: "Show",
              },
            ],
          },
        },
      }),
    );

    const publicConfig: SourceConnectionConfig = { ...config, publicUrl: "https://plex.example.com" };
    const items = await tautulliAdapter.fetchRecentItems(publicConfig, { since: new Date(0) });

    expect(items[0]?.kind).toBe("tv_season");
    expect(items[0]?.title).toBe("Show");
    expect(items[0]?.subtitle).toBe("Season 1");
    expect(items[0]?.externalUrl).toBe(
      "https://plex.example.com/web/index.html#!/server/srv-abc123/details?key=%2Flibrary%2Fmetadata%2F1",
    );
  });

  it("falls back to the bare season title/full_title subtitle when Tautulli gives no parent_title", async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({
        response: {
          result: "success",
          message: null,
          data: {
            recently_added: [
              {
                ...baseItem,
                rating_key: "1",
                title: "Season 1",
                full_title: "Season 1",
                media_type: "season",
                added_at: "1700000000",
              },
            ],
          },
        },
      }),
    );

    const items = await tautulliAdapter.fetchRecentItems(config, { since: new Date(0) });

    expect(items[0]?.title).toBe("Season 1");
    expect(items[0]?.subtitle).toBeUndefined();
  });

  it("maps thumb into a pms_image_proxy posterUrl", async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({
        response: {
          result: "success",
          message: null,
          data: {
            recently_added: [
              { ...baseItem, rating_key: "1", media_type: "movie", added_at: "1700000000", thumb: "/thumb/1" },
            ],
          },
        },
      }),
    );

    const items = await tautulliAdapter.fetchRecentItems(config, { since: new Date(0) });

    const url = new URL(items[0]!.posterUrl!);
    expect(url.searchParams.get("cmd")).toBe("pms_image_proxy");
    expect(url.searchParams.get("img")).toBe("/thumb/1");
    expect(url.searchParams.get("apikey")).toBe("key123");
  });

  it("falls back to art when there's no thumb", async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({
        response: {
          result: "success",
          message: null,
          data: {
            recently_added: [
              { ...baseItem, rating_key: "1", media_type: "movie", added_at: "1700000000", art: "/art/1" },
            ],
          },
        },
      }),
    );

    const items = await tautulliAdapter.fetchRecentItems(config, { since: new Date(0) });
    expect(new URL(items[0]!.posterUrl!).searchParams.get("img")).toBe("/art/1");
  });

  it("filters out items added before the since cutoff", async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({
        response: {
          result: "success",
          message: null,
          data: {
            recently_added: [
              { ...baseItem, rating_key: "1", media_type: "movie", added_at: "1000" },
              { ...baseItem, rating_key: "2", media_type: "movie", added_at: "2000" },
            ],
          },
        },
      }),
    );

    const items = await tautulliAdapter.fetchRecentItems(config, {
      since: new Date(1500 * 1000),
    });

    expect(items).toHaveLength(1);
    expect(items[0]?.externalId).toBe("2");
  });

  it("filters by mediaKinds when provided", async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({
        response: {
          result: "success",
          message: null,
          data: {
            recently_added: [
              { ...baseItem, rating_key: "1", media_type: "movie", added_at: "1700000000" },
              { ...baseItem, rating_key: "2", media_type: "episode", added_at: "1700000000" },
            ],
          },
        },
      }),
    );

    const items = await tautulliAdapter.fetchRecentItems(config, {
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
          response: {
            result: "success",
            message: null,
            data: {
              recently_added: [
                { ...baseItem, rating_key: "1", media_type: "movie", added_at: "1700000000" },
              ],
            },
          },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          response: {
            result: "success",
            message: null,
            data: {
              recently_added: [
                { ...baseItem, rating_key: "2", media_type: "movie", added_at: "1700000000" },
              ],
            },
          },
        }),
      );

    const items = await tautulliAdapter.fetchRecentItems(config, {
      since: new Date(0),
      libraryIds: ["1", "2"],
    });

    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(items.map((item) => item.externalId).sort()).toEqual(["1", "2"]);
  });

  describe("externalUrl", () => {
    it("omits externalUrl entirely (and skips the get_server_id lookup) when no publicUrl is configured", async () => {
      // Unlike Plex/Audiobookshelf/RomM, Tautulli's own baseUrl is its API
      // host, never a page a recipient should be sent to — so with no
      // publicUrl there's no link to build at all, matching this
      // adapter's pre-existing (no-link) behavior rather than pointing at
      // a broken page on the Tautulli host.
      mockFetch.mockResolvedValueOnce(
        jsonResponse({
          response: {
            result: "success",
            message: null,
            data: {
              recently_added: [{ ...baseItem, rating_key: "42", media_type: "movie", added_at: "1700000000" }],
            },
          },
        }),
      );

      const items = await tautulliAdapter.fetchRecentItems(config, { since: new Date(0) });

      expect(items[0]?.externalUrl).toBeUndefined();
      // Only the recently_added request — get_server_id would be wasted
      // work here since buildExternalUrl can't use it without a publicUrl.
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it("builds the deep link from publicUrl (the real Plex address) instead of Tautulli's own baseUrl", async () => {
      mockServerId("srv-abc123");
      mockFetch.mockResolvedValueOnce(
        jsonResponse({
          response: {
            result: "success",
            message: null,
            data: {
              recently_added: [{ ...baseItem, rating_key: "42", media_type: "movie", added_at: "1700000000" }],
            },
          },
        }),
      );

      const publicConfig: SourceConnectionConfig = { ...config, publicUrl: "https://plex.example.com" };
      const items = await tautulliAdapter.fetchRecentItems(publicConfig, { since: new Date(0) });

      expect(items[0]?.externalUrl).toBe(
        "https://plex.example.com/web/index.html#!/server/srv-abc123/details?key=%2Flibrary%2Fmetadata%2F42",
      );
    });

    it("falls back to a plain publicUrl-based library link when get_server_id fails", async () => {
      mockFetch.mockRejectedValueOnce(new Error("ECONNREFUSED"));
      mockFetch.mockResolvedValueOnce(
        jsonResponse({
          response: {
            result: "success",
            message: null,
            data: {
              recently_added: [{ ...baseItem, rating_key: "42", media_type: "movie", added_at: "1700000000" }],
            },
          },
        }),
      );

      const publicConfig: SourceConnectionConfig = { ...config, publicUrl: "https://plex.example.com" };
      const items = await tautulliAdapter.fetchRecentItems(publicConfig, { since: new Date(0) });

      expect(items[0]?.externalUrl).toBe("https://plex.example.com/web/index.html");
    });
  });
});

describe("fetchPopularItems", () => {
  it("maps top_movies rows and requests both movies and TV by default", async () => {
    mockFetch
      .mockResolvedValueOnce(
        jsonResponse({
          response: {
            result: "success",
            message: null,
            data: [
              {
                stat_id: "top_movies",
                rows: [
                  {
                    rating_key: "1",
                    title: "A Movie",
                    media_type: "movie",
                    total_plays: 12,
                    users_watched: 3,
                    last_play: "1700000000",
                  },
                ],
              },
            ],
          },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          response: { result: "success", message: null, data: [{ stat_id: "top_tv", rows: [] }] },
        }),
      );

    const items = await tautulliAdapter.fetchPopularItems!(config, { since: new Date(0) });

    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      externalId: "1",
      kind: "movie",
      title: "A Movie",
      playCount: 12,
      uniqueViewerCount: 3,
    });
  });

  it("only queries the stat matching the requested media kind", async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({
        response: {
          result: "success",
          message: null,
          data: [
            {
              stat_id: "top_tv",
              rows: [
                { rating_key: "2", title: "A Show", media_type: "episode", total_plays: 7 },
              ],
            },
          ],
        },
      }),
    );

    const items = await tautulliAdapter.fetchPopularItems!(config, {
      since: new Date(0),
      mediaKinds: ["tv_episode"],
    });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const calledUrl = new URL(mockFetch.mock.calls[0]![0] as string);
    expect(calledUrl.searchParams.get("stat_id")).toBe("top_tv");
    expect(items).toHaveLength(1);
    expect(items[0]?.kind).toBe("tv_episode");
  });

  it("converts the since date into a whole number of days for time_range", async () => {
    mockFetch.mockResolvedValue(
      jsonResponse({ response: { result: "success", message: null, data: [] } }),
    );

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    await tautulliAdapter.fetchPopularItems!(config, {
      since: sevenDaysAgo,
      mediaKinds: ["movie"],
    });

    // No get_server_id call here — config has no publicUrl, so it's
    // skipped and the home_stats request is the only call made.
    const calledUrl = new URL(mockFetch.mock.calls[0]![0] as string);
    expect(calledUrl.searchParams.get("time_range")).toBe("7");
  });

  it("omits externalUrl on popular items too when no publicUrl is configured", async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({
        response: {
          result: "success",
          message: null,
          data: [
            {
              stat_id: "top_movies",
              rows: [{ rating_key: "1", title: "A Movie", media_type: "movie", total_plays: 12 }],
            },
          ],
        },
      }),
    );

    const items = await tautulliAdapter.fetchPopularItems!(config, {
      since: new Date(0),
      mediaKinds: ["movie"],
    });

    expect(items[0]?.externalUrl).toBeUndefined();
  });

  it("sets externalUrl on popular items using the same deep-link construction as fetchRecentItems, when publicUrl is configured", async () => {
    mockServerId("srv-abc123");
    mockFetch.mockResolvedValueOnce(
      jsonResponse({
        response: {
          result: "success",
          message: null,
          data: [
            {
              stat_id: "top_movies",
              rows: [{ rating_key: "1", title: "A Movie", media_type: "movie", total_plays: 12 }],
            },
          ],
        },
      }),
    );

    const publicConfig: SourceConnectionConfig = { ...config, publicUrl: "https://plex.example.com" };
    const items = await tautulliAdapter.fetchPopularItems!(publicConfig, {
      since: new Date(0),
      mediaKinds: ["movie"],
    });

    expect(items[0]?.externalUrl).toBe(
      "https://plex.example.com/web/index.html#!/server/srv-abc123/details?key=%2Flibrary%2Fmetadata%2F1",
    );
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

    const result = await tautulliAdapter.fetchImageBytes!(config, {
      id: "1",
      externalId: "1",
      kind: "movie",
      title: "A Movie",
      addedAt: new Date(),
      posterUrl: "http://tautulli.local:8181/api/v2?apikey=key123&cmd=pms_image_proxy&img=%2Fthumb%2F1",
    });

    expect(result).toEqual({ data: new Uint8Array([1, 2, 3]), contentType: "image/jpeg" });
  });

  it("returns null when the item has no posterUrl", async () => {
    const result = await tautulliAdapter.fetchImageBytes!(config, {
      id: "1",
      externalId: "1",
      kind: "movie",
      title: "A Movie",
      addedAt: new Date(),
    });

    expect(result).toBeNull();
    expect(mockFetch).not.toHaveBeenCalled();
  });
});
