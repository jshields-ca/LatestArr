---
"@latestarr/server": patch
---

Bump croner (9 → 10), the scheduler library. Runtime dependency — this is the highest-risk bump in the deferred major-version pass, since a subtle regression here could silently stop newsletters from firing on schedule rather than failing loudly.

Extra scrutiny beyond the usual test suite, since `apps/server/src/scheduler/engine.ts`'s missed-schedule catch-up logic (`nextScheduledRunAfter`) always constructs a real `Cron` directly — it isn't behind the tests' injectable `cronFactory` mock, so `apps/server/src/scheduler/engine.test.ts`'s catch-up tests already exercise real croner behavior at exact date boundaries, not a stub:

- All 11 scheduler tests pass unchanged, including the three missed-schedule catch-up boundary cases.
- Directly verified `nextRun(since)` is still strictly-after-exclusive of `since` (matching the code's own documented assumption) at the exact same boundary the tests use (`"0 9 * * 1"` around `2024-01-01T09:00:00Z`).
- Directly verified the exact 3-arg `new Cron(pattern, options, callback)` constructor shape `defaultCronFactory` depends on, plus `.stop()`, still work unchanged.

`pnpm turbo run lint typecheck build test` is fully green (40/40 tasks).
