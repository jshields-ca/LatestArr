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
    expect(items[1]?.subtitle).toBe("Show - S01E01 - Ep");
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
});
