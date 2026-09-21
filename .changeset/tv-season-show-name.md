---
"@latestarr/server": patch
---

**Fixed:** A newly added TV season now shows the show's name (e.g. "Breaking Bad") as its title, with the season itself (e.g. "Season 1") as the subtitle — previously it just showed "Season 1" with no indication of which show it belonged to, the same problem episodes had before an earlier fix.

<details>
<summary>Technical details</summary>

Both `packages/adapters/plex/src/plex-adapter.ts` and `packages/adapters/tautulli/src/tautulli-adapter.ts` already had this fix for `tv_episode` items (promoting the show name from `grandparentTitle`/`grandparent_title` into the primary title, demoting the episode's own name to the subtitle via `buildEpisodeTitle`/`buildEpisodeSubtitle`), but had no equivalent for `tv_season` items.

Added mirrored `buildSeasonTitle`/`buildSeasonSubtitle` helpers to both adapters. Plex's `PlexMetadataItem` already declared `parentTitle` (the direct-parent show name, one level up from a season — not `grandparentTitle`, which is two levels up and only populated for episodes) but it was never read; it's now used the same way `grandparentTitle` is for episodes. Tautulli's `TautulliRecentlyAddedItem` had no equivalent field, so a `parent_title?: string` field was added to it (mirroring the existing `grandparent_title`/`parent_media_index` fields already proxied through from the underlying Plex server).

Both fixes fall back to the season's own bare title with no subtitle when the parent-title field is absent, matching the existing defensive pattern for episodes without a `grandparentTitle`/`grandparent_title`. Test cases covering both the happy path and the fallback were added to `plex-adapter.test.ts` and `tautulli-adapter.test.ts`.

</details>
