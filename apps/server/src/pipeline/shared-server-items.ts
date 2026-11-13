import type { NewItem } from "@latestarr/adapter-core";

// A newsletter can link two sources that read the same server: a Plex
// server and the Tautulli that watches it (Tautulli adds "Most watched").
// Both return the same new items, so without this each was listed twice
// and every count was doubled (#391).

export interface FetchedFromSource {
  /** For the log line. */
  sourceName: string;
  /** From the adapter's getServerId: sources with the same one read the
   * same server. Undefined when the source has none or couldn't say. */
  serverId: string | undefined;
  /** True for an app that reads another server's library (Tautulli)
   * rather than being the server. The server's own copy is the one kept. */
  readsAnotherServer: boolean;
  items: NewItem[];
}

export interface MergedItems {
  items: NewItem[];
  /** What was left out, per pair of sources, for the log. */
  leftOut: { from: string; keptFrom: string; count: number }[];
}

// Details copied onto the kept copy when it lacks them and the other copy
// has them (Tautulli knows genres; Plex's list doesn't carry them). The
// poster is not among them: an image is fetched through the source its
// item came from.
const FILLABLE = [
  "subtitle",
  "overview",
  "releaseDate",
  "contentLabel",
  "genres",
  "rating",
  "runtimeMinutes",
  "libraryName",
  "externalUrl",
  "seasonUrl",
  "seriesUrl",
] as const satisfies readonly (keyof NewItem)[];

function fillGaps(kept: NewItem, other: NewItem): void {
  for (const field of FILLABLE) {
    const value = other[field];
    if (kept[field] === undefined && value !== undefined) Object.assign(kept, { [field]: value });
  }
}

/**
 * Lists each item once when sources share a server. Two items are the same
 * when their sources report the same server id and they have the same
 * `externalId` (for Plex and Tautulli, Plex's rating key). Sources with
 * different server ids, or none, are never merged: rating keys are small
 * numbers, so two servers' keys collide all the time.
 *
 * The copy kept is the server's own if one of the sources is the server
 * (Plex over Tautulli), otherwise the first. It keeps its place in the list
 * and gains any details only the other copy had. Repeats within one source
 * are left alone.
 */
export function mergeSharedServerItems(fetched: FetchedFromSource[]): MergedItems {
  const items: NewItem[] = [];
  const kept = new Map<string, { index: number; source: number }>();
  const leftOut = new Map<string, { from: string; keptFrom: string; count: number }>();
  const countLeftOut = (from: FetchedFromSource, keptFrom: FetchedFromSource) => {
    const key = `${fetched.indexOf(from)}>${fetched.indexOf(keptFrom)}`;
    const entry = leftOut.get(key) ?? { from: from.sourceName, keptFrom: keptFrom.sourceName, count: 0 };
    entry.count += 1;
    leftOut.set(key, entry);
  };

  fetched.forEach((group, source) => {
    for (const item of group.items) {
      const key = group.serverId ? `${group.serverId}\n${item.externalId}` : undefined;
      const earlier = key ? kept.get(key) : undefined;
      if (!key || !earlier || earlier.source === source) {
        if (key && !earlier) kept.set(key, { index: items.length, source });
        items.push(item);
        continue;
      }
      const earlierGroup = fetched[earlier.source]!;
      const earlierItem = items[earlier.index]!;
      if (earlierGroup.readsAnotherServer && !group.readsAnotherServer) {
        // The server's own copy takes the earlier one's place.
        fillGaps(item, earlierItem);
        items[earlier.index] = item;
        kept.set(key, { index: earlier.index, source });
        countLeftOut(earlierGroup, group);
      } else {
        fillGaps(earlierItem, item);
        countLeftOut(group, earlierGroup);
      }
    }
  });

  return { items, leftOut: [...leftOut.values()] };
}
