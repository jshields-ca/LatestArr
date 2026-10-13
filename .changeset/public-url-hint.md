---
"@latestarr/web": patch
---

**Improved:** A clearer hint under **Public URL** when adding or editing a source.

It said "the address above", which read as the Public URL field itself. It now names the **Base URL**, and says what a blank Public URL means: item links use the Base URL, and there's no Where to watch button.

<details>
<summary>Technical details</summary>

`PublicUrlHint` in `pages/sources-page.tsx`, shared by the Add and Edit source dialogs.

</details>
