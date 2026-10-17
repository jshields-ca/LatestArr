// Limits every adapter applies to a source's responses, so a slow, broken,
// or hostile source can't hang a send or the scheduler, or fill memory.

/** How long any one API request to a source may take. */
export const SOURCE_REQUEST_TIMEOUT_MS = 30_000;

/** How long downloading one poster or cover image may take. The send
 *  waits on every poster at once (apps/server/src/pipeline/embed-images.ts),
 *  so a server that hangs instead of erroring must not stall the whole send:
 *  that image is left out instead. */
export const IMAGE_REQUEST_TIMEOUT_MS = 10_000;

/** The largest poster or cover image LatestArr will download. */
export const MAX_IMAGE_BYTES = 20 * 1024 * 1024;

/**
 * Reads a response body up to `maxBytes`, or returns null (and stops
 * downloading) when it's larger, whether or not it says so up front.
 */
export async function readBytesCapped(response: Response, maxBytes = MAX_IMAGE_BYTES): Promise<Uint8Array | null> {
  const declared = Number(response.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > maxBytes) {
    await response.body?.cancel().catch(() => undefined);
    return null;
  }
  if (!response.body) return new Uint8Array(await response.arrayBuffer());

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel().catch(() => undefined);
      return null;
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}
