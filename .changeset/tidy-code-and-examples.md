---
"@latestarr/server": patch
"@latestarr/web": patch
---

**Improved:** The Add source dialog's example name and addresses now match the source type you pick (for example `http://localhost:8096` for Jellyfin), instead of always showing Tautulli's. A design switched to code no longer opens with about 25 lines of generated dark-mode styles. One short comment stands in for them and adds them when the email is sent; delete it to leave them out.

<details>
<summary>Technical details</summary>

Closes #228.

- `sources-page.tsx`: each source kind has `examples` for the Name, Base URL, and Public URL placeholders, used in the Add and Edit dialogs.
- `render/design.ts`: `buildDesignMjml(settings, { darkModeMarker: true })` writes a `<!-- latestarr:dark-mode … -->` marker instead of the generated head styles, and `expandDarkModeMarker` replaces it with them at render time. That happens in the send pipeline, previews, and the sample preview. Convert-to-code uses the marker. Code designs without it, including old drag-and-drop templates, are unchanged.

</details>
