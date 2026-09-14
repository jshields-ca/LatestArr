import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getLibraries, getLibraryItems } from "./audiobookshelf-client.js";

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
  it("returns the libraries array with a bearer token", async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({ libraries: [{ id: "lib1", name: "Audiobooks", mediaType: "book" }] }),
    );

    const libraries = await getLibraries("http://abs.local:13378", "tok123");
    expect(libraries).toEqual([{ id: "lib1", name: "Audiobooks", mediaType: "book" }]);

    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(new URL(url).pathname).toBe("/api/libraries");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer tok123");
  });

  it("throws on a non-2xx HTTP response", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({}, false, 401));
    await expect(getLibraries("http://abs.local:13378", "bad")).rejects.toThrow("HTTP 401");
  });
});

describe("getLibraryItems", () => {
  it("passes sort/desc/limit query params and returns results", async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({
        results: [
          {
            id: "item1",
            mediaType: "book",
            media: { metadata: { title: "A Book" } },
            addedAt: 1650621073750,
            updatedAt: 1650621073750,
          },
        ],
      }),
    );

    const items = await getLibraryItems("http://abs.local:13378", "tok123", "lib1", 50);
    expect(items).toHaveLength(1);
    expect(items[0]?.id).toBe("item1");

    const [url] = mockFetch.mock.calls[0] as [string, RequestInit];
    const parsed = new URL(url);
    expect(parsed.pathname).toBe("/api/libraries/lib1/items");
    expect(parsed.searchParams.get("sort")).toBe("addedAt");
    expect(parsed.searchParams.get("desc")).toBe("1");
    expect(parsed.searchParams.get("limit")).toBe("50");
  });
});
