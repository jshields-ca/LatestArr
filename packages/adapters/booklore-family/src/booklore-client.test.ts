import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  fetchOpdsImage,
  getEntryAuthorName,
  getEntryFormatLabel,
  getEntryImageHref,
  getEntryPermalinkHref,
  getEntrySummaryText,
  getLibraries,
  getRecentEntries,
  resolveOpdsUrl,
} from "./booklore-client.js";

const mockFetch = vi.fn();

beforeEach(() => {
  vi.stubGlobal("fetch", mockFetch);
});

afterEach(() => {
  vi.unstubAllGlobals();
  mockFetch.mockReset();
});

function xmlResponse(xml: string, ok = true, status = 200) {
  return { ok, status, text: async () => xml };
}

const NAVIGATION_FEED = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <id>urn:uuid:root</id>
  <title>BookLore Libraries</title>
  <updated>2026-01-01T00:00:00Z</updated>
  <entry>
    <title>Fiction</title>
    <id>urn:uuid:lib-1</id>
    <updated>2026-01-01T00:00:00Z</updated>
  </entry>
  <entry>
    <title>Comics</title>
    <id>urn:uuid:lib-2</id>
    <updated>2026-01-01T00:00:00Z</updated>
  </entry>
</feed>`;

const ACQUISITION_FEED = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <id>urn:uuid:recent</id>
  <title>Recently Added</title>
  <updated>2026-01-20T00:00:00Z</updated>
  <entry>
    <title>Some Book</title>
    <id>urn:uuid:book-1</id>
    <updated>2026-01-15T00:00:00Z</updated>
    <author><name>Some Author</name></author>
    <dc:issued>1999</dc:issued>
    <summary type="text">A book about things.</summary>
  </entry>
</feed>`;

describe("getLibraries", () => {
  it("parses navigation feed entries with basic auth", async () => {
    mockFetch.mockResolvedValueOnce(xmlResponse(NAVIGATION_FEED));

    const libraries = await getLibraries("http://booklore.local:6060", "admin", "secret");
    expect(libraries).toEqual([
      { title: "Fiction", id: "urn:uuid:lib-1", updated: "2026-01-01T00:00:00Z" },
      { title: "Comics", id: "urn:uuid:lib-2", updated: "2026-01-01T00:00:00Z" },
    ]);

    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(new URL(url).pathname).toBe("/api/v1/opds/libraries");
    const expectedAuth = `Basic ${Buffer.from("admin:secret").toString("base64")}`;
    expect((init.headers as Record<string, string>).Authorization).toBe(expectedAuth);
  });

  it("returns an empty array when there are no entries", async () => {
    mockFetch.mockResolvedValueOnce(
      xmlResponse(
        `<feed xmlns="http://www.w3.org/2005/Atom"><id>urn:uuid:root</id><title>Empty</title><updated>2026-01-01T00:00:00Z</updated></feed>`,
      ),
    );
    const libraries = await getLibraries("http://booklore.local:6060", "admin", "secret");
    expect(libraries).toEqual([]);
  });

  it("throws on a non-2xx HTTP response", async () => {
    mockFetch.mockResolvedValueOnce(xmlResponse("", false, 401));
    await expect(getLibraries("http://booklore.local:6060", "admin", "wrong")).rejects.toThrow("HTTP 401");
  });
});

describe("getRecentEntries", () => {
  it("passes the size query param and parses a single-entry feed", async () => {
    mockFetch.mockResolvedValueOnce(xmlResponse(ACQUISITION_FEED));

    const entries = await getRecentEntries("http://booklore.local:6060", "admin", "secret", 25);
    expect(entries).toHaveLength(1);
    expect(entries[0]?.title).toBe("Some Book");
    expect(getEntryAuthorName(entries[0]!)).toBe("Some Author");
    expect(getEntrySummaryText(entries[0]!)).toBe("A book about things.");

    const [url] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(new URL(url).pathname).toBe("/api/v1/opds/recent");
    expect(new URL(url).searchParams.get("size")).toBe("25");
  });
});

describe("getEntryImageHref", () => {
  it("prefers the full image rel over the thumbnail rel", () => {
    const entry = {
      id: "1",
      title: "Book",
      link: [
        { "@_rel": "http://opds-spec.org/image/thumbnail", "@_href": "/thumb" },
        { "@_rel": "http://opds-spec.org/image", "@_href": "/full" },
      ],
    };
    expect(getEntryImageHref(entry)).toBe("/full");
  });

  it("falls back to the thumbnail rel when there's no full image", () => {
    const entry = {
      id: "1",
      title: "Book",
      link: { "@_rel": "http://opds-spec.org/image/thumbnail", "@_href": "/thumb" },
    };
    expect(getEntryImageHref(entry)).toBe("/thumb");
  });

  it("returns undefined when there's no image link at all", () => {
    expect(getEntryImageHref({ id: "1", title: "Book" })).toBeUndefined();
  });
});

