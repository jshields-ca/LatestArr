import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createDb, type Db, designImages, runMigrations, templates } from "@latestarr/db";
import sharp from "sharp";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { logger } from "../logger.js";
import { parseDesignSettings } from "../render/design.js";
import { cleanImage, fetchLogoImage, pruneUnusedDesignImages, resolveLogo, UnsupportedImageError } from "./design-logo.js";

const log = logger.child({});

function png(width = 40, height = 20, withMetadata = false): Promise<Buffer> {
  const image = sharp({ create: { width, height, channels: 4, background: { r: 200, g: 30, b: 70, alpha: 1 } } }).png();
  return (withMetadata ? image.withMetadata({ exif: { IFD0: { Copyright: "secret-location" } } }) : image).toBuffer();
}

let dir: string;
let db: Db;

beforeEach(() => {
  dir = mkdtempSync(path.join(tmpdir(), "latestarr-logo-test-"));
  db = createDb(path.join(dir, "test.db"));
  runMigrations(db);
});

afterEach(() => {
  vi.unstubAllGlobals();
  db.$client.close();
  if (existsSync(dir)) rmSync(dir, { recursive: true, force: true });
});

async function storeImage(width = 40, createdAt = new Date()) {
  const image = await cleanImage(await png(width, 20));
  const [row] = await db.insert(designImages).values({ ...image, createdAt }).returning();
  return row!;
}

