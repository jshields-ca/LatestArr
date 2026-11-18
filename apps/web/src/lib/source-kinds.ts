// What a newsletter takes from a linked source (#354), in the groups people
// choose between: TV covers episodes and seasons, Music is albums. Mirrors
// the design's sections (DESIGN_SECTIONS in lib/design.ts).

export interface KindGroup {
  label: string;
  kinds: string[];
}

const KIND_GROUPS: KindGroup[] = [
  { label: "Movies", kinds: ["movie"] },
  { label: "TV", kinds: ["tv_episode", "tv_season"] },
  { label: "Books", kinds: ["book"] },
  { label: "Audiobooks", kinds: ["audiobook"] },
  { label: "Games", kinds: ["game"] },
  { label: "Music", kinds: ["album"] },
];

export interface LinkedSourceKinds {
  mediaKinds: string[];
  defaultMediaKinds: string[];
  /** What was chosen for this newsletter; null follows the source's defaults. */
  mediaTypeFilter: string[] | null;
}

/** The groups a source has, each with only the kinds it really has. */
export function kindGroupsOf(mediaKinds: string[]): KindGroup[] {
  return KIND_GROUPS.map((group) => ({ ...group, kinds: group.kinds.filter((kind) => mediaKinds.includes(kind)) })).filter(
    (group) => group.kinds.length > 0,
  );
}

// An empty filter, which linking allowed before #354, follows the defaults.
export function includedKinds(source: LinkedSourceKinds): string[] {
  return source.mediaTypeFilter?.length ? source.mediaTypeFilter : source.defaultMediaKinds;
}

export function isGroupIncluded(source: LinkedSourceKinds, group: KindGroup): boolean {
  const included = includedKinds(source);
  return group.kinds.some((kind) => included.includes(kind));
}

/** The filter after turning one group on or off, in the source's own
 * order. Null when that's just the source's defaults, so the newsletter
 * keeps following them. */
export function toggledFilter(source: LinkedSourceKinds, group: KindGroup): string[] | null {
  const included = new Set(includedKinds(source));
  const on = isGroupIncluded(source, group);
  for (const kind of group.kinds) {
    if (on) included.delete(kind);
    else included.add(kind);
  }
  const next = source.mediaKinds.filter((kind) => included.has(kind));
  const defaults = source.mediaKinds.filter((kind) => source.defaultMediaKinds.includes(kind));
  return next.length === defaults.length && next.every((kind, i) => kind === defaults[i]) ? null : next;
}
