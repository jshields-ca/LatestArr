---
"@latestarr/server": patch
---

**Fixed:** If LatestArr stopped partway through sending a newsletter (a crash, restart, or upgrade), that newsletter could never send again: every later send said one was "already running". Now, when LatestArr starts, it closes the interrupted send, marks it partly sent or failed, shows who got it in History, and alerts you. Nobody who already got it is sent a duplicate.

<details>
<summary>Technical details</summary>

- Fixes #280.
- New `closeInterruptedSends()` (`pipeline/interrupted-sends.ts`), run by `startScheduler` before refreshing jobs and before catch-up.
  - Each run still `running` becomes `partial_failure`, or `failed` if no recipient was recorded as sent.
  - It sets `finishedAt` and an error that says how many of how many recipients were reached, then logs a warning and sends a failure alert (trigger `interrupted`).
- Nothing is resent automatically. The interrupted run keeps its `startedAt`, so missed-send catch-up treats that period as sent.
- A send now records its item and recipient counts before the send loop rather than at the end, so an interrupted send can report "X of Y".
- Known limit: a recipient whose message the SMTP server accepted in the instant before the stop, but which wasn't yet recorded, shows as not sent.

</details>
