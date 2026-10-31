---
"@latestarr/server": patch
---

**Improved:** Updated the scheduler library that runs newsletter and backup schedules to croner 11.

Schedules work as before. One small difference: a schedule set between 2:00 and 2:59 AM now runs at 3:00 AM on the night clocks spring forward, rather than as late as the skipped hour was long (3:30 AM for 2:30 AM).

<details>
<summary>Technical details</summary>

croner 10.0.1 → 11.0.0 (#420). Its breaking changes are in `startAt`, `dayOffset`, `previousRun()` and daylight-saving handling. LatestArr uses none of the first three. `nextRun(since)` is still strictly after `since`, which the missed-send catch-up on startup relies on (checked against 11.0.0).

</details>
