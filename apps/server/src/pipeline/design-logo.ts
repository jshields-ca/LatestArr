import { MAX_IMAGE_BYTES, readBytesCapped, SOURCE_REQUEST_TIMEOUT_MS } from "@latestarr/adapter-core";
import { type Db, designImages, templates } from "@latestarr/db";
import { inArray } from "drizzle-orm";
import sharp from "sharp";
import type { Logger } from "../logger.js";
import type { EmailAttachment } from "../mailer/send.js";
import { type DesignSettings, isDarkDesign, LOGO_MAX_WIDTH } from "../render/design.js";
import type { LogoContext } from "../render/mjml-template.js";

// A design's logo (#302): cleaning up an uploaded or fetched image, and
// turning the design's logo options into what the template renders.

/** The largest image file an editor can upload. */
export const MAX_UPLOAD_BYTES = 1024 * 1024;
// Stored at up to twice the widest a logo is shown, so it stays sharp on
// high-density screens without making every email heavy.
const STORED_MAX_WIDTH = LOGO_MAX_WIDTH * 2;
// Same guard as posters: a huge (or "bomb") image fails instead of using
// up the server's memory.
const MAX_INPUT_PIXELS = 40_000_000;
// Unused uploads are kept this long, so an image uploaded in a design that
// hasn't been saved yet isn't removed from under it.
const UNUSED_IMAGE_GRACE_MS = 24 * 60 * 60 * 1000;

const CONTENT_TYPES = { png: "image/png", jpeg: "image/jpeg", gif: "image/gif" } as const;
type LogoFormat = keyof typeof CONTENT_TYPES;

// SVG is XML text: "<svg", possibly after an XML declaration, comments or
// a doctype. trimStart also drops a byte-order mark.
function looksLikeSvg(input: Buffer): boolean {
  const start = input.subarray(0, 1024).toString("utf8").trimStart().toLowerCase();
  return start.startsWith("<svg") || (start.startsWith("<") && start.includes("<svg"));
}

/** An image LatestArr won't use as a logo, with a message for the editor. */
export class UnsupportedImageError extends Error {}

export interface CleanImage {
  content: Buffer;
  contentType: string;
  width: number;
  height: number;
}

/**
 * Checks `input` is a PNG, JPEG or GIF by its contents (not its name), and
 * re-encodes it: metadata (camera details, location) is dropped, a photo
 * is turned the right way up, and anything wider than needed is scaled
 * down. SVG is refused: most email clients don't show it, and it can
 * carry scripts.
 */
export async function cleanImage(input: Buffer): Promise<CleanImage> {
  // Checked first: sharp can't read every SVG, and this one deserves its
  // own reason.
  if (looksLikeSvg(input)) {
    throw new UnsupportedImageError("SVG images aren't supported, because most email clients don't show them. Save it as a PNG instead.");
  }
  let format: string | undefined;
  try {
    ({ format } = await sharp(input, { limitInputPixels: MAX_INPUT_PIXELS }).metadata());
  } catch {
    throw new UnsupportedImageError("That file isn't an image LatestArr can read. Use a PNG, JPEG or GIF.");
  }
  if (!format || !(format in CONTENT_TYPES)) {
    throw new UnsupportedImageError("Use a PNG, JPEG or GIF image.");
  }
  const logoFormat = format as LogoFormat;

  // An animated GIF keeps its frames.
  let image = sharp(input, { limitInputPixels: MAX_INPUT_PIXELS, animated: logoFormat === "gif" });
  if (logoFormat === "jpeg") image = image.rotate();
  image = image.resize({ width: STORED_MAX_WIDTH, withoutEnlargement: true });
  image = logoFormat === "png" ? image.png() : logoFormat === "jpeg" ? image.jpeg({ quality: 88 }) : image.gif();
  try {
    const { data, info } = await image.toBuffer({ resolveWithObject: true });
    return {
      content: data,
      contentType: CONTENT_TYPES[logoFormat],
      width: info.width,
      height: info.pageHeight ?? info.height,
    };
  } catch {
    throw new UnsupportedImageError("That image couldn't be read. Try saving it again as a PNG.");
  }
}

/**
 * Downloads a logo from an image URL, for a design that embeds a copy.
 * Same limits as posters: a timeout, a size cap, and an image content
 * type only. Throws when it can't be used.
 */
export async function fetchLogoImage(url: string): Promise<CleanImage> {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(SOURCE_REQUEST_TIMEOUT_MS),
    headers: { accept: "image/png,image/jpeg,image/gif;q=0.9,image/*;q=0.5" },
  });
  if (!response.ok) {
    await response.body?.cancel().catch(() => undefined);
    throw new Error(`the server answered ${response.status}`);
  }
  const contentType = response.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase() ?? "";
  if (!contentType.startsWith("image/")) {
    await response.body?.cancel().catch(() => undefined);
    throw new Error(`it isn't an image (${contentType || "no content type"})`);
  }
  const bytes = await readBytesCapped(response, MAX_IMAGE_BYTES);
  if (!bytes) throw new Error("it's larger than 20 MB");
  return cleanImage(Buffer.from(bytes));
}

