import type { SourceConnectionConfig } from "@latestarr/adapter-core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { rommAdapter } from "./romm-adapter.js";

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
  baseUrl: "http://romm.local:3000",
  credentials: { token: "rmm_tok123" },
};

const baseRom = {
  fs_name: "chrono.sfc",
  platform_display_name: "SNES",
  summary: "A time-travel RPG.",
  url_cover: "http://romm.local:3000/cover.jpg",
};

describe("testConnection", () => {
  it("returns ok on a successful call", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse([]));
    await expect(rommAdapter.testConnection(config)).resolves.toEqual({ ok: true });
  });

  it("returns a failure message instead of throwing", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({}, false, 401));
    const result = await rommAdapter.testConnection(config);
    expect(result.ok).toBe(false);
    expect(result.message).toContain("401");
  });
});

describe("listLibraries", () => {
  it("maps every platform to the game kind", async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse([
        { id: 1, name: "SNES", slug: "snes" },
        { id: 2, name: "Game Boy", slug: "gb" },
      ]),
    );

    const libraries = await rommAdapter.listLibraries(config);
    expect(libraries).toEqual([
      { id: "1", name: "SNES", kind: "game" },
      { id: "2", name: "Game Boy", kind: "game" },
    ]);
  });
});

describe("fetchRecentItems", () => {
  it("maps roms and filters by the since cutoff", async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({
        items: [
          { ...baseRom, id: 1, name: "Old Game", created_at: "2020-01-01T00:00:00Z" },
          { ...baseRom, id: 2, name: "New Game", created_at: "2026-01-01T00:00:00Z" },
        ],
      }),
    );

    const items = await rommAdapter.fetchRecentItems(config, { since: new Date("2025-01-01T00:00:00Z") });

    expect(items).toHaveLength(1);
    expect(items[0]?.externalId).toBe("2");
    expect(items[0]?.kind).toBe("game");
    expect(items[0]?.subtitle).toBe("SNES");
    expect(items[0]?.posterUrl).toBe("http://romm.local:3000/cover.jpg");
  });

  it("falls back to fs_name when name is null", async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({
        items: [{ ...baseRom, id: 1, name: null, created_at: "2026-01-01T00:00:00Z" }],
      }),
    );

    const items = await rommAdapter.fetchRecentItems(config, { since: new Date(0) });
    expect(items[0]?.title).toBe("chrono.sfc");
  });

  it("passes libraryIds through as platform_ids", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ items: [] }));

    await rommAdapter.fetchRecentItems(config, { since: new Date(0), libraryIds: ["1", "2"] });

    const [url] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(new URL(url).searchParams.getAll("platform_ids")).toEqual(["1", "2"]);
  });

  it("returns an empty array when mediaKinds excludes game", async () => {
    const items = await rommAdapter.fetchRecentItems(config, {
      since: new Date(0),
      mediaKinds: ["movie"],
    });

    expect(items).toEqual([]);
    expect(mockFetch).not.toHaveBeenCalled();
  });
});
