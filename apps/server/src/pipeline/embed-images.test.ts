import type { FetchedImage, NewItem, SourceAdapter, SourceConnectionConfig } from "@latestarr/adapter-core";
import { describe, expect, it, vi } from "vitest";
import { preparePosterPlaceholders, resolvePosterPlaceholders, type ItemImageSource } from "./embed-images.js";

// A real, valid 1x1 PNG — sharp needs to actually decode this, not just
// see bytes, so a fake/placeholder buffer wouldn't exercise the resize
// step this module relies on.
const TINY_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);

function item(overrides: Partial<NewItem> = {}): NewItem {
  return {
    id: "1",
    externalId: "1",
    kind: "movie",
    title: "A Movie",
    addedAt: new Date(),
    ...overrides,
  };
}

function fakeAdapter(fetchImageBytes?: SourceAdapter["fetchImageBytes"]): SourceAdapter {
  return {
    kind: "fake",
    capabilities: { supportsMediaKinds: ["movie"], supportsIncrementalSync: false },
    testConnection: async () => ({ ok: true }),
    listLibraries: async () => [],
    fetchRecentItems: async () => [],
    fetchImageBytes,
  };
}

const config: SourceConnectionConfig = { baseUrl: "http://source.local", credentials: {} };

function source(adapter: SourceAdapter): ItemImageSource {
  return { adapter, config };
}

// Wraps a placeholder token the way a real template render would: as an
// <img src="..."> inside the compiled HTML.
function renderedHtml(...tokens: string[]): string {
  return tokens.map((token) => `<img src="${token}" alt="cover" />`).join("");
}

describe("preparePosterPlaceholders", () => {
  it("replaces posterUrl with an opaque, non-empty placeholder token", () => {
    const theItem = item({ posterUrl: "http://source.local/poster.jpg" });

    const { items, placeholders } = preparePosterPlaceholders([theItem]);

    expect(items).toHaveLength(1);
    expect(items[0]?.posterUrl).toBeTruthy();
    expect(items[0]?.posterUrl).not.toBe("http://source.local/poster.jpg");
    expect(placeholders.size).toBe(1);
    expect(placeholders.get(items[0]!.posterUrl!)).toBe(theItem);
  });

  it("passes an item through unchanged when it has no posterUrl", () => {
    const theItem = item({ posterUrl: undefined });

    const { items, placeholders } = preparePosterPlaceholders([theItem]);

    expect(items[0]).toBe(theItem);
    expect(placeholders.size).toBe(0);
  });

  it("gives every item its own unique token even across repeated calls", () => {
    const a = item({ id: "a", posterUrl: "http://source.local/a.jpg" });
    const b = item({ id: "b", posterUrl: "http://source.local/b.jpg" });

    const first = preparePosterPlaceholders([a]);
    const second = preparePosterPlaceholders([b]);

    expect(first.items[0]?.posterUrl).not.toBe(second.items[0]?.posterUrl);
  });

  it("never produces a token that is a substring of another item's token", () => {
    // Regression guard: a naive counter-based token scheme (e.g.
    // "pool:1" / "pool:10") risks one token being a substring of
    // another, which would make resolvePosterPlaceholders' html.includes
    // check match the wrong (or an extra) item.
    const items = Array.from({ length: 15 }, (_, i) =>
      item({ id: String(i), posterUrl: `http://source.local/${i}.jpg` }),
    );

    const { items: placed } = preparePosterPlaceholders(items);
    const tokens = placed.map((i) => i.posterUrl!);

    for (const token of tokens) {
      const others = tokens.filter((t) => t !== token);
      expect(others.some((other) => other.includes(token))).toBe(false);
    }
  });
});

