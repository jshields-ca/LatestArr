import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildImageUrl, fetchImage, getLibraries, getRecentlyAdded } from "./plex-client.js";

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
        MediaContainer: { Directory: [{ key: "1", title: "Movies", type: "movie" }] },
      }),
    );

    const libraries = await getLibraries("http://plex.local:32400", "tok123");
    expect(libraries).toEqual([{ key: "1", title: "Movies", type: "movie" }]);

    const calledUrl = new URL(mockFetch.mock.calls[0]![0] as string);
    expect(calledUrl.pathname).toBe("/library/sections");
    expect(calledUrl.searchParams.get("X-Plex-Token")).toBe("tok123");

    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>).Accept).toBe("application/json");
  });

  it("preserves a subpath in the base URL", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ MediaContainer: {} }));

    await getLibraries("http://plex.local:32400/plex/", "tok123");

    const calledUrl = new URL(mockFetch.mock.calls[0]![0] as string);
    expect(calledUrl.pathname).toBe("/plex/library/sections");
  });

  it("returns an empty array when Directory is absent", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ MediaContainer: {} }));
    const libraries = await getLibraries("http://plex.local:32400", "tok123");
    expect(libraries).toEqual([]);
  });

  it("throws on a non-2xx HTTP response", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({}, false, 401));
    await expect(getLibraries("http://plex.local:32400", "bad-token")).rejects.toThrow("HTTP 401");
  });
});

describe("getRecentlyAdded", () => {
  it("hits the global endpoint and passes the container size when no section is given", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ MediaContainer: { Metadata: [] } }));

    await getRecentlyAdded("http://plex.local:32400", "tok123", 25);

    const calledUrl = new URL(mockFetch.mock.calls[0]![0] as string);
    expect(calledUrl.pathname).toBe("/library/recentlyAdded");
    expect(calledUrl.searchParams.get("X-Plex-Container-Size")).toBe("25");
  });

  it("hits the section-scoped endpoint when a section key is given", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ MediaContainer: { Metadata: [] } }));

    await getRecentlyAdded("http://plex.local:32400", "tok123", 25, "1");

    const calledUrl = new URL(mockFetch.mock.calls[0]![0] as string);
    expect(calledUrl.pathname).toBe("/library/sections/1/recentlyAdded");
  });

  it("returns an empty array when Metadata is absent", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ MediaContainer: {} }));
    const items = await getRecentlyAdded("http://plex.local:32400", "tok123", 25);
    expect(items).toEqual([]);
  });
});

describe("buildImageUrl", () => {
  it("builds an absolute, token-bearing URL from a relative image path", () => {
    const url = buildImageUrl("http://plex.local:32400", "tok123", "/library/metadata/1/thumb/999");
    expect(url).toBe("http://plex.local:32400/library/metadata/1/thumb/999?X-Plex-Token=tok123");
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

    const result = await fetchImage("http://plex.local:32400/library/metadata/1/thumb/999?X-Plex-Token=tok123");
    expect(result).toEqual({ data: new Uint8Array([9, 8, 7]), contentType: "image/png" });
  });

  it("returns null instead of throwing on a non-2xx response", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 404 });
    const result = await fetchImage("http://plex.local:32400/nope");
    expect(result).toBeNull();
  });

  it("returns null instead of throwing when the request itself fails", async () => {
    mockFetch.mockRejectedValueOnce(new Error("ECONNREFUSED"));
    const result = await fetchImage("http://plex.local:32400/nope");
    expect(result).toBeNull();
  });

  it("passes a timeout signal so a hung source can't stall the fetch (and Promise.all in resolvePosterPlaceholders) forever", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "image/png" }),
      arrayBuffer: async () => new ArrayBuffer(0),
    });

    await fetchImage("http://plex.local:32400/library/metadata/1/thumb/999?X-Plex-Token=tok123");

    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it("returns null instead of throwing when the fetch is aborted (a timeout firing looks the same as any other rejection)", async () => {
    mockFetch.mockRejectedValueOnce(new DOMException("The operation was aborted.", "TimeoutError"));
    const result = await fetchImage("http://plex.local:32400/nope");
    expect(result).toBeNull();
  });
});
