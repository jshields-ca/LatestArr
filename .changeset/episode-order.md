---
"@latestarr/server": patch
"@latestarr/web": patch
---

**Fixed:** When an email groups several new episodes of a show into one row, they're now listed in order (S01E01, S01E02, S01E04) instead of the order they were added, which could read S01E04, S01E01, S01E02. The Users and Backups pages, and the log line about a different `ENCRYPTION_KEY`, now say "email servers" instead of "SMTP", like the rest of the app.

<details>
<summary>Technical details</summary>

- **Episode order:** `groupEpisodes` in `render/mjml-template.ts` sorts each series' episodes by the season and episode number at the start of the subtitle (`S01E04 - …`, as the Plex, Jellyfin and Tautulli adapters write it). Episodes without a number go last, in their original order. The row itself keeps its place, at the series' newest episode.

</details>
