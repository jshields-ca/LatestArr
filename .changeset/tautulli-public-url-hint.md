---
"@latestarr/web": patch
---

**Fixed:** For a Tautulli source, the **Public URL** hint now says to use your Plex server's address, and that without one, items have no links.

It said item links fall back to the Base URL, which is true for every other source but not Tautulli: Tautulli's address isn't a page recipients can use, so LatestArr makes no links from it.

<details>
<summary>Technical details</summary>

`PublicUrlHint` in `pages/sources-page.tsx` takes the source kind, matching `buildExternalUrl` in `tautulli-adapter.ts`, which returns no link without `publicUrl` and builds a Plex Web link from it.

</details>
