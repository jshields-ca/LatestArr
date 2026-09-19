import type { SourceConnectionConfig } from "@latestarr/adapter-core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { bookOrbitAdapter, bookloreAdapter, grimmoryAdapter } from "./booklore-adapter.js";

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

const config: SourceConnectionConfig = {
  baseUrl: "http://booklore.local:6060",
  credentials: { username: "admin", password: "secret" },
};

const RECENT_FEED = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <id>urn:uuid:recent</id>
  <title>Recently Added</title>
  <updated>2026-01-20T00:00:00Z</updated>
  <entry>
    <title>Old Book</title>
    <id>urn:uuid:book-old</id>
    <updated>2000-01-01T00:00:00Z</updated>
    <author><name>Someone</name></author>
  </entry>
  <entry>
    <title>New Book</title>
    <id>urn:uuid:book-new</id>
    <updated>2026-01-15T00:00:00Z</updated>
    <author><name>Someone Else</name></author>
    <dc:issued>2020</dc:issued>
    <summary type="text">A newer book.</summary>
    <link rel="http://opds-spec.org/image" href="/api/v1/opds/cover/book-new" type="image/jpeg"/>
    <link rel="http://opds-spec.org/acquisition" href="/api/v1/opds/download/book-new" type="application/epub+zip"/>
  </entry>
</feed>`;

describe("createBookloreFamilyAdapter", () => {
  it("gives each of the three exports its own kind but identical behavior", () => {
    expect(bookloreAdapter.kind).toBe("booklore");
    expect(bookOrbitAdapter.kind).toBe("bookorbit");
    expect(grimmoryAdapter.kind).toBe("grimmory");
    expect(bookloreAdapter.capabilities).toEqual(bookOrbitAdapter.capabilities);
    expect(bookloreAdapter.capabilities).toEqual(grimmoryAdapter.capabilities);
  });
});

describe("testConnection", () => {
  it("returns ok on a successful call", async () => {
    mockFetch.mockResolvedValueOnce(
      xmlResponse(
        `<feed xmlns="http://www.w3.org/2005/Atom"><id>urn:uuid:root</id><title>Libraries</title><updated>2026-01-01T00:00:00Z</updated></feed>`,
      ),
    );
    await expect(bookloreAdapter.testConnection(config)).resolves.toEqual({ ok: true });
  });

  it("returns a failure message instead of throwing", async () => {
    mockFetch.mockResolvedValueOnce(xmlResponse("", false, 401));
    const result = await bookloreAdapter.testConnection(config);
    expect(result.ok).toBe(false);
    expect(result.message).toContain("401");
  });
});

describe("listLibraries", () => {
  it("maps every entry to a book library", async () => {
    mockFetch.mockResolvedValueOnce(
      xmlResponse(`<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <id>urn:uuid:root</id>
  <title>Libraries</title>
  <updated>2026-01-01T00:00:00Z</updated>
  <entry>
    <title>Fiction</title>
    <id>urn:uuid:lib-1</id>
    <updated>2026-01-01T00:00:00Z</updated>
  </entry>
</feed>`),
    );

    const libraries = await bookloreAdapter.listLibraries(config);
    expect(libraries).toEqual([{ id: "urn:uuid:lib-1", name: "Fiction", kind: "book" }]);
  });
});

describe("fetchRecentItems", () => {
  it("maps entries and filters by the since cutoff", async () => {
    mockFetch.mockResolvedValueOnce(xmlResponse(RECENT_FEED));

    const items = await bookloreAdapter.fetchRecentItems(config, {
      since: new Date("2026-01-10T00:00:00Z"),
    });

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      externalId: "urn:uuid:book-new",
      kind: "book",
      title: "New Book",
      subtitle: "Someone Else",
      overview: "A newer book.",
      contentLabel: "Ebook",
      posterUrl: "http://booklore.local:6060/api/v1/opds/cover/book-new",
    });
    expect(items[0]?.releaseDate?.getFullYear()).toBe(2020);
  });

  it("labels a comic acquisition link as Comic and falls back to Book with no acquisition link", async () => {
    const comicFeed = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <id>urn:uuid:recent</id>
  <title>Recently Added</title>
  <updated>2026-01-20T00:00:00Z</updated>
  <entry>
    <title>Some Comic</title>
    <id>urn:uuid:comic-1</id>
    <updated>2026-01-15T00:00:00Z</updated>
    <link rel="http://opds-spec.org/acquisition" href="/download/comic-1" type="application/vnd.comicbook+zip"/>
  </entry>
  <entry>
    <title>Untyped Entry</title>
    <id>urn:uuid:untyped-1</id>
    <updated>2026-01-16T00:00:00Z</updated>
  </entry>
</feed>`;
    mockFetch.mockResolvedValueOnce(xmlResponse(comicFeed));

    const items = await bookloreAdapter.fetchRecentItems(config, { since: new Date(0) });

    expect(items.find((item) => item.externalId === "urn:uuid:comic-1")?.contentLabel).toBe("Comic");
    expect(items.find((item) => item.externalId === "urn:uuid:untyped-1")?.contentLabel).toBe("Book");
  });

  it("prefers the full image link over the thumbnail when both are present", async () => {
    const feedWithBoth = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <id>urn:uuid:recent</id>
  <title>Recently Added</title>
  <updated>2026-01-20T00:00:00Z</updated>
  <entry>
    <title>Book With Both</title>
    <id>urn:uuid:book-both</id>
    <updated>2026-01-15T00:00:00Z</updated>
    <link rel="http://opds-spec.org/image/thumbnail" href="/thumb/book-both"/>
    <link rel="http://opds-spec.org/image" href="/full/book-both"/>
  </entry>
</feed>`;
    mockFetch.mockResolvedValueOnce(xmlResponse(feedWithBoth));

    const items = await bookloreAdapter.fetchRecentItems(config, { since: new Date(0) });

    expect(items[0]?.posterUrl).toBe("http://booklore.local:6060/full/book-both");
  });

  it("returns nothing when mediaKinds excludes book", async () => {
    const items = await bookloreAdapter.fetchRecentItems(config, {
      since: new Date(0),
      mediaKinds: ["movie"],
    });

    expect(items).toEqual([]);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("passes the requested limit through as the size param", async () => {
    mockFetch.mockResolvedValueOnce(xmlResponse(RECENT_FEED));

    await bookloreAdapter.fetchRecentItems(config, { since: new Date(0), limit: 10 });

    const [url] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(new URL(url).searchParams.get("size")).toBe("10");
  });
});

describe("fetchImageBytes", () => {
  it("fetches the item's posterUrl with Basic Auth and returns its bytes and content type", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "image/jpeg" }),
      arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer,
    });

    const result = await bookloreAdapter.fetchImageBytes!(config, {
      id: "1",
      externalId: "1",
      kind: "book",
      title: "A Book",
      addedAt: new Date(),
      posterUrl: "http://booklore.local:6060/api/v1/opds/cover/1",
    });

    expect(result).toEqual({ data: new Uint8Array([1, 2, 3]), contentType: "image/jpeg" });
    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    const expectedAuth = `Basic ${Buffer.from("admin:secret").toString("base64")}`;
    expect((init.headers as Record<string, string>).Authorization).toBe(expectedAuth);
  });

  it("returns null when the item has no posterUrl", async () => {
    const result = await bookloreAdapter.fetchImageBytes!(config, {
      id: "1",
      externalId: "1",
      kind: "book",
      title: "A Book",
      addedAt: new Date(),
    });

    expect(result).toBeNull();
    expect(mockFetch).not.toHaveBeenCalled();
  });
});
