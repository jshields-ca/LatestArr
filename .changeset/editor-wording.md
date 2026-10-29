---
"@latestarr/web": patch
---

**Fixed:** Two hints in the app now say the right thing.

- **Public URL for Plex and Tautulli** suggests `https://app.plex.tv` first. It works for anyone you share your server with, and needs no domain of your own. It used to say to use your Plex server's address.
- **A dark design** now says Light and Dark previews look the same, because email apps in dark mode leave a dark design as it is. It used to say to switch the preview to Dark to check it, as if something should change.

<details>
<summary>Technical details</summary>

`PublicUrlHint` (`sources-page.tsx`) has Plex and Tautulli wording. The design editor's dark-mode note uses a new `isDarkBackground` in `lib/colour.ts`, the same weighting as the server's `isDarkDesign`. Fixes #396 and #397.

</details>
