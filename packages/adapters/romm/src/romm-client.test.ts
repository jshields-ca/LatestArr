import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchImage, getPlatforms, getRoms } from "./romm-client.js";

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

describe("getPlatforms", () => {
  it("returns the platform list with a bearer token", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse([{ id: 1, name: "SNES", slug: "snes" }]));

    const platforms = await getPlatforms("http://romm.local:3000", "rmm_tok123");
    expect(platforms).toEqual([{ id: 1, name: "SNES", slug: "snes" }]);

    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(new URL(url).pathname).toBe("/api/platforms");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer rmm_tok123");
  });

  it("throws on a non-2xx HTTP response", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({}, false, 401));
    await expect(getPlatforms("http://romm.local:3000", "bad")).rejects.toThrow("HTTP 401");
  });
});

describe("getRoms", () => {
  it("passes order/limit params and returns the page items", async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({ items: [{ id: 1, name: "Chrono Trigger", fs_name: "chrono.sfc" }], total: 1 }),
    );

    const roms = await getRoms("http://romm.local:3000", "rmm_tok123", 25);
    expect(roms).toHaveLength(1);

    const [url] = mockFetch.mock.calls[0] as [string, RequestInit];
    const parsed = new URL(url);
    expect(parsed.pathname).toBe("/api/roms");
    expect(parsed.searchParams.get("order_by")).toBe("created_at");
    expect(parsed.searchParams.get("order_dir")).toBe("desc");
    expect(parsed.searchParams.get("limit")).toBe("25");
    expect(parsed.searchParams.getAll("platform_ids")).toEqual([]);
  });

  it("appends one platform_ids param per requested platform", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ items: [], total: 0 }));

    await getRoms("http://romm.local:3000", "rmm_tok123", 25, ["1", "2"]);

    const [url] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(new URL(url).searchParams.getAll("platform_ids")).toEqual(["1", "2"]);
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

    const result = await fetchImage("http://romm.local:3000/cover.jpg");
    expect(result).toEqual({ data: new Uint8Array([9, 8, 7]), contentType: "image/png" });
  });

  it("returns null instead of throwing on a non-2xx response", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 404 });
    const result = await fetchImage("http://romm.local:3000/nope");
    expect(result).toBeNull();
  });

  it("returns null instead of throwing when the request itself fails", async () => {
    mockFetch.mockRejectedValueOnce(new Error("ECONNREFUSED"));
    const result = await fetchImage("http://romm.local:3000/nope");
    expect(result).toBeNull();
  });
});
