import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getLibraries, getRecentlyAdded } from "./plex-client.js";

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
