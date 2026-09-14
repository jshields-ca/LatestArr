import type { SourceConnectionConfig } from "@latestarr/adapter-core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { audiobookshelfAdapter } from "./audiobookshelf-adapter.js";

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
  baseUrl: "http://abs.local:13378",
  credentials: { token: "tok123" },
};

const baseItem = {
  mediaType: "book",
  media: { metadata: { title: "A Book", authorName: "An Author", description: "A description." } },
};

describe("testConnection", () => {
  it("returns ok on a successful call", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ libraries: [] }));
    await expect(audiobookshelfAdapter.testConnection(config)).resolves.toEqual({ ok: true });
  });

  it("returns a failure message instead of throwing", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({}, false, 401));
    const result = await audiobookshelfAdapter.testConnection(config);
    expect(result.ok).toBe(false);
    expect(result.message).toContain("401");
  });
});

describe("listLibraries", () => {
  it("maps every library to the audiobook kind", async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({
        libraries: [
          { id: "lib1", name: "Audiobooks", mediaType: "book" },
          { id: "lib2", name: "Podcasts", mediaType: "podcast" },
        ],
      }),
    );

    const libraries = await audiobookshelfAdapter.listLibraries(config);
    expect(libraries).toEqual([
      { id: "lib1", name: "Audiobooks", kind: "audiobook" },
      { id: "lib2", name: "Podcasts", kind: "audiobook" },
    ]);
  });
});

describe("fetchRecentItems", () => {
  it("discovers libraries and fetches items from each when no libraryIds given", async () => {
    mockFetch
      .mockResolvedValueOnce(
        jsonResponse({
          libraries: [
            { id: "lib1", name: "Audiobooks", mediaType: "book" },
            { id: "lib2", name: "More Audiobooks", mediaType: "book" },
          ],
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          results: [{ ...baseItem, id: "item1", addedAt: 1700000000000, updatedAt: 1700000000000 }],
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          results: [{ ...baseItem, id: "item2", addedAt: 1700000000000, updatedAt: 1700000000000 }],
        }),
      );

    const items = await audiobookshelfAdapter.fetchRecentItems(config, { since: new Date(0) });

    expect(mockFetch).toHaveBeenCalledTimes(3);
    expect(items.map((item) => item.externalId).sort()).toEqual(["item1", "item2"]);
    expect(items[0]?.kind).toBe("audiobook");
    expect(items[0]?.subtitle).toBe("An Author");
  });

  it("queries only the given libraryIds without discovering libraries", async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({
        results: [{ ...baseItem, id: "item1", addedAt: 1700000000000, updatedAt: 1700000000000 }],
      }),
    );

    const items = await audiobookshelfAdapter.fetchRecentItems(config, {
      since: new Date(0),
      libraryIds: ["lib1"],
    });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(items).toHaveLength(1);
  });

  it("treats addedAt as milliseconds and filters by the since cutoff", async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({
        results: [
          { ...baseItem, id: "old", addedAt: 1000, updatedAt: 1000 },
          { ...baseItem, id: "new", addedAt: 2000, updatedAt: 2000 },
        ],
      }),
    );

    const items = await audiobookshelfAdapter.fetchRecentItems(config, {
      since: new Date(1500),
      libraryIds: ["lib1"],
    });

    expect(items).toHaveLength(1);
    expect(items[0]?.externalId).toBe("new");
  });

  it("returns an empty array when mediaKinds excludes audiobook", async () => {
    const items = await audiobookshelfAdapter.fetchRecentItems(config, {
      since: new Date(0),
      mediaKinds: ["movie"],
    });

    expect(items).toEqual([]);
    expect(mockFetch).not.toHaveBeenCalled();
  });
});
