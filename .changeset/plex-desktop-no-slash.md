---
"@latestarr/adapter-core": patch
"@latestarr/adapter-plex": patch
"@latestarr/adapter-tautulli": patch
---

**Fixed:** Plex links through `https://app.plex.tv` now open the item, even when Plex first asks people to sign in or choose a profile.

They opened the Plex home page instead. Links now use the same form as Tautulli's newsletter links, `https://app.plex.tv/desktop#!/…`, which a user confirmed in #353 keeps the item through Plex's profile picker. Links to a self-hosted Plex address are unchanged.

<details>
<summary>Technical details</summary>

`plexWebAppUrl` returns `https://app.plex.tv/desktop` (no trailing slash) for app.plex.tv. In #353, `/desktop#!/…` reached the item after the profile picker, while `/desktop/#!/…` (0.12.2) and `/web/index.html#!/…` (0.12.1) both ended on the home page. Item, season and series links and the fallback link all use it.

</details>
