---
"@latestarr/adapter-tautulli": patch
"@latestarr/server": patch
---

**Fixed:** Items from Tautulli link to their own page in Plex again, rather than the Plex home page, when the source has a Public URL. A newsletter with both Plex and the Tautulli watching the same server now lists each item once, as intended, rather than twice.

<details>
<summary>Technical details</summary>

Closes #459. The Tautulli adapter asked which Plex server it watches with `get_server_id` and read `pms_identifier`, which that command never returns. Without a hostname and port it answers `{"identifier": null}`. The lookup always came back empty, so item links fell back to the Plex Web home page, and the Plex and Tautulli de-duplication from #391 never matched. It now uses `get_server_info`, which returns the configured server's `pms_identifier` from Tautulli's own settings, so it answers even when Plex is down. Checked against Tautulli watching Plex 1.43, and the tests now answer each command the way a real Tautulli does.

</details>