describe("resolvePosterPlaceholders", () => {
  it("embeds only the items whose placeholder token actually appears in the rendered HTML", async () => {
    const shown = item({ id: "shown", posterUrl: "http://source.local/shown.jpg" });
    const notShown = item({ id: "not-shown", posterUrl: "http://source.local/not-shown.jpg" });
    const { items, placeholders } = preparePosterPlaceholders([shown, notShown]);

    const fetchImageBytes = vi.fn(async (): Promise<FetchedImage | null> => ({
      data: TINY_PNG,
      contentType: "image/png",
    }));
    const html = renderedHtml(items[0]!.posterUrl!); // only "shown"'s token is in the output

    const result = await resolvePosterPlaceholders(html, placeholders, () => source(fakeAdapter(fetchImageBytes)));

    // The whole point of this module: an item the template didn't
    // actually render never triggers a fetch at all.
    expect(fetchImageBytes).toHaveBeenCalledTimes(1);
    expect(result.attachments).toHaveLength(1);
    expect(result.html).toContain("cid:poster-0@latestarr");
    expect(result.html).not.toContain(items[1]!.posterUrl!);
  });

  it("replaces the referenced token with a cid reference and adds a matching attachment", async () => {
    const theItem = item({ posterUrl: "http://source.local/poster.jpg" });
    const { items, placeholders } = preparePosterPlaceholders([theItem]);
    const token = items[0]!.posterUrl!;
    const html = renderedHtml(token);

    const fetchImageBytes = async (): Promise<FetchedImage | null> => ({
      data: TINY_PNG,
      contentType: "image/png",
    });

    const result = await resolvePosterPlaceholders(html, placeholders, () => source(fakeAdapter(fetchImageBytes)));

    expect(result.html).not.toContain(token);
    expect(result.html).toContain('src="cid:poster-0@latestarr"');
    expect(result.attachments).toHaveLength(1);
    expect(result.attachments[0]).toMatchObject({ cid: "poster-0@latestarr", contentType: "image/jpeg" });
    expect(Buffer.isBuffer(result.attachments[0]?.content)).toBe(true);
  });

  it("falls back to the blank-pixel data URI when no source can be resolved for the item", async () => {
    const theItem = item({ posterUrl: "http://source.local/poster.jpg" });
    const { items, placeholders } = preparePosterPlaceholders([theItem]);
    const token = items[0]!.posterUrl!;
    const html = renderedHtml(token);

    const result = await resolvePosterPlaceholders(html, placeholders, () => undefined);

    expect(result.html).not.toContain(token);
    expect(result.html).toContain("data:image/gif;base64,");
    expect(result.attachments).toEqual([]);
  });

  it("falls back to the blank-pixel data URI when the adapter doesn't implement fetchImageBytes", async () => {
    const theItem = item({ posterUrl: "http://source.local/poster.jpg" });
    const { items, placeholders } = preparePosterPlaceholders([theItem]);
    const html = renderedHtml(items[0]!.posterUrl!);

    const result = await resolvePosterPlaceholders(html, placeholders, () => source(fakeAdapter(undefined)));

    expect(result.html).toContain("data:image/gif;base64,");
    expect(result.attachments).toEqual([]);
  });

  it("falls back to the blank-pixel data URI when fetchImageBytes resolves to null", async () => {
    const theItem = item({ posterUrl: "http://source.local/poster.jpg" });
    const { items, placeholders } = preparePosterPlaceholders([theItem]);
    const html = renderedHtml(items[0]!.posterUrl!);

    const result = await resolvePosterPlaceholders(html, placeholders, () => source(fakeAdapter(async () => null)));

    expect(result.html).toContain("data:image/gif;base64,");
    expect(result.attachments).toEqual([]);
  });

  it("falls back to the blank-pixel data URI when fetchImageBytes throws", async () => {
    const theItem = item({ posterUrl: "http://source.local/poster.jpg" });
    const { items, placeholders } = preparePosterPlaceholders([theItem]);
    const html = renderedHtml(items[0]!.posterUrl!);

    const result = await resolvePosterPlaceholders(
      html,
      placeholders,
      () =>
        source(
          fakeAdapter(async () => {
            throw new Error("ECONNREFUSED");
          }),
        ),
    );

    expect(result.html).toContain("data:image/gif;base64,");
    expect(result.attachments).toEqual([]);
  });

  it("falls back to the blank-pixel data URI when the fetched bytes aren't a decodable image", async () => {
    const theItem = item({ posterUrl: "http://source.local/poster.jpg" });
    const { items, placeholders } = preparePosterPlaceholders([theItem]);
    const html = renderedHtml(items[0]!.posterUrl!);

    const fetchImageBytes = async (): Promise<FetchedImage | null> => ({
      data: new Uint8Array([1, 2, 3, 4]),
      contentType: "image/jpeg",
    });

    const result = await resolvePosterPlaceholders(html, placeholders, () => source(fakeAdapter(fetchImageBytes)));

    expect(result.html).toContain("data:image/gif;base64,");
    expect(result.attachments).toEqual([]);
  });

  it("continues past a failed item and still embeds the rest", async () => {
    const good = item({ id: "good", posterUrl: "http://source.local/good.jpg" });
    const bad = item({ id: "bad", posterUrl: "http://source.local/bad.jpg" });
    const { items, placeholders } = preparePosterPlaceholders([bad, good]);
    const html = renderedHtml(items[0]!.posterUrl!, items[1]!.posterUrl!);

    const fetchImageBytes = async (_config: SourceConnectionConfig, target: NewItem): Promise<FetchedImage | null> =>
      target.id === "bad" ? null : { data: TINY_PNG, contentType: "image/png" };

    const result = await resolvePosterPlaceholders(html, placeholders, () => source(fakeAdapter(fetchImageBytes)));

    expect(result.html).toContain("data:image/gif;base64,");
    expect(result.html).toContain("cid:poster-0@latestarr");
    expect(result.attachments).toHaveLength(1);
  });

  it("resolves several referenced items concurrently, not one at a time", async () => {
    const items = Array.from({ length: 5 }, (_, i) => item({ id: String(i), posterUrl: `http://source.local/${i}.jpg` }));
    const { items: placed, placeholders } = preparePosterPlaceholders(items);
    const html = renderedHtml(...placed.map((i) => i.posterUrl!));

    let concurrentCalls = 0;
    let maxConcurrentCalls = 0;
    const fetchImageBytes = async (): Promise<FetchedImage | null> => {
      concurrentCalls++;
      maxConcurrentCalls = Math.max(maxConcurrentCalls, concurrentCalls);
      await new Promise((resolve) => setTimeout(resolve, 5));
      concurrentCalls--;
      return { data: TINY_PNG, contentType: "image/png" };
    };

    const result = await resolvePosterPlaceholders(html, placeholders, () => source(fakeAdapter(fetchImageBytes)));

    expect(result.attachments).toHaveLength(5);
    expect(maxConcurrentCalls).toBeGreaterThan(1);
  });

  it("gives each embedded item a unique, filename-collision-free cid", async () => {
    const items = [
      item({ id: "1", posterUrl: "http://source.local/1.jpg" }),
      item({ id: "2", posterUrl: "http://source.local/2.jpg" }),
    ];
    const { items: placed, placeholders } = preparePosterPlaceholders(items);
    const html = renderedHtml(...placed.map((i) => i.posterUrl!));

    const fetchImageBytes = async (): Promise<FetchedImage | null> => ({ data: TINY_PNG, contentType: "image/png" });
    const result = await resolvePosterPlaceholders(html, placeholders, () => source(fakeAdapter(fetchImageBytes)));

    expect(new Set(result.attachments.map((a) => a.cid)).size).toBe(2);
    expect(new Set(result.attachments.map((a) => a.filename)).size).toBe(2);
  });

  it("resizes a larger image down to the thumbnail bound instead of shipping it full size", async () => {
    const sharp = (await import("sharp")).default;
    const largeSource = await sharp({
      create: { width: 800, height: 600, channels: 3, background: { r: 10, g: 20, b: 30 } },
    })
      .png()
      .toBuffer();

    const theItem = item({ posterUrl: "http://source.local/big.png" });
    const { items, placeholders } = preparePosterPlaceholders([theItem]);
    const html = renderedHtml(items[0]!.posterUrl!);

    const fetchImageBytes = async (): Promise<FetchedImage | null> => ({
      data: largeSource,
      contentType: "image/png",
    });

    const result = await resolvePosterPlaceholders(html, placeholders, () => source(fakeAdapter(fetchImageBytes)));

    const metadata = await sharp(result.attachments[0]!.content).metadata();
    expect(metadata.width).toBeLessThanOrEqual(240);
    expect(metadata.height).toBeLessThanOrEqual(240);
    expect(result.attachments[0]!.content.length).toBeLessThan(largeSource.length);
  });
});
