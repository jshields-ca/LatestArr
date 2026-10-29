---
"@latestarr/web": patch
"@latestarr/adapter-tautulli": patch
---

**Fixed:** You can import a source's users from the Recipients page, and they're listed by name.

- **From a source** next to **Import** on the Recipients page lists your connected sources that can share their users (Plex, Tautulli, Jellyfin, Emby, Audiobookshelf and RomM). With none connected, it points to the Sources page. Before, this was only on each source's row on the Sources page, which was easy to miss after the setup checklist sent you to Recipients.
- The list of users is sorted by name instead of the order the source gives.
- For Tautulli, a person's Plex username is used when Tautulli's display name is just their email, so the list and the imported recipients show names, not emails.

<details>
<summary>Technical details</summary>

`ImportSourceUsersDialog` moves to `components/import-source-users-dialog.tsx`. It loads the groups itself when it opens, so the Sources page no longer loads them. `ImportFromSourceButton` filters `listSources()` by `KINDS_WITH_USER_IMPORT` and refreshes the page's lists after an import. The Tautulli adapter's `listUsers` picks the first of `friendly_name` and `username` that isn't an email. Fixes #398.

</details>
