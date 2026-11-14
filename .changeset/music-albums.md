---
"@latestarr/server": minor
"@latestarr/web": minor
"@latestarr/adapter-core": minor
---

**New:** Groundwork for music (#354). Designs have a **Music** section for albums, with the artist underneath, the number of tracks and a "Listen on" button, and the editor's sample shows two albums. On a newsletter, each linked source now lists what it includes (Movies, TV, Music, ...) as toggles that save straight away. Music stays off until someone turns it on, so existing newsletters don't change. Plex and Tautulli don't read music libraries yet.

<details>
<summary>Technical details</summary>

- `MediaKind` gains `album`, exported as `MEDIA_KINDS`. `NewItem` gains `trackCount`. `SourceCapabilities` gains optional `defaultMediaKinds`, and `mediaKindsFor()` works out a link's kinds.
- `PATCH /api/newsletters/:id/sources/:sourceConnectionId` sets `mediaTypeFilter`, where null means the source's defaults. Filters are validated against the source's kinds, here and on linking. Sources in API responses carry `mediaKinds` and `defaultMediaKinds`.
- The wording key `music` defaults to "Music"; the album kind is counted as albums.

</details>
