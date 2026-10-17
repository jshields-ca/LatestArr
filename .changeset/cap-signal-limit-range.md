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

**Fixed:** Follow-ups to 0.12.4's full reading of sources.

- **No false warning for Audiobookshelf:** the "may have more new items" warning now appears only when a source really stopped at its 1,000-item cap. Several busy Audiobookshelf libraries could trigger it when none reached its own cap. (#370)
- **Most items per section accepts up to 100:** it was limited to 50, while leaving it blank shows up to 100. (#371)
- **Code designs stay a sensible length:** a Media List with no count, or set to show everything, now lists at most 100 items, like designs built from options. (#372)

<details>
<summary>Technical details</summary>

- **#370:** `readNewest` takes an `onCapReached` callback, called only when reading stopped at `MAX_RECENT_ITEMS` without reaching older items, a short page or an error, and never for an explicit `limit`. `FetchRecentItemsParams.onCapReached` passes it through every adapter, and `run-newsletter.ts` warns from it instead of comparing the source's total with 1,000.
- **#371:** the design schema's `sections.limit` and the editor field allow 1–100.
- **#372:** the `mediaList` helper caps its selection at `MAX_SHOWN_ITEMS` (100), including `showAll="true"` and a missing `count`. `{{#each items}}` in hand-written MJML stays as written.
- Found by the latestarr.app session while documenting 0.12.4.

</details>
