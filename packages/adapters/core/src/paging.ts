// Reading "what's new" from a source: its newest items, page by page, back
// to the start of the newsletter's lookback window. A fixed count missed
// items on a busy week (one count is shared by all of a source's
// libraries), so adapters read until they reach older items instead,
// within a safety cap.

/** Items asked for per request. BookOrbit and BookLore accept at most 100. */
export const RECENT_PAGE_SIZE = 100;

/**
 * The most items read from one source (one library, for Audiobookshelf) in
 * one fetch, so a first send, a misconfigured lookback, or a bulk import of
 * thousands of items can't turn into an unbounded crawl. Reaching it means
 * there may be more; the pipeline logs that.
 */
export const MAX_RECENT_ITEMS = 1000;

export interface ReadNewestOptions<T> {
  /** One page, newest first: `size` items starting at `offset`. `offset` is
   *  always a multiple of `size`, so `offset / size` is the page index. */
  fetchPage: (offset: number, size: number) => Promise<T[]>;
  /** When an item was added; an item without a date doesn't stop paging. */
  addedAt: (item: T) => Date | undefined;
  /** Identifies an item, so a source that ignores paging (and returns the
   * same page again) stops the loop instead of repeating it. */
  key: (item: T) => string;
  /** The start of the lookback window. */
  since: Date;
  /** A fixed number of items instead of paging back to `since`. */
  limit?: number;
  /** Called when reading stopped at MAX_RECENT_ITEMS with newer items
   *  possibly left unread. Not called for an explicit `limit`. */
  onCapReached?: () => void;
}

/**
 * Reads pages until one reaches items older than `since`, comes back short,
 * adds nothing new, or the total reaches the cap (`limit`, or
 * MAX_RECENT_ITEMS). The first page's errors are thrown, as before; a later
 * page's error ends the read with what was already fetched, since a partial
 * list is more useful to a send than none.
 */
export async function readNewest<T>(options: ReadNewestOptions<T>): Promise<T[]> {
  const max = options.limit ?? MAX_RECENT_ITEMS;
  const pageSize = Math.min(RECENT_PAGE_SIZE, max);
  const items: T[] = [];
  const seen = new Set<string>();
  let offset = 0;
  let finished = false;

  while (items.length < max) {
    let page: T[];
    try {
      page = await options.fetchPage(offset, pageSize);
    } catch (err) {
      if (items.length === 0) throw err;
      finished = true;
      break;
    }
    const fresh = page.filter((item) => !seen.has(options.key(item)));
    for (const item of fresh) {
      seen.add(options.key(item));
      items.push(item);
    }
    offset += pageSize;
    if (fresh.length === 0 || page.length < pageSize) {
      finished = true;
      break;
    }
    // Pages are newest first, so once a page reaches past `since`, the rest
    // are older still. The oldest in the page decides, in case a source
    // sorts within a page by something else (BookLore's OPDS sort order).
    const reachedOlder = page.some((item) => {
      const added = options.addedAt(item);
      return added !== undefined && added < options.since;
    });
    if (reachedOlder) {
      finished = true;
      break;
    }
  }
  if (!finished && options.limit === undefined) options.onCapReached?.();
  return items.slice(0, max);
}