export interface ResolvedLogo {
  logo?: LogoContext;
  /** The logo's inline attachments, referenced as cid: from `logo`. */
  attachments: EmailAttachment[];
}

interface LogoImage {
  /** An http(s) URL, or a cid: reference to one of `attachments`. */
  src: string;
  /** Known for an embedded image; a linked one is shown at the set width. */
  width?: number;
}

/**
 * What a design's logo renders as. Uploads are always embedded. An image
 * URL is fetched and embedded when the design asks for that and
 * `fetchUrls` is set (a real send); otherwise (a preview, which anyone
 * signed in can run) the email links to it, so the server never fetches
 * an address on a viewer's behalf. A logo that can't be loaded is left
 * out (a "replace the name" logo then shows the name), never failing the
 * send.
 */
export async function resolveLogo(
  db: Db,
  settings: DesignSettings,
  options: { fetchUrls: boolean; log: Logger },
): Promise<ResolvedLogo> {
  const { logo } = settings;
  if (logo.source === "none") return { attachments: [] };
  const attachments: EmailAttachment[] = [];

  const embed = (image: CleanImage, name: "logo" | "logo-dark"): LogoImage => {
    const cid = `${name}@latestarr`;
    attachments.push({
      filename: `${name}.${image.contentType.split("/")[1]!}`,
      content: image.content,
      cid,
      contentType: image.contentType,
    });
    return { src: `cid:${cid}`, width: image.width };
  };

  let light: LogoImage | undefined;
  let dark: LogoImage | undefined;
  if (logo.source === "upload") {
    const ids = [logo.imageId, logo.darkImageId].filter((id): id is string => Boolean(id));
    const rows = ids.length > 0 ? await db.select().from(designImages).where(inArray(designImages.id, ids)) : [];
    const byId = new Map(rows.map((row) => [row.id, row]));
    const lightRow = logo.imageId ? byId.get(logo.imageId) : undefined;
    const darkRow = logo.darkImageId ? byId.get(logo.darkImageId) : undefined;
    if (logo.imageId && !lightRow) options.log.warn("The design's logo image is missing, so it's left out");
    if (lightRow) light = embed(lightRow, "logo");
    if (darkRow) dark = embed(darkRow, "logo-dark");
  } else {
    const load = async (url: string | null, name: "logo" | "logo-dark"): Promise<LogoImage | undefined> => {
      if (!url) return undefined;
      if (!options.fetchUrls || logo.urlMode === "link") return { src: url };
      try {
        return embed(await fetchLogoImage(url), name);
      } catch (err) {
        const reason = err instanceof Error ? err.message : String(err);
        options.log.warn({ err }, `Couldn't embed the design's logo from ${url} (${reason}), so the email links to it instead`);
        return { src: url };
      }
    };
    [light, dark] = await Promise.all([load(logo.url, "logo"), load(logo.darkUrl, "logo-dark")]);
  }

  // A dark design always has a dark background, so its dark-mode logo is
  // the one to show.
  if (dark && isDarkDesign(settings)) {
    light = dark;
    dark = undefined;
  }
  if (!light) return { attachments: [] };

  const shownWidth = (image: LogoImage) => Math.min(logo.maxWidth, image.width ?? logo.maxWidth);
  return {
    logo: {
      src: light.src,
      darkSrc: dark?.src,
      width: shownWidth(light),
      darkWidth: dark ? shownWidth(dark) : undefined,
      href: logo.link ?? undefined,
      alt: logo.alt || undefined,
    },
    attachments: attachments.filter((attachment) => [light.src, dark?.src].includes(`cid:${attachment.cid}`)),
  };
}

/**
 * Removes uploaded images no design uses, once they're old enough that
 * they can't belong to a design still being edited.
 */
export async function pruneUnusedDesignImages(db: Db, now = new Date()): Promise<number> {
  const inUse = new Set<string>();
  for (const { settings } of await db.select({ settings: templates.settings }).from(templates)) {
    const logo = (settings as { logo?: { imageId?: unknown; darkImageId?: unknown } } | null)?.logo;
    for (const id of [logo?.imageId, logo?.darkImageId]) if (typeof id === "string") inUse.add(id);
  }
  const cutoff = now.getTime() - UNUSED_IMAGE_GRACE_MS;
  const unused = (await db.select({ id: designImages.id, createdAt: designImages.createdAt }).from(designImages))
    .filter((image) => !inUse.has(image.id) && image.createdAt.getTime() < cutoff)
    .map((image) => image.id);
  if (unused.length > 0) await db.delete(designImages).where(inArray(designImages.id, unused));
  return unused.length;
}
