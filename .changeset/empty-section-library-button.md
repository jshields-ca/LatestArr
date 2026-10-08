---
"@latestarr/server": patch
---

**Fixed:** When a design is set to **Link to the library** for sections with nothing new, the section now shows "Nothing new this time." and a **Browse audiobooks** button styled like the design's other buttons, in its accent colour and in dark mode. Before, it was a bare link that didn't match the design. If the section already ends with its own "Watch on Plex"-style button, the browse button is left out so the same link doesn't appear twice.

<details>
<summary>Technical details</summary>

- Fixes #292.
- New Handlebars helper `{{#libraryLinkFor contentType="…" label="…"}}`, which renders its block with `{label, url}` from the linked sources' library address. The else block runs when there's no library address.
- Built-in designs no longer use `mediaList`'s `emptyFallback="link"`. They render `emptyMessage` plus the secondary `button()` inside `ifAnyItems`'s else block, wrapped in `sourceButtonsFor`'s else block when source buttons are placed per section.
- `mediaList`'s `emptyFallback="link"` is unchanged for code-mode designs. It now shares the `libraryLink()` lookup.

</details>
