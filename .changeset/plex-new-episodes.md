---
"@latestarr/adapter-core": patch
"@latestarr/adapter-plex": patch
"@latestarr/adapter-tautulli": patch
"@latestarr/server": patch
---

**Fixed:** A new episode of a season already in your Plex library now appears in newsletters from a Plex source. Before, it could be left out as if it were old.

<details>
<summary>Technical details</summary>

Closes #466. With no libraries chosen, the Plex adapter read Plex's server-wide `/library/recentlyAdded`. That list folds new episodes into their season and gives the season its own `addedAt`, which is when the season first arrived, so an episode added to a season that's been there a while fell outside the lookback window. The adapter now reads each library's own `/library/sections/{key}/recentlyAdded`, which lists episodes with their own dates, as it already did when libraries were chosen. Only libraries holding a kind the newsletter wants are read (music is off by default), and items are sorted newest first across libraries. The safety cap is now per library for Plex too.

Tautulli dates that season row by its newest episode, so it was never affected. When a Plex server and its Tautulli are both linked (#391), Tautulli's season row and Plex's episodes are now recognised as the same news, through a new `seasonId` on episodes, and the episodes are kept.

</details>
