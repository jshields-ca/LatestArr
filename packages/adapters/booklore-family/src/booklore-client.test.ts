import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getEntryAuthorName, getEntrySummaryText, getLibraries, getRecentEntries } from "./booklore-client.js";

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
