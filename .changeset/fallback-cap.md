---
"@latestarr/server": patch
---

**Fixed:** A Media List's **Show a few from the library** fallback lists at most 100 items, like the list itself.

A design written in code could set any number for it. Designs built from options were never affected.

<details>
<summary>Technical details</summary>

`mediaList`'s `emptyFallback="random"` slice is capped at `MAX_SHOWN_ITEMS`, as #372 did for the main selection. Found by the latestarr.app session.

</details>
