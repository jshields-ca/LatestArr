import type { SourceConnectionConfig } from "@latestarr/adapter-core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { embyAdapter, jellyfinAdapter } from "./jellyfin-adapter.js";

const mockFetch = vi.fn();

beforeEach(() => {
  vi.stubGlobal("fetch", mockFetch);
});

afterEach(() => {
  vi.unstubAllGlobals();
  mockFetch.mockReset();
});

function jsonResponse(body: unknown, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

function requestAt(index: number): { url: URL; headers: Record<string, string> } {
  const [url, init] = mockFetch.mock.calls[index] as [URL | string, RequestInit];
  return { url: new URL(String(url)), headers: init.headers as Record<string, string> };
}

const config: SourceConnectionConfig = {
  baseUrl: "http://media.lan:8096/",
  publicUrl: "https://media.example.com",
  credentials: { apiKey: "key123" },
};

const serverInfo = { Id: "srv1", ServerName: "Home", Version: "10.10.7" };

const since = new Date("2026-09-20T00:00:00Z");

const movie = {
  Id: "m1",
  Name: "The Quiet Harbour",
  Type: "Movie",
  DateCreated: "2026-09-25T10:00:00.0000000Z",
  PremiereDate: "2026-03-11T00:00:00.0000000Z",
  Overview: "A lighthouse keeper finds a message.",
  Genres: ["Drama"],
  CommunityRating: 7.8,
  RunTimeTicks: 112 * 60 * 10_000_000,
  ImageTags: { Primary: "tagm1" },
};

const episode = {
  Id: "e1",
  Name: "The Long Way Home",
  Type: "Episode",
  DateCreated: "2026-09-24T10:00:00Z",
  SeriesName: "Night Shift",
  SeriesId: "s1",
  SeriesPrimaryImageTag: "tags1",
  ParentIndexNumber: 2,
  IndexNumber: 5,
  ImageTags: { Primary: "still" },
};

const audiobook = {
  Id: "a1",
  Name: "Gardens of the North",
  Type: "AudioBook",
  DateCreated: "2026-09-23T10:00:00Z",
  People: [{ Name: "A. Lindqvist", Type: "Author" }],
  RunTimeTicks: 36_000 * 10_000_000, // 10 hours
};

const old = { ...movie, Id: "m0", Name: "Older", DateCreated: "2026-09-01T00:00:00Z" };

describe("authentication", () => {
  it("sends Jellyfin's Authorization header and Emby's X-Emby-Token", async () => {
    mockFetch.mockResolvedValue(jsonResponse(serverInfo));
    await jellyfinAdapter.testConnection(config);
    await embyAdapter.testConnection(config);

    expect(requestAt(0).headers).toMatchObject({ Authorization: 'MediaBrowser Token="key123"' });
    expect(requestAt(0).headers).not.toHaveProperty("X-Emby-Token");
    expect(requestAt(1).headers).toMatchObject({ "X-Emby-Token": "key123" });
    expect(requestAt(1).headers).not.toHaveProperty("Authorization");
    // The key is never put in a URL.
    expect(requestAt(0).url.search).not.toContain("key123");
  });
});

describe("testConnection", () => {
  it("reports the server's name and version", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse(serverInfo));
    await expect(jellyfinAdapter.testConnection(config)).resolves.toEqual({
      ok: true,
      serverInfo: { name: "Home", version: "10.10.7" },
    });
    expect(requestAt(0).url.toString()).toBe("http://media.lan:8096/System/Info");
  });

  it("explains a rejected key instead of throwing", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({}, 401));
    await expect(embyAdapter.testConnection(config)).resolves.toEqual({
      ok: false,
      message: "Emby rejected the API key (HTTP 401)",
    });
  });
});

describe("listLibraries", () => {
  it("maps collection types and leaves out music and playlists", async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({
        Items: [
          { Id: "l1", Name: "Movies", CollectionType: "movies" },
          { Id: "l2", Name: "Shows", CollectionType: "tvshows" },
          { Id: "l3", Name: "Books", CollectionType: "books" },
          { Id: "l4", Name: "Music", CollectionType: "music" },
          { Id: "l5", Name: "Playlists", CollectionType: "playlists" },
          { Id: "l6", Name: "Mixed" },
        ],
      }),
    );
    await expect(jellyfinAdapter.listLibraries(config)).resolves.toEqual([
      { id: "l1", name: "Movies", kind: "movie" },
      { id: "l2", name: "Shows", kind: "tv_episode" },
      { id: "l3", name: "Books", kind: "book" },
      { id: "l6", name: "Mixed", kind: "movie" },
    ]);
  });
});

describe("listUsers", () => {
  it("lists server accounts without emails", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse([{ Id: "u1", Name: "alex" }]));
    await expect(jellyfinAdapter.listUsers!(config)).resolves.toEqual([{ externalId: "u1", username: "alex" }]);
  });
});

