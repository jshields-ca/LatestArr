---
"@latestarr/web": patch
---

**Fixed:** The Logs page description now matches what it shows (sends, delivery and source problems, sign-ins, and settings changes) and says the log clears when the server restarts. The page also now shows all 500 entries the server keeps, not just the latest 200, and the empty message reflects the level filter.

<details>
<summary>Technical details</summary>

Closes #198. The old description promised "source sync errors" (LatestArr never syncs sources in the background; they're only contacted during sends and connection tests) and "routine request traffic is filtered out", which read as false once #177 started logging every settings change. `logs-page.tsx` now requests `limit=500`, the server's buffer size (`apps/server/src/log-buffer.ts`), instead of the endpoint's default of 200, so "latest 500" is accurate. The empty state is per level filter ("No errors since the server last started.").

</details>
