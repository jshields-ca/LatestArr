---
"@latestarr/adapter-audiobookshelf": patch
"@latestarr/adapter-booklore-family": patch
"@latestarr/adapter-core": patch
"@latestarr/adapter-jellyfin": patch
"@latestarr/adapter-plex": patch
"@latestarr/adapter-romm": patch
"@latestarr/adapter-tautulli": patch
"@latestarr/server": patch
"@latestarr/web": patch
---

**Fixed:** Newsletters no longer miss new items on a busy week.

- **Everything in the lookback window:** LatestArr read only the 100 newest items from each source, shared by all of its libraries. So on a Plex server, a big week of TV could push that week's movies out of the newsletter entirely. It now reads everything added in the newsletter's lookback window, page by page.
- **A safety cap:** at most 1,000 items per source (per library for Audiobookshelf) on each check. Reaching it is logged as a warning on the Logs page.
- **Emails stay a sensible length:** a section with no **Most items per section** limit shows up to 100 items, about the most it could before.

<details>
<summary>Technical details</summary>

- **`adapter-core`:** `readNewest` pages newest-first (`RECENT_PAGE_SIZE` 100) until a page reaches items older than `since`, comes back short, adds nothing new (a source that ignores paging), or the total reaches `MAX_RECENT_ITEMS` (1,000). A first-page error is thrown as before; a later page's error keeps what was read.
- **Adapters:**
  - Plex: `X-Plex-Container-Start`;
  - Tautulli: `start`;
  - Jellyfin and Emby: `StartIndex`;
  - Audiobookshelf: `page`, from 0;
  - RomM: `offset`;
  - BookLore, BookOrbit and Grimmory: OPDS `page`, from 1, since both BookOrbit and BookLore cap `size` at 100.

  An explicit `limit` still reads that many.
- **Server:** `run-newsletter.ts` warns when a source returns `MAX_RECENT_ITEMS`. `design.ts` renders sections with `count="${limit ?? MAX_SHOWN_ITEMS}"` (100), and the design editor's placeholder reads "Up to 100". Designs written in code (`{{#each items}}`) aren't capped.
- Found while documenting the limit for #362; the "+ N more" line follows in 0.13.0.

</details>
