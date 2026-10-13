---
"@latestarr/web": patch
---

**Improved:** Clearer **Base URL** and **Public URL** fields when adding or editing a source.

Each field now has its own short explanation. The **Base URL** is where LatestArr connects, so a local address is fine. The **Public URL** is where recipients go when they click. Before, one hint under Public URL tried to explain both, and called the Base URL "the address above".

<details>
<summary>Technical details</summary>

`BaseUrlHint` and `PublicUrlHint` in `pages/sources-page.tsx`, shared by the Add and Edit source dialogs, each linked to its input with `aria-describedby`.

</details>
