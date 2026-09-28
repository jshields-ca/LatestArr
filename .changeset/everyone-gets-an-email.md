---
"@latestarr/adapter-audiobookshelf": minor
"@latestarr/adapter-romm": minor
"@latestarr/adapter-jellyfin": minor
"@latestarr/web": minor
---

**Improved:** Import users works for every source that has users, including Plex, Jellyfin, and Emby. Those servers don't share email addresses, so the import list now has an email field next to anyone without one; fill it in and that person is imported too. Audiobookshelf and RomM sources can now import their users as well, with the emails those servers already have. For Emby, a user linked to Emby Connect with an email address is filled in for you.

<details>
<summary>Technical details</summary>

Closes #213.

- Import users dialog: users without an email get an "Email for {name}" field. A complete address selects them, and clearing it deselects them. Import sends typed addresses alongside the source's own.
- Audiobookshelf `listUsers`: `GET /api/users` (needs an admin token); active users only, with `email` when set.
- RomM `listUsers`: `GET /api/users` (needs the client API token's `users.read` scope, which the error message now names on a 401 or 403); enabled users only, with `email` when set.
- Jellyfin/Emby `listUsers` skips disabled accounts. Emby uses `ConnectUserName` as the email when it is one (untested on a real server; see #196).
- Import users now appears for Plex, Tautulli, Jellyfin, Emby, Audiobookshelf, and RomM. The BookLore family has no user API over OPDS.

</details>
