// "Watch on Plex", "Play on RomM": a button per linked source that has a
// public URL, so a newsletter points people somewhere to watch, read, or
// play what's new. Only the public URL is used; a base URL is often an
// internal address recipients can't reach.

export interface SourceButton {
  label: string;
  url: string;
  /** Content kinds the source provides, for placing it under a section. */
  kinds: string[];
}

export interface SourceButtonInput {
  kind: string;
  name: string;
  publicUrl?: string | null;
  kinds: string[];
}

// A Tautulli source's public URL is the Plex address people watch on.
const SERVICES: Record<string, { verb: string; service: string }> = {
  plex: { verb: "Watch on", service: "Plex" },
  tautulli: { verb: "Watch on", service: "Plex" },
  jellyfin: { verb: "Watch on", service: "Jellyfin" },
  emby: { verb: "Watch on", service: "Emby" },
  booklore: { verb: "Read on", service: "BookLore" },
  bookorbit: { verb: "Read on", service: "Book Orbit" },
  grimmory: { verb: "Read on", service: "Grimmory" },
  audiobookshelf: { verb: "Listen on", service: "Audiobookshelf" },
  romm: { verb: "Play on", service: "RomM" },
};

export function buildSourceButtons(sources: SourceButtonInput[]): SourceButton[] {
  const byUrl = new Map<string, SourceButtonInput & { publicUrl: string; kinds: string[] }>();
  for (const source of sources) {
    const url = source.publicUrl?.trim();
    if (!url) continue;
    const existing = byUrl.get(url);
    // The same address twice (a Plex and its Tautulli, say) is one button.
    if (existing) existing.kinds = [...new Set([...existing.kinds, ...source.kinds])];
    else byUrl.set(url, { ...source, publicUrl: url, kinds: [...source.kinds] });
  }

  const unique = [...byUrl.values()];
  const serviceLabel = (source: SourceButtonInput) => {
    const known = SERVICES[source.kind];
    return known ? `${known.verb} ${known.service}` : `Open ${source.name}`;
  };
  const counts = new Map<string, number>();
  for (const source of unique) counts.set(serviceLabel(source), (counts.get(serviceLabel(source)) ?? 0) + 1);

  return unique.map((source) => {
    const label = serviceLabel(source);
    const known = SERVICES[source.kind];
    // Two Plex servers become "Watch on Home Plex" and "Watch on Cabin Plex".
    const distinct = counts.get(label)! > 1 && known ? `${known.verb} ${source.name}` : label;
    return { label: distinct, url: source.publicUrl, kinds: source.kinds };
  });
}
