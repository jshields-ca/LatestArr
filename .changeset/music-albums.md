---
"@latestarr/server": minor
"@latestarr/web": minor
"@latestarr/adapter-core": minor
"@latestarr/adapter-plex": minor
"@latestarr/adapter-tautulli": minor
---

**New:** Music from Plex and Tautulli. New albums appear in a **Music** section, with the cover, the artist underneath and, from Plex, the number of tracks. Singles and EPs are included, since Plex treats them as albums too.

- **Choose what each newsletter includes.** On a newsletter, each linked source lists what it has (Movies, TV, Music, ...) as toggles that save straight away. Music is off until you turn it on, so existing newsletters don't change, and you can leave it off for people who can't see your music library.
- **A summary for each album:** its own description, or, where it has none (as most don't), the artist's bio, as in Tautulli's own newsletter.
- **Albums only.** Plex and Tautulli both list new albums, not tracks. Tracks added later to an album that's already in your library don't bring it back up, so they aren't in the newsletter.
- **Designs** have a Music section with a **Listen on Plex** button, and the editor's sample shows two albums.

<details>
<summary>Technical details</summary>

Closes #354. Built from what a real Plex 1.43 and Tautulli report for a test library: a new album, a single, an EP, two albums by one artist, a compilation, and tracks added to an existing album.

- `MediaKind` gains `album`, exported as `MEDIA_KINDS`. `NewItem` gains `trackCount`. `SourceCapabilities` gains optional `defaultMediaKinds`, and `mediaKindsFor()` works out a link's kinds.
- **Plex and Tautulli** map `album` entries in their recently-added lists, and `artist` libraries as music. The artist (`parentTitle`) is the subtitle. Plex's `leafCount` is the track count; Tautulli doesn't give one. Both list `album` as a kind, with music left out of `defaultMediaKinds`.
- **Release dates:** music tagged with only a year gets 1 January from Plex, so an album's release date is left out when it's exactly 1 January (`albumReleaseDate()`).
- `PATCH /api/newsletters/:id/sources/:sourceConnectionId` sets `mediaTypeFilter`, where null means the source's defaults. Filters are validated against the source's kinds, here and on linking. An empty filter, which linking used to accept, now means the defaults rather than nothing. Sources in API responses carry `mediaKinds` and `defaultMediaKinds`.
- **Album summaries (#476):** an album with no `summary` gets its artist's, from Plex's `/library/metadata/{parentRatingKey}` or Tautulli's `get_metadata`. `fillAlbumOverviews()` in adapter-core looks each artist up once, for at most 25 artists per fetch, newest albums first; a failed lookup leaves the album without one.
- The wording key `music` defaults to "Music"; the album kind is counted as albums. Most-watched lists stay movies and TV.

</details>