function respondWith(body: Buffer | string, init: ResponseInit) {
  const fetchMock = vi.fn(async () => new Response(body, init));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("cleanImage", () => {
  it("keeps a PNG a PNG, without its metadata", async () => {
    const input = await png(40, 20, true);
    expect((await sharp(input).metadata()).exif).toBeDefined();

    const image = await cleanImage(input);
    expect(image).toMatchObject({ contentType: "image/png", width: 40, height: 20 });
    const meta = await sharp(image.content).metadata();
    expect(meta.format).toBe("png");
    expect(meta.exif).toBeUndefined();
  });

  it("scales down an image wider than a logo ever needs", async () => {
    const image = await cleanImage(await png(3000, 300));
    expect(image.width).toBe(1100);
    expect(image.height).toBe(110);
  });

  it("refuses SVG, with a reason", async () => {
    const svg = Buffer.from('﻿<?xml version="1.0"?>\n<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');
    await expect(cleanImage(svg)).rejects.toThrow(/SVG images aren't supported/);
  });

  it("refuses formats email clients don't reliably show", async () => {
    const webp = await sharp(await png()).webp().toBuffer();
    await expect(cleanImage(webp)).rejects.toThrow("Use a PNG, JPEG or GIF image.");
  });

  it("refuses a file that isn't an image, whatever it's called", async () => {
    await expect(cleanImage(Buffer.from("<html>not an image</html>"))).rejects.toBeInstanceOf(UnsupportedImageError);
  });
});

describe("fetchLogoImage", () => {
  it("downloads and cleans up an image", async () => {
    respondWith(await png(), { status: 200, headers: { "content-type": "image/png" } });
    await expect(fetchLogoImage("https://example.com/logo.png")).resolves.toMatchObject({ contentType: "image/png", width: 40 });
  });

  it("refuses a response that isn't an image", async () => {
    respondWith("<html></html>", { status: 200, headers: { "content-type": "text/html; charset=utf-8" } });
    await expect(fetchLogoImage("https://example.com/logo.png")).rejects.toThrow("it isn't an image (text/html)");
  });

  it("refuses an error response", async () => {
    respondWith("gone", { status: 404 });
    await expect(fetchLogoImage("https://example.com/logo.png")).rejects.toThrow("the server answered 404");
  });
});

describe("resolveLogo", () => {
  it("is nothing without a logo", async () => {
    await expect(resolveLogo(db, parseDesignSettings({}), { fetchUrls: true, log })).resolves.toEqual({ attachments: [] });
  });

  it("embeds an upload, and its dark-mode version", async () => {
    const light = await storeImage(40);
    const dark = await storeImage(60);
    const settings = parseDesignSettings({
      logo: { source: "upload", imageId: light.id, darkImageId: dark.id, maxWidth: 50, link: "https://plex.example.com", alt: "My server" },
    });

    const { logo, attachments } = await resolveLogo(db, settings, { fetchUrls: false, log });
    expect(logo).toEqual({
      src: "cid:logo@latestarr",
      darkSrc: "cid:logo-dark@latestarr",
      // Never wider than the image itself, or than the design allows.
      width: 40,
      darkWidth: 50,
      href: "https://plex.example.com",
      alt: "My server",
    });
    expect(attachments.map((a) => [a.cid, a.filename, a.contentType])).toEqual([
      ["logo@latestarr", "logo.png", "image/png"],
      ["logo-dark@latestarr", "logo-dark.png", "image/png"],
    ]);
  });

  it("uses the dark-mode image in a dark design", async () => {
    const light = await storeImage(40);
    const dark = await storeImage(60);
    const settings = parseDesignSettings({
      colors: { background: "#111111", text: "#eeeeee" },
      logo: { source: "upload", imageId: light.id, darkImageId: dark.id },
    });

    const { logo, attachments } = await resolveLogo(db, settings, { fetchUrls: true, log });
    expect(logo).toMatchObject({ src: "cid:logo-dark@latestarr", width: 60, darkSrc: undefined });
    expect(attachments.map((a) => a.cid)).toEqual(["logo-dark@latestarr"]);
  });

  it("leaves out an upload that's gone", async () => {
    const settings = parseDesignSettings({ logo: { source: "upload", imageId: "missing" } });
    await expect(resolveLogo(db, settings, { fetchUrls: true, log })).resolves.toEqual({ attachments: [] });
  });

  it("links to an image URL in a preview, without fetching it", async () => {
    const fetchMock = respondWith(await png(), { status: 200, headers: { "content-type": "image/png" } });
    const settings = parseDesignSettings({ logo: { source: "url", url: "https://example.com/logo.png" } });

    const { logo, attachments } = await resolveLogo(db, settings, { fetchUrls: false, log });
    expect(logo).toMatchObject({ src: "https://example.com/logo.png", width: 180 });
    expect(attachments).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("embeds a copy of an image URL when sending", async () => {
    respondWith(await png(), { status: 200, headers: { "content-type": "image/png" } });
    const settings = parseDesignSettings({ logo: { source: "url", url: "https://example.com/logo.png" } });

    const { logo, attachments } = await resolveLogo(db, settings, { fetchUrls: true, log });
    expect(logo).toMatchObject({ src: "cid:logo@latestarr", width: 40 });
    expect(attachments).toHaveLength(1);
  });

  it("links to an image URL that's set to be linked", async () => {
    const fetchMock = respondWith(await png(), { status: 200, headers: { "content-type": "image/png" } });
    const settings = parseDesignSettings({ logo: { source: "url", url: "https://example.com/logo.png", urlMode: "link" } });

    expect((await resolveLogo(db, settings, { fetchUrls: true, log })).logo?.src).toBe("https://example.com/logo.png");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("links to an image URL it couldn't embed, rather than failing the send", async () => {
    respondWith("nope", { status: 500 });
    const settings = parseDesignSettings({ logo: { source: "url", url: "https://example.com/logo.png" } });

    const { logo, attachments } = await resolveLogo(db, settings, { fetchUrls: true, log });
    expect(logo?.src).toBe("https://example.com/logo.png");
    expect(attachments).toEqual([]);
  });
});

describe("pruneUnusedDesignImages", () => {
  it("removes old images no design uses, and keeps recent or used ones", async () => {
    const dayAgo = new Date(Date.now() - 25 * 60 * 60 * 1000);
    const used = await storeImage(40, dayAgo);
    const usedDark = await storeImage(40, dayAgo);
    const unused = await storeImage(40, dayAgo);
    const recent = await storeImage(40);
    await db.insert(templates).values({
      name: "Logo",
      mode: "design",
      settings: { logo: { source: "upload", imageId: used.id, darkImageId: usedDark.id } },
    });

    expect(await pruneUnusedDesignImages(db)).toBe(1);
    const left = (await db.select({ id: designImages.id }).from(designImages)).map((row) => row.id).sort();
    expect(left).toEqual([used.id, usedDark.id, recent.id].sort());
    expect(left).not.toContain(unused.id);
  });
});
