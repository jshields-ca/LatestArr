---
"@latestarr/adapter-plex": patch
"@latestarr/adapter-tautulli": patch
"@latestarr/server": patch
"@latestarr/web": patch
---

**Fixed:** TV episodes from Plex and Tautulli now show the show's poster instead of a wide video still, so every image in the newsletter is the same shape. Items with no runtime, page count, or rating no longer leave an empty line, and a rating on its own no longer starts with a stray "·".

<details>
<summary>Technical details</summary>

Closes #217.

- Plex uses `grandparentThumb` for episodes, and Tautulli uses `grandparent_thumb`, each falling back to the episode's own `thumb`. Seasons already use their own portrait art.
- The render context gains `detailsLine`: runtime, pages, length, or platform, then rating, joined with " · ". Designs render the details line only when it has content. The code-mode reference lists `detailsLine`, and the individual fields are unchanged for existing code designs.

</details>
