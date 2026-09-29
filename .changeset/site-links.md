---
"@latestarr/web": patch
"@latestarr/server": patch
---

**Improved:** LatestArr now points to its new home at [latestarr.app](https://www.latestarr.app). The web UI footer links the website, the docs, GitHub Discussions, issue reporting and the license, and credits LatestArr's contributors, as the site does. The Add source dialog links each source type's setup guide, and the Default design's email footer links LatestArr.app instead of GitHub.

<details>
<summary>Technical details</summary>

- **Web UI footer:** the links (LatestArr.app, Docs, Discussions, Report an issue, GPLv3 license) sit in a labelled `nav`, with "© 2026 LatestArr contributors · Led by Jeremy Shields" beneath, linking jeremyshields.ca. The old scootr.ca author link is gone. (#251)
- **Add source dialog:** a "Setup guide for …" link to that type's page under `latestarr.app/docs/sources`. Plex, BookLore, Grimmory and Audiobookshelf now show the testers note too, linking #244, to match the README; Jellyfin and Emby still link #196.
- **Code mode:** the variables reference links the code mode guide.
- **Email footer:** the Default design links `https://www.latestarr.app` (with a globe icon) in place of the repository, and keeps "Report an issue". (#252)
- **Footer icons fixed:** the email footer icons were never visible. Their SVG stroke colour was written `%23978490` inside base64, where it isn't URL-decoded, so it was an invalid colour. They now use a literal `#978490`.
- The default design snapshots were re-recorded for the footer change.

</details>
