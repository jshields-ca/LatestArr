import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getLibraries, getRecentlyAdded } from "./tautulli-client.js";

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
