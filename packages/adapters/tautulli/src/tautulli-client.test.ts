import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildImageProxyUrl, fetchImage, getHomeStats, getLibraries, getRecentlyAdded } from "./tautulli-client.js";

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

describe("getLibraries", () => {
  it("returns the library list on success", async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({
        response: {
          result: "success",
          message: null,
          data: [{ section_id: "1", section_name: "Movies", section_type: "movie" }],
        },
      }),
    );

    const libraries = await getLibraries("http://tautulli.local:8181", "key123");
    expect(libraries).toEqual([{ section_id: "1", section_name: "Movies", section_type: "movie" }]);

    const calledUrl = new URL(mockFetch.mock.calls[0]![0] as string);
    expect(calledUrl.pathname).toBe("/api/v2");
    expect(calledUrl.searchParams.get("apikey")).toBe("key123");
    expect(calledUrl.searchParams.get("cmd")).toBe("get_libraries");
  });

  it("preserves an HTTP_ROOT subpath in the base URL", async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({ response: { result: "success", message: null, data: [] } }),
    );

    await getLibraries("http://tautulli.local:8181/tautulli/", "key123");

    const calledUrl = new URL(mockFetch.mock.calls[0]![0] as string);
    expect(calledUrl.pathname).toBe("/tautulli/api/v2");
  });

  it("throws when Tautulli reports an API error", async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({ response: { result: "error", message: "Invalid apikey", data: null } }),
    );

    await expect(getLibraries("http://tautulli.local:8181", "bad-key")).rejects.toThrow(
      "Invalid apikey",
    );
  });

  it("throws on a non-2xx HTTP response", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({}, false, 500));

    await expect(getLibraries("http://tautulli.local:8181", "key123")).rejects.toThrow("HTTP 500");
  });
});

describe("getRecentlyAdded", () => {
  it("passes count and section_id through as query params", async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({ response: { result: "success", message: null, data: { recently_added: [] } } }),
    );

    await getRecentlyAdded("http://tautulli.local:8181", "key123", 25, "1");

    const calledUrl = new URL(mockFetch.mock.calls[0]![0] as string);
    expect(calledUrl.searchParams.get("cmd")).toBe("get_recently_added");
    expect(calledUrl.searchParams.get("count")).toBe("25");
    expect(calledUrl.searchParams.get("section_id")).toBe("1");
  });

  it("omits section_id when not provided", async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({ response: { result: "success", message: null, data: { recently_added: [] } } }),
    );

    await getRecentlyAdded("http://tautulli.local:8181", "key123", 25);

    const calledUrl = new URL(mockFetch.mock.calls[0]![0] as string);
    expect(calledUrl.searchParams.has("section_id")).toBe(false);
  });
});

describe("getHomeStats", () => {
  it("passes stat_id, time_range, and stats_count through as query params", async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({
        response: {
          result: "success",
          message: null,
          data: [{ stat_id: "top_movies", rows: [] }],
        },
      }),
    );

    await getHomeStats("http://tautulli.local:8181", "key123", "top_movies", 7, 10);

    const calledUrl = new URL(mockFetch.mock.calls[0]![0] as string);
    expect(calledUrl.searchParams.get("cmd")).toBe("get_home_stats");
    expect(calledUrl.searchParams.get("stat_id")).toBe("top_movies");
    expect(calledUrl.searchParams.get("time_range")).toBe("7");
    expect(calledUrl.searchParams.get("stats_type")).toBe("plays");
    expect(calledUrl.searchParams.get("stats_count")).toBe("10");
  });

  it("returns the rows for the matching stat_id out of the response array", async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({
        response: {
          result: "success",
          message: null,
          data: [
            { stat_id: "top_users", rows: [] },
            {
              stat_id: "top_tv",
              rows: [{ rating_key: "1", title: "A Show", media_type: "episode", total_plays: 5 }],
            },
          ],
        },
      }),
    );

    const rows = await getHomeStats("http://tautulli.local:8181", "key123", "top_tv", 7, 10);
    expect(rows).toEqual([
      { rating_key: "1", title: "A Show", media_type: "episode", total_plays: 5 },
    ]);
  });

  it("returns an empty array when the stat_id isn't present in the response", async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({ response: { result: "success", message: null, data: [] } }),
    );

    const rows = await getHomeStats("http://tautulli.local:8181", "key123", "top_movies", 7, 10);
    expect(rows).toEqual([]);
  });
});

describe("buildImageProxyUrl", () => {
  it("builds a pms_image_proxy URL carrying the apikey and image path", () => {
    const url = buildImageProxyUrl("http://tautulli.local:8181", "key123", "/thumb/1");
    const parsed = new URL(url);
    expect(parsed.pathname).toBe("/api/v2");
    expect(parsed.searchParams.get("cmd")).toBe("pms_image_proxy");
    expect(parsed.searchParams.get("apikey")).toBe("key123");
    expect(parsed.searchParams.get("img")).toBe("/thumb/1");
  });
});

describe("fetchImage", () => {
  it("returns the image bytes and content type on success", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "image/png" }),
      arrayBuffer: async () => new Uint8Array([9, 8, 7]).buffer,
    });

    const result = await fetchImage(buildImageProxyUrl("http://tautulli.local:8181", "key123", "/thumb/1"));
    expect(result).toEqual({ data: new Uint8Array([9, 8, 7]), contentType: "image/png" });
  });

  it("returns null instead of throwing on a non-2xx response", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 404 });
    const result = await fetchImage("http://tautulli.local:8181/nope");
    expect(result).toBeNull();
  });

  it("returns null instead of throwing when the request itself fails", async () => {
    mockFetch.mockRejectedValueOnce(new Error("ECONNREFUSED"));
    const result = await fetchImage("http://tautulli.local:8181/nope");
    expect(result).toBeNull();
  });

  it("passes a timeout signal so a hung source can't stall the fetch (and Promise.all in resolvePosterPlaceholders) forever", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "image/png" }),
      arrayBuffer: async () => new ArrayBuffer(0),
    });

    await fetchImage(buildImageProxyUrl("http://tautulli.local:8181", "key123", "/thumb/1"));

    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it("returns null instead of throwing when the fetch is aborted (a timeout firing looks the same as any other rejection)", async () => {
    mockFetch.mockRejectedValueOnce(new DOMException("The operation was aborted.", "TimeoutError"));
    const result = await fetchImage("http://tautulli.local:8181/nope");
    expect(result).toBeNull();
  });
});
