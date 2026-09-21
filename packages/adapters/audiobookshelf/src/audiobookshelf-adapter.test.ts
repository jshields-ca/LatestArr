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

  it("labels a book item as Audiobook and a podcast item as Podcast", async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({
        results: [
          { ...baseItem, id: "book1", mediaType: "book", addedAt: 1700000000000, updatedAt: 1700000000000 },
          { ...baseItem, id: "pod1", mediaType: "podcast", addedAt: 1700000000000, updatedAt: 1700000000000 },
        ],
      }),
    );

    const items = await audiobookshelfAdapter.fetchRecentItems(config, {
      since: new Date(0),
      libraryIds: ["lib1"],
    });

    expect(items.find((item) => item.externalId === "book1")?.contentLabel).toBe("Audiobook");
    expect(items.find((item) => item.externalId === "pod1")?.contentLabel).toBe("Podcast");
  });

  it("builds an absolute, token-bearing posterUrl when the item has a coverPath", async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({
        results: [
          {
            ...baseItem,
            id: "item1",
            media: { ...baseItem.media, coverPath: "/metadata/item1/cover.jpg" },
            addedAt: 1700000000000,
            updatedAt: 1700000000000,
          },
        ],
      }),
    );

    const items = await audiobookshelfAdapter.fetchRecentItems(config, {
      since: new Date(0),
      libraryIds: ["lib1"],
    });

    expect(items[0]?.posterUrl).toBe("http://abs.local:13378/api/items/item1/cover?token=tok123");
  });

  it("omits posterUrl when the item has no coverPath", async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({
        results: [{ ...baseItem, id: "item1", addedAt: 1700000000000, updatedAt: 1700000000000 }],
      }),
    );

    const items = await audiobookshelfAdapter.fetchRecentItems(config, {
      since: new Date(0),
      libraryIds: ["lib1"],
    });

    expect(items[0]?.posterUrl).toBeUndefined();
  });

  describe("externalUrl", () => {
    it("builds an item web link from baseUrl when no publicUrl is configured", async () => {
      mockFetch.mockResolvedValueOnce(
        jsonResponse({
          results: [{ ...baseItem, id: "item1", addedAt: 1700000000000, updatedAt: 1700000000000 }],
        }),
      );

      const items = await audiobookshelfAdapter.fetchRecentItems(config, {
        since: new Date(0),
        libraryIds: ["lib1"],
      });

      expect(items[0]?.externalUrl).toBe("http://abs.local:13378/item/item1");
    });

    it("builds the item web link from publicUrl instead of baseUrl when configured", async () => {
      mockFetch.mockResolvedValueOnce(
        jsonResponse({
          results: [{ ...baseItem, id: "item1", addedAt: 1700000000000, updatedAt: 1700000000000 }],
        }),
      );

      const publicConfig: SourceConnectionConfig = { ...config, publicUrl: "https://abs.example.com" };
      const items = await audiobookshelfAdapter.fetchRecentItems(publicConfig, {
        since: new Date(0),
        libraryIds: ["lib1"],
      });

      expect(items[0]?.externalUrl).toBe("https://abs.example.com/item/item1");
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

    const result = await audiobookshelfAdapter.fetchImageBytes!(config, {
      id: "1",
      externalId: "1",
      kind: "audiobook",
      title: "A Book",
      addedAt: new Date(),
      posterUrl: "http://abs.local:13378/api/items/1/cover?token=tok123",
    });

    expect(result).toEqual({ data: new Uint8Array([1, 2, 3]), contentType: "image/jpeg" });
  });

  it("returns null when the item has no posterUrl", async () => {
    const result = await audiobookshelfAdapter.fetchImageBytes!(config, {
      id: "1",
      externalId: "1",
      kind: "audiobook",
      title: "A Book",
      addedAt: new Date(),
    });

    expect(result).toBeNull();
    expect(mockFetch).not.toHaveBeenCalled();
  });
});
