import type { FetchedImage, NewItem, SourceAdapter, SourceConnectionConfig } from "@latestarr/adapter-core";
import { describe, expect, it } from "vitest";
import { embedPosterImages, type ItemImageSource } from "./embed-images.js";

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

describe("embedPosterImages", () => {
  it("replaces posterUrl with a cid reference and adds a matching attachment", async () => {
    const fetchImageBytes = async (): Promise<FetchedImage | null> => ({
      data: TINY_PNG,
      contentType: "image/png",
    });
    const theItem = item({ posterUrl: "http://source.local/poster.jpg" });

    const result = await embedPosterImages(
      [theItem],
      () => source(fakeAdapter(fetchImageBytes)),
      "added",
    );

    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.posterUrl).toMatch(/^cid:added-0@latestarr$/);
    expect(result.attachments).toHaveLength(1);
    expect(result.attachments[0]).toMatchObject({ cid: "added-0@latestarr", contentType: "image/jpeg" });
    expect(Buffer.isBuffer(result.attachments[0]?.content)).toBe(true);
    expect(result.attachments[0]!.content.length).toBeGreaterThan(0);
  });

  it("passes an item through unchanged when it has no posterUrl", async () => {
    const theItem = item({ posterUrl: undefined });

    const result = await embedPosterImages([theItem], () => undefined, "added");

    expect(result.items).toEqual([theItem]);
    expect(result.attachments).toEqual([]);
  });

  it("drops posterUrl when no source can be resolved for the item", async () => {
    const theItem = item({ posterUrl: "http://source.local/poster.jpg" });

    const result = await embedPosterImages([theItem], () => undefined, "added");

    expect(result.items[0]?.posterUrl).toBeUndefined();
    expect(result.attachments).toEqual([]);
  });

  it("drops posterUrl when the adapter doesn't implement fetchImageBytes", async () => {
    const theItem = item({ posterUrl: "http://source.local/poster.jpg" });

    const result = await embedPosterImages(
      [theItem],
      () => source(fakeAdapter(undefined)),
      "added",
    );

    expect(result.items[0]?.posterUrl).toBeUndefined();
    expect(result.attachments).toEqual([]);
  });

  it("drops posterUrl when fetchImageBytes resolves to null instead of failing the whole item", async () => {
    const theItem = item({ posterUrl: "http://source.local/poster.jpg" });

    const result = await embedPosterImages(
      [theItem],
      () => source(fakeAdapter(async () => null)),
      "added",
    );

    expect(result.items[0]?.posterUrl).toBeUndefined();
    expect(result.attachments).toEqual([]);
  });

  it("drops posterUrl when fetchImageBytes throws (source went unreachable mid-send)", async () => {
    const theItem = item({ posterUrl: "http://source.local/poster.jpg" });

    const result = await embedPosterImages(
      [theItem],
      () =>
        source(
          fakeAdapter(async () => {
            throw new Error("ECONNREFUSED");
          }),
        ),
      "added",
    );

    expect(result.items[0]?.posterUrl).toBeUndefined();
    expect(result.attachments).toEqual([]);
  });

  it("drops posterUrl instead of throwing when the fetched bytes aren't a decodable image", async () => {
    const theItem = item({ posterUrl: "http://source.local/poster.jpg" });
    const fetchImageBytes = async (): Promise<FetchedImage | null> => ({
      data: new Uint8Array([1, 2, 3, 4]),
      contentType: "image/jpeg",
    });

    const result = await embedPosterImages(
      [theItem],
      () => source(fakeAdapter(fetchImageBytes)),
      "added",
    );

    expect(result.items[0]?.posterUrl).toBeUndefined();
    expect(result.attachments).toEqual([]);
  });

  it("continues past a failed item and still embeds the rest", async () => {
    const good = item({ id: "good", posterUrl: "http://source.local/good.jpg" });
    const bad = item({ id: "bad", posterUrl: "http://source.local/bad.jpg" });

    const fetchImageBytes = async (_config: SourceConnectionConfig, target: NewItem): Promise<FetchedImage | null> =>
      target.id === "bad" ? null : { data: TINY_PNG, contentType: "image/png" };

    const result = await embedPosterImages(
      [bad, good],
      () => source(fakeAdapter(fetchImageBytes)),
      "added",
    );

    expect(result.items.find((i) => i.id === "bad")?.posterUrl).toBeUndefined();
    expect(result.items.find((i) => i.id === "good")?.posterUrl).toMatch(/^cid:/);
    expect(result.attachments).toHaveLength(1);
  });

  it("gives each embedded item a unique cid using the given prefix", async () => {
    const fetchImageBytes = async (): Promise<FetchedImage | null> => ({
      data: TINY_PNG,
      contentType: "image/png",
    });
    const items = [
      item({ id: "1", posterUrl: "http://source.local/1.jpg" }),
      item({ id: "2", posterUrl: "http://source.local/2.jpg" }),
    ];

    const result = await embedPosterImages(items, () => source(fakeAdapter(fetchImageBytes)), "popular");

    const cids = result.items.map((i) => i.posterUrl);
    expect(cids).toEqual(["cid:popular-0@latestarr", "cid:popular-1@latestarr"]);
    expect(new Set(result.attachments.map((a) => a.cid)).size).toBe(2);
  });

  it("resizes a larger image down to the thumbnail bound instead of shipping it full size", async () => {
    // A real 100x100 PNG built at runtime (sharp needs a genuine image, not
    // just a big buffer) so the resize step has something meaningful to do.
    const sharp = (await import("sharp")).default;
    const largeSource = await sharp({
      create: { width: 800, height: 600, channels: 3, background: { r: 10, g: 20, b: 30 } },
    })
      .png()
      .toBuffer();

    const fetchImageBytes = async (): Promise<FetchedImage | null> => ({
      data: largeSource,
      contentType: "image/png",
    });
    const theItem = item({ posterUrl: "http://source.local/big.png" });

    const result = await embedPosterImages([theItem], () => source(fakeAdapter(fetchImageBytes)), "added");

    const sharpModule = (await import("sharp")).default;
    const metadata = await sharpModule(result.attachments[0]!.content).metadata();
    expect(metadata.width).toBeLessThanOrEqual(240);
    expect(metadata.height).toBeLessThanOrEqual(240);
    expect(result.attachments[0]!.content.length).toBeLessThan(largeSource.length);
  });
});