describe("fetchRecentItems", () => {
  it("asks for the newest items first and maps movies, episodes, and audiobooks", async () => {
    mockFetch
      .mockResolvedValueOnce(jsonResponse(serverInfo))
      .mockResolvedValueOnce(jsonResponse({ Items: [movie, episode, audiobook, old] }));

    const items = await jellyfinAdapter.fetchRecentItems(config, { since });

    const { url } = requestAt(1);
    expect(url.pathname).toBe("/Items");
    expect(Object.fromEntries(url.searchParams)).toMatchObject({
      Recursive: "true",
      IncludeItemTypes: "Movie,Episode,Book,AudioBook",
      SortBy: "DateCreated",
      SortOrder: "Descending",
      Limit: "100",
    });
    expect(url.searchParams.get("Fields")).toContain("DateCreated");

    expect(items.map((item) => item.id)).toEqual(["m1", "e1", "a1"]);
    expect(items[0]).toMatchObject({
      kind: "movie",
      title: "The Quiet Harbour",
      overview: "A lighthouse keeper finds a message.",
      genres: ["Drama"],
      rating: { source: "jellyfin", value: 7.8, scale: 10 },
      runtimeMinutes: 112,
      posterUrl: "http://media.lan:8096/Items/m1/Images/Primary?maxHeight=450&quality=90&tag=tagm1",
      externalUrl: "https://media.example.com/web/#/details?id=m1&serverId=srv1",
    });
    expect(items[0]!.addedAt.toISOString()).toBe("2026-09-25T10:00:00.000Z");
    expect(items[1]).toMatchObject({
      kind: "tv_episode",
      title: "Night Shift",
      subtitle: "S02E05 - The Long Way Home",
      // The series poster, not the episode still.
      posterUrl: "http://media.lan:8096/Items/s1/Images/Primary?maxHeight=450&quality=90&tag=tags1",
    });
    expect(items[2]).toMatchObject({
      kind: "audiobook",
      subtitle: "A. Lindqvist",
      durationSeconds: 36_000,
      runtimeMinutes: undefined,
      posterUrl: undefined,
    });
  });

  it("builds Emby's own item links", async () => {
    mockFetch
      .mockResolvedValueOnce(jsonResponse(serverInfo))
      .mockResolvedValueOnce(jsonResponse({ Items: [{ ...movie, ServerId: "emby-srv" }] }));
    const [item] = await embyAdapter.fetchRecentItems({ ...config, publicUrl: undefined }, { since });
    expect(item!.externalUrl).toBe("http://media.lan:8096/web/index.html#!/item?id=m1&serverId=emby-srv");
  });

  it("queries each chosen library once, only for the requested kinds, without duplicates", async () => {
    mockFetch
      .mockResolvedValueOnce(jsonResponse(serverInfo))
      .mockResolvedValueOnce(jsonResponse({ Items: [movie] }))
      .mockResolvedValueOnce(jsonResponse({ Items: [movie] }));

    const items = await jellyfinAdapter.fetchRecentItems(config, {
      since,
      libraryIds: ["l1", "l6"],
      mediaKinds: ["movie", "game"],
      limit: 20,
    });

    expect(items).toHaveLength(1);
    expect(requestAt(1).url.searchParams.get("ParentId")).toBe("l1");
    expect(requestAt(2).url.searchParams.get("ParentId")).toBe("l6");
    expect(requestAt(1).url.searchParams.get("IncludeItemTypes")).toBe("Movie");
    expect(requestAt(1).url.searchParams.get("Limit")).toBe("20");
  });

  it("returns nothing, without asking, for kinds it doesn't carry", async () => {
    await expect(jellyfinAdapter.fetchRecentItems(config, { since, mediaKinds: ["game"] })).resolves.toEqual([]);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("still links items when the server info lookup fails", async () => {
    mockFetch
      .mockResolvedValueOnce(jsonResponse({}, 500))
      .mockResolvedValueOnce(jsonResponse({ Items: [movie] }));
    const [item] = await jellyfinAdapter.fetchRecentItems(config, { since });
    expect(item!.externalUrl).toBe("https://media.example.com/web/#/details?id=m1");
  });

  it("fails with a readable message when the item list can't be fetched", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse(serverInfo)).mockResolvedValueOnce(jsonResponse({}, 502));
    await expect(jellyfinAdapter.fetchRecentItems(config, { since })).rejects.toThrow(
      "Jellyfin request failed with HTTP 502",
    );
  });
});

describe("fetchImageBytes", () => {
  it("fetches the poster with the key in a header, and returns null on failure", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "image/webp" }),
      arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer,
    });
    const item = { posterUrl: "http://media.lan:8096/Items/m1/Images/Primary" } as Parameters<
      NonNullable<typeof embyAdapter.fetchImageBytes>
    >[1];

    await expect(embyAdapter.fetchImageBytes!(config, item)).resolves.toEqual({
      data: new Uint8Array([1, 2, 3]),
      contentType: "image/webp",
    });
    expect(requestAt(0).headers).toMatchObject({ "X-Emby-Token": "key123" });

    mockFetch.mockRejectedValueOnce(new Error("timeout"));
    await expect(embyAdapter.fetchImageBytes!(config, item)).resolves.toBeNull();
    await expect(embyAdapter.fetchImageBytes!(config, { ...item, posterUrl: undefined })).resolves.toBeNull();
  });
});
