---
"@latestarr/server": patch
"@latestarr/db": patch
---

**Fixed:** Someone who unsubscribed was signed back up if they were deleted and added again, by hand, from a file or with **Import users**. Unsubscribing now holds for their address, so they're added back still unsubscribed. Also fixed:

- Gmail and other mail apps' own Unsubscribe button could be turned away when many people pressed it within a minute.
- When a Plex server and its Tautulli both had libraries chosen and one couldn't be reached, the newsletter went out without either, and nothing said so. It now fails and alerts, as when a source fails.
- A show on two servers (Plex and Jellyfin, say) listed each new episode twice in its row; now once.
- **Send to the rest** said someone had failed last time when they'd been skipped because they had unsubscribed.
- A public IPv6 address in `PUBLIC_URL` was warned about as if it only worked on your own network.

<details>
<summary>Technical details</summary>

- **Unsubscribed addresses:** a new `unsubscribed_addresses` table (migration `0014`) holds a SHA-256 of each unsubscribed address, lowercased and trimmed, never the address itself. Unsubscribing from the link adds it and subscribing again removes it. Adding a recipient (`POST /api/recipients`), importing (`POST /api/recipients/import`, also used by Import users) and changing a recipient's address (`PATCH`) set `unsubscribedAt` from it. At startup, everyone already unsubscribed is added to the list, so it works after upgrading from 0.13.0 and after restoring a 0.13.0 backup.
- **One-click rate limit:** `POST /api/unsubscribe/:token` allows 600 a minute per address, up from 20, because mail providers send these from shared servers. The confirmation page's request keeps 20. Tokens are 122 random bits.
- **Library choice:** when a source can't say which server it reads and another source may read the same one with libraries left out, the render throws instead of leaving both out. Previews answer 502 with the reason, and scheduled sends fail and alert. A choice that leaves a source no libraries in common is still only logged.
- **Grouped episodes:** a folded row keeps the first copy of each subtitle.
- **Send to the rest:** only `failed` and `bounced` results count as failed before; `skipped_unsubscribed` counts as not sent.
- **`isPrivateOrigin`:** a bracketed IPv6 host is private only when unique-local (`fc00::/7`) or link-local (`fe80::/10`).

</details>