describe("getEntryPermalinkHref", () => {
  it("prefers rel=\"alternate\" over rel=\"self\"", () => {
    const entry = {
      id: "1",
      title: "Book",
      link: [
        { "@_rel": "self", "@_href": "/api/v1/opds/entry/1" },
        { "@_rel": "alternate", "@_href": "/reader/1", "@_type": "text/html" },
      ],
    };
    expect(getEntryPermalinkHref(entry)).toBe("/reader/1");
  });

  it("falls back to rel=\"self\" when there's no rel=\"alternate\"", () => {
    const entry = { id: "1", title: "Book", link: { "@_rel": "self", "@_href": "/api/v1/opds/entry/1" } };
    expect(getEntryPermalinkHref(entry)).toBe("/api/v1/opds/entry/1");
  });

  it("returns undefined when the entry has neither link", () => {
    const entry = {
      id: "1",
      title: "Book",
      link: { "@_rel": "http://opds-spec.org/image", "@_href": "/cover/1" },
    };
    expect(getEntryPermalinkHref(entry)).toBeUndefined();
  });
});

describe("getEntryFormatLabel", () => {
  it("labels comic archive MIME types as Comic", () => {
    const entry = {
      id: "1",
      title: "Comic",
      link: { "@_rel": "http://opds-spec.org/acquisition", "@_type": "application/vnd.comicbook+zip" },
    };
    expect(getEntryFormatLabel(entry)).toBe("Comic");
  });

  it("labels epub/pdf acquisition types as Ebook", () => {
    const epub = {
      id: "1",
      title: "Book",
      link: { "@_rel": "http://opds-spec.org/acquisition", "@_type": "application/epub+zip" },
    };
    const pdf = {
      id: "2",
      title: "Book",
      link: { "@_rel": "http://opds-spec.org/acquisition", "@_type": "application/pdf" },
    };
    expect(getEntryFormatLabel(epub)).toBe("Ebook");
    expect(getEntryFormatLabel(pdf)).toBe("Ebook");
  });

  it("falls back to Book when there's no acquisition link or an unrecognized type", () => {
    expect(getEntryFormatLabel({ id: "1", title: "Book" })).toBe("Book");
  });
});

describe("resolveOpdsUrl", () => {
  it("resolves a relative href against the feed's base URL", () => {
    expect(resolveOpdsUrl("http://booklore.local:6060", "/api/v1/opds/cover/1")).toBe(
      "http://booklore.local:6060/api/v1/opds/cover/1",
    );
  });

  it("leaves an already-absolute href untouched", () => {
    expect(resolveOpdsUrl("http://booklore.local:6060", "http://cdn.example.com/cover.jpg")).toBe(
      "http://cdn.example.com/cover.jpg",
    );
  });
});

describe("fetchOpdsImage", () => {
  it("fetches with Basic Auth and returns the image bytes and content type", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "image/png" }),
      arrayBuffer: async () => new Uint8Array([9, 8, 7]).buffer,
    });

    const result = await fetchOpdsImage("http://booklore.local:6060/api/v1/opds/cover/1", "admin", "secret");
    expect(result).toEqual({ data: new Uint8Array([9, 8, 7]), contentType: "image/png" });

    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    const expectedAuth = `Basic ${Buffer.from("admin:secret").toString("base64")}`;
    expect((init.headers as Record<string, string>).Authorization).toBe(expectedAuth);
  });

  it("returns null instead of throwing on a non-2xx response", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 401 });
    const result = await fetchOpdsImage("http://booklore.local:6060/nope", "admin", "wrong");
    expect(result).toBeNull();
  });

  it("returns null instead of throwing when the request itself fails", async () => {
    mockFetch.mockRejectedValueOnce(new Error("ECONNREFUSED"));
    const result = await fetchOpdsImage("http://booklore.local:6060/nope", "admin", "secret");
    expect(result).toBeNull();
  });

  it("passes a timeout signal alongside the Basic Auth header so a hung source can't stall the fetch (and Promise.all in resolvePosterPlaceholders) forever", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "image/png" }),
      arrayBuffer: async () => new ArrayBuffer(0),
    });

    await fetchOpdsImage("http://booklore.local:6060/api/v1/opds/cover/1", "admin", "secret");

    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it("returns null instead of throwing when the fetch is aborted (a timeout firing looks the same as any other rejection)", async () => {
    mockFetch.mockRejectedValueOnce(new DOMException("The operation was aborted.", "TimeoutError"));
    const result = await fetchOpdsImage("http://booklore.local:6060/nope", "admin", "secret");
    expect(result).toBeNull();
  });
});
