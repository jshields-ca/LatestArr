import type { NewItem, SourceAdapter, SourceConnectionConfig } from "@latestarr/adapter-core";
import sharp from "sharp";
import type { EmailAttachment } from "../mailer/send.js";

// Keeps a sent email's total size sane — these are small list-view
// thumbnails, not full posters, so there's no reason to ship a source's
// original (often multi-megabyte) cover art byte-for-byte.
const THUMBNAIL_MAX_DIMENSION = 240;
const THUMBNAIL_JPEG_QUALITY = 80;

export interface ItemImageSource {
  adapter: SourceAdapter;
  config: SourceConnectionConfig;
}

export interface EmbedPosterImagesResult {
  /** The same items, in the same order, with posterUrl either replaced by
   * a `cid:...` reference to an entry in `attachments`, or removed
   * entirely (no image, or embedding it failed). Never a source's own URL
   * — that's the whole point: nothing in the rendered email ever points
   * back at a source server. */
  items: NewItem[];
  attachments: EmailAttachment[];
}

/**
 * Fetches each item's poster/cover image server-side (via its own
 * source's fetchImageBytes, using that source's already-stored,
 * decrypted credentials — the same ones the pipeline already uses to poll
 * the source), resizes it down to a thumbnail, and turns it into a
 * Nodemailer CID attachment. The rendered HTML then references the image
 * with `<img src="cid:...">` instead of a source URL, so a recipient's
 * mail client never makes an outbound request of its own to fetch it —
 * it just reads bytes already attached to the message. This is how
 * LatestArr shows poster art without exposing any part of a (frequently
 * LAN-only) source server publicly.
 *
 * `resolveSource` maps an item back to the adapter/config it came from —
 * a newsletter can pull from several linked sources at once, each with
 * its own credentials, so this can't be a single shared config.
 * `cidPrefix` only needs to be unique across the several pools (added /
 * mostWatched / fallback) a single render can combine, not globally.
 *
 * Fails soft, per item, by design (matching the resilience philosophy
 * mjml-template.ts's "soft" MJML validation already follows): a source
 * with no fetchImageBytes, an unreachable source, a 404, or an image
 * sharp can't decode all just drop that one item's poster rather than
 * failing the whole send.
 */
export async function embedPosterImages(
  items: NewItem[],
  resolveSource: (item: NewItem) => ItemImageSource | undefined,
  cidPrefix: string,
): Promise<EmbedPosterImagesResult> {
  const attachments: EmailAttachment[] = [];
  const resultItems: NewItem[] = [];

  for (const item of items) {
    if (!item.posterUrl) {
      resultItems.push(item);
      continue;
    }

    const withoutPoster = { ...item, posterUrl: undefined };

    const source = resolveSource(item);
    if (!source?.adapter.fetchImageBytes) {
      resultItems.push(withoutPoster);
      continue;
    }

    try {
      const fetched = await source.adapter.fetchImageBytes(source.config, item);
      if (!fetched) {
        resultItems.push(withoutPoster);
        continue;
      }

      const resized = await sharp(Buffer.from(fetched.data))
        .resize({
          width: THUMBNAIL_MAX_DIMENSION,
          height: THUMBNAIL_MAX_DIMENSION,
          fit: "inside",
          withoutEnlargement: true,
        })
        .jpeg({ quality: THUMBNAIL_JPEG_QUALITY })
        .toBuffer();

      const cid = `${cidPrefix}-${attachments.length}@latestarr`;
      attachments.push({
        filename: `poster-${attachments.length}.jpg`,
        content: resized,
        cid,
        contentType: "image/jpeg",
      });
      resultItems.push({ ...item, posterUrl: `cid:${cid}` });
    } catch {
      // A source that's gone unreachable mid-send, or an image sharp
      // can't decode (corrupt response, unexpected content type, ...) —
      // either way this one item just loses its poster, not the send.
      resultItems.push(withoutPoster);
    }
  }

  return { items: resultItems, attachments };
}
