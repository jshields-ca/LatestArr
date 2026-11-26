---
"@latestarr/server": patch
"@latestarr/web": patch
"@latestarr/adapter-core": patch
"@latestarr/adapter-plex": patch
"@latestarr/adapter-tautulli": patch
"@latestarr/adapter-jellyfin": patch
"@latestarr/adapter-audiobookshelf": patch
"@latestarr/adapter-romm": patch
---

**Fixed:** A newsletter included every library on a source, including ones your recipients can't see: a 4K copy of a movie appeared twice, with a link that didn't work for them, and titles from a library you keep to yourself were emailed to everyone. Each source linked to a newsletter now has **Libraries: Change**, where you choose **All libraries** or **Only these**. With **Only these**, a library added later stays out until you tick it. The choice also applies to **Most watched**, and a Plex server and the Tautulli reading it keep to the same libraries. (#483)

<details>
<summary>Technical details</summary>

- **API:** `PATCH /api/newsletters/:id/sources/:sourceId` now takes `libraryFilter` (an array of library ids, or `null` for all) alongside `mediaTypeFilter`; each is optional, but one is required. Ids must be letters, digits, `-` and `_` (they go into source URLs), at least one is needed, and a BookLore-family source, whose OPDS feed can't read only some libraries, refuses a choice. `POST /api/newsletters/:id/sources` validates `libraryFilter` the same way. Sources now report `libraryChoice`. The Plex and Audiobookshelf clients also URL-encode library ids.
- **Shared servers:** for sources reporting the same server id (Plex and its Tautulli), each reads only libraries every one of them allows (`pipeline/library-choice.ts`). If a Plex or Tautulli source can't say which server it reads while another has libraries chosen, it's skipped for that send, with a warning on the Logs page, rather than read in full.
- **Most watched:** Tautulli's `get_home_stats` rows are kept only when their `section_id` is a chosen library; a row without one is dropped while a choice is set. The all-time fallback pool uses the same choice.
- **Library lists:** Plex and Tautulli list only movie, show and music libraries, the ones a newsletter reads; photo libraries are left out.
- An existing empty choice, which linking used to accept, still means all libraries.

</details>
