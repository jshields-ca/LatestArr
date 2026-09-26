---
"@latestarr/server": patch
---

**Improved:** Building or developing LatestArr from source now needs Node.js 22 or newer. Node 20 reached end of life in April 2026. Nothing changes if you run the Docker image, which already uses Node 22.

<details>
<summary>Technical details</summary>

`engines.node` is now `>=22` and the CI matrix tests Node 22 (what the Docker image runs) and Node 24 (the next LTS) instead of 20 and 22. This unblocks `jsdom` 30, which requires Node `^22.22.2 || ^24.15.0 || >=26`.

</details>
