---
"@latestarr/server": patch
---

**Fixed:** `check-backup` says what a backup holds in plain words: "1 design, 2 sources, 9 sends" rather than "1 templates, 2 source connections, 9 send runs".

<details>
<summary>Technical details</summary>

Part of #469. `describeCounts()` in `cli.ts` names each counted table the way the app does, singular for one. A table it doesn't know keeps its name.

</details>
