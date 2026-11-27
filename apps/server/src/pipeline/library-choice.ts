// Which libraries a newsletter reads from each linked source (#483). A
// source left on "All libraries" reads every library; one set to "Only
// these" reads just those, so a private library (a 4K copy, or one kept
// to yourself) never reaches recipients.
//
// A Plex server and the Tautulli watching it return the same items, and
// their library ids are the same (Tautulli's section_id is Plex's section
// key). So the libraries chosen on either one hold for both: otherwise
// leaving a library out on Plex would still let its items in through
// Tautulli, and the other way round.

export interface LinkForChoice {
  sourceId: string;
  sourceName: string;
  /** The libraries chosen on this link, or null for all of them. */
  libraryFilter: string[] | null;
  /** Whether the source can say which server it reads (Plex, Tautulli). */
  canShareServer: boolean;
}

export type LibraryChoice =
  /** Read these libraries only; undefined reads every one. */
  | { read: true; libraries: string[] | undefined }
  /**
   * Read nothing from this source, and why. `unsure` when it's because a
   * source couldn't say which server it reads (it's usually unreachable),
   * which the send treats as a failure rather than going out without it.
   */
  | { read: false; reason: string; unsure?: true };

function chosen(link: LinkForChoice): string[] | undefined {
  // An empty list, which linking accepted before #483, meant every library.
  return link.libraryFilter && link.libraryFilter.length > 0 ? link.libraryFilter : undefined;
}

/**
 * Each link's libraries, by source id. `serverIds` is from
 * resolveServerIds: sources with the same one read the same server.
 */
export function libraryChoices(links: LinkForChoice[], serverIds: Map<string, string>): Map<string, LibraryChoice> {
  const choices = new Map<string, LibraryChoice>();
  for (const link of links) {
    const serverId = serverIds.get(link.sourceId);

    // The libraries every link on this server allows.
    let libraries = chosen(link);
    if (serverId) {
      for (const other of links) {
        if (other === link || serverIds.get(other.sourceId) !== serverId) continue;
        const theirs = chosen(other);
        if (theirs) libraries = libraries ? libraries.filter((id) => theirs.includes(id)) : theirs;
      }
    }
    if (libraries?.length === 0) {
      choices.set(link.sourceId, {
        read: false,
        reason: `"${link.sourceName}" has no libraries left to read: the sources here that read the same server have no chosen library in common`,
      });
      continue;
    }

    // A source with libraries chosen that might read the same server, but
    // one of the two couldn't say which it reads. Reading more than it
    // allows could let a left-out library in, so this source is skipped
    // this time.
    const unsure = link.canShareServer
      ? links.find((other) => {
          if (other === link || !other.canShareServer) return false;
          const theirs = chosen(other);
          if (!theirs || (serverId && serverIds.get(other.sourceId))) return false;
          return !libraries || libraries.some((id) => !theirs.includes(id));
        })
      : undefined;
    choices.set(
      link.sourceId,
      unsure
        ? {
            read: false,
            unsure: true,
            reason: `"${link.sourceName}" couldn't be checked against "${unsure.sourceName}", which may read the same server and has libraries left out. Check that both can be reached.`,
          }
        : { read: true, libraries: libraries && [...new Set(libraries)] },
    );
  }
  return choices;
}
