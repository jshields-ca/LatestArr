import { randomUUID } from "node:crypto";
import type { NewItem, SourceAdapter, SourceConnectionConfig } from "@latestarr/adapter-core";
import sharp from "sharp";
import type { EmailAttachment } from "../mailer/send.js";

// Keeps a sent email's total size sane — these are small list-view
// thumbnails, not full posters, so there's no reason to ship a source's
// original (often multi-megabyte) cover art byte-for-byte.
const THUMBNAIL_MAX_DIMENSION = 240;
const THUMBNAIL_JPEG_QUALITY = 80;

// A 1x1 fully transparent GIF, inlined — used in place of a poster that a
// Media List block's own selection logic decided to show but that
// couldn't actually be embedded (source unreachable, no fetchImageBytes,
// undecodable image, ...). Keeps "fails soft" from leaving a broken-image
// icon (or, worse, the raw placeholder token below) in a recipient's mail
// client; it's a data: URI, so it costs no outbound request either.
const BLANK_PIXEL_DATA_URI =
  "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==";

export interface ItemImageSource {
  adapter: SourceAdapter;
  config: SourceConnectionConfig;
}

export interface PosterPlaceholders {
  /** The same items, in the same order, with a real posterUrl replaced by
   * an opaque placeholder token — still a non-empty string, so a
   * template's `{{#if posterUrl}}` guard behaves exactly as it will once
   * the real cid is substituted in. An item with no posterUrl is passed
   * through unchanged. */
  items: NewItem[];
  /** Maps each placeholder token back to the original item (with its real
   * posterUrl intact), for resolvePosterPlaceholders to look up once it
   * knows which tokens actually made it into the rendered output. */
  placeholders: Map<string, NewItem>;
}

/**
 * Swaps each item's real posterUrl for an opaque placeholder token,
 * *before* the item pool is handed to the template renderer. This is
 * deliberately a separate step from actually fetching/embedding an image:
 * a Media List block's own count/order/showAll/emptyFallback selection
 * (apps/server/src/render/mjml-template.ts's `mediaList` helper) decides,
 * per block, which items out of a much larger fetched pool actually get
 * rendered — often as few as 5 out of a pool of 80+. Embedding eagerly for
 * the whole pool (the previous, buggy behavior) meant fetching, resizing,
 * and CID-attaching images for items that never appeared anywhere in the
 * sent email, directly undermining the "keep message size sane" reason
 * CID embedding exists in the first place. Placeholder tokens let the
 * template's own real selection logic run unmodified (rather than
 * duplicating it here to predict what it will pick), and
 * resolvePosterPlaceholders below only pays the fetch/resize cost for
 * whichever tokens actually show up in the rendered HTML.
 */
export function preparePosterPlaceholders(items: NewItem[]): PosterPlaceholders {
  const placeholders = new Map<string, NewItem>();
  const resultItems = items.map((item) => {
    if (!item.posterUrl) return item;
    // A UUID needs no bookkeeping to stay collision-free across pools
    // (added / mostWatched / fallback) or safe from accidental substring
    // overlap between tokens (e.g. a naive "pool:1" being a substring of
    // "pool:10") the way a hand-rolled counter-based id would.
    const token = `cid:pending:${randomUUID()}`;
    placeholders.set(token, item);
    return { ...item, posterUrl: token };
  });
  return { items: resultItems, placeholders };
}

export interface ResolvedPosterImages {
  /** The rendered HTML with every referenced placeholder token replaced
   * by a real `cid:...` reference (or the blank-pixel data URI, if that
   * one item's embed failed) — never a placeholder token, and never a
   * source's own URL. */
  html: string;
  attachments: EmailAttachment[];
}

/**
 * Scans already-rendered HTML for which of `placeholders`' tokens the
 * template's own selection logic actually used, and only fetches/resizes/
 * embeds images for those — a token that never appears in `html` at all
 * costs nothing: no network call, no sharp work, no attachment. Each
 * referenced item's image is fetched and resized concurrently (not one at
 * a time), since by construction this set is already small — it's exactly
 * what will be shown, never a source's whole library — so there's no need
 * to bound concurrency the way a raw per-source fetch loop might.
 *
 * `resolveSource` maps an item back to the adapter/config it came from —
 * a newsletter can pull from several linked sources at once, each with
 * its own credentials, so this can't be a single shared config.
 *
 * Fails soft, per item, by design (matching the resilience philosophy
 * mjml-template.ts's "soft" MJML validation already follows): a source
 * with no fetchImageBytes, an unreachable source, a 404, or an image
 * sharp can't decode all just fall back to a blank pixel for that one
 * item rather than failing the whole send.
 */
export async function resolvePosterPlaceholders(
  html: string,
  placeholders: Map<string, NewItem>,
  resolveSource: (item: NewItem) => ItemImageSource | undefined,
): Promise<ResolvedPosterImages> {
  const referenced = [...placeholders.entries()].filter(([token]) => html.includes(token));

  const results = await Promise.all(
    referenced.map(async ([token, item]) => {
      const source = resolveSource(item);
      if (!source?.adapter.fetchImageBytes) return { token, image: null };

      try {
        const fetched = await source.adapter.fetchImageBytes(source.config, item);
        if (!fetched) return { token, image: null };

        const resized = await sharp(Buffer.from(fetched.data))
          .resize({
            width: THUMBNAIL_MAX_DIMENSION,
            height: THUMBNAIL_MAX_DIMENSION,
            fit: "inside",
            withoutEnlargement: true,
          })
          .jpeg({ quality: THUMBNAIL_JPEG_QUALITY })
          .toBuffer();

        return { token, image: resized };
      } catch {
        // A source that's gone unreachable mid-send, or an image sharp
        // can't decode (corrupt response, unexpected content type, ...) —
        // either way this one item just falls back to a blank pixel, not
        // the whole send.
        return { token, image: null };
      }
    }),
  );

  let resultHtml = html;
  const attachments: EmailAttachment[] = [];

  for (const { token, image } of results) {
    if (!image) {
      resultHtml = resultHtml.split(token).join(BLANK_PIXEL_DATA_URI);
      continue;
    }

    const cid = `poster-${attachments.length}@latestarr`;
    attachments.push({
      filename: `poster-${attachments.length}.jpg`,
      content: image,
      cid,
      contentType: "image/jpeg",
    });
    resultHtml = resultHtml.split(token).join(`cid:${cid}`);
  }

  return { html: resultHtml, attachments };
}
