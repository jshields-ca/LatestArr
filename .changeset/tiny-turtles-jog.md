---
"@latestarr/adapter-tautulli": patch
---

**Fixed:** A flaky test in the Tautulli adapter (`fetchPopularItems` > "converts the since date into a whole number of days for time_range") that occasionally failed in CI with `time_range` computed as `8` instead of `7`.

<details>
<summary>Technical details</summary>

The test built `since` as `Date.now() - 7 * 24h` and the adapter separately computes `Math.ceil((Date.now() - since) / oneDay)` a moment later — any scheduling delay between those two `Date.now()` calls (more likely on a loaded CI runner) pushes the elapsed time just over 7 days, rounding up to 8. Gave the fixture a minute of slack (`7 * 24h - 60s`) so normal test-execution latency can't cross the boundary.

</details>
