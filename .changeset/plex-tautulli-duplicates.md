---
"@latestarr/server": patch
"@latestarr/web": patch
"@latestarr/adapter-core": patch
"@latestarr/adapter-plex": patch
"@latestarr/adapter-tautulli": patch
---

**Fixed:** A newsletter linked to both a Plex server and the Tautulli that watches it listed every new item twice, and doubled its counts. Each item is now listed once.

- **Which copy is used:** Plex's, with its details and links. Anything only Tautulli knows, such as genres, is added to it.
- **Most watched** still comes from Tautulli.
- **Different servers are never merged,** even when their items share a number. If either app can't say which server it reads, both copies are listed as before.
- **The newsletter's Sources list** says so when both are linked.
- Two different servers reading the same files (Plex and Jellyfin, say) still list items twice; that's #392.

<details>
<summary>Technical details</summary>

Fixes #391. Adapters gain an optional `getServerId(config)`: Plex returns its machine identifier from `/identity`, Tautulli the same value from `get_server_id`, both as `plex:<id>`. The pipeline asks only when two or more linked sources implement it, so a newsletter with one such source makes no extra requests. `mergeSharedServerItems` in `pipeline/shared-server-items.ts` keeps one copy of each `(server id, externalId)` across sources: the server's own copy over Tautulli's, otherwise the first, in the earlier copy's position. It applies to the new-items pool and the random fallback pool, so counts, sections and the cap warning all work on the merged list.

The issue suggested the source listed first should win, and a shared Public URL as a fallback signal. Neither is used. Linked sources have no order a user sets (the link table has none), and two different Plex servers commonly share a Public URL such as `https://app.plex.tv`; with rating keys being small numbers, merging on the URL would drop real items.

</details>
