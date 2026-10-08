---
"@latestarr/adapter-tautulli": patch
"@latestarr/server": patch
---

**Fixed:** A design with a **Most watched** section couldn't preview or send for newsletters using a Tautulli source. They failed with "Send failed: data.find is not a function". Most watched now shows Tautulli's most played movies and shows again.

<details>
<summary>Technical details</summary>

- Fixes #284.
- With a `stat_id`, Tautulli's `get_home_stats` returns that one stat block as an object, or `[]` when there are no stats. `getHomeStats` expected an array of blocks, so `.find` threw.
- It now accepts the single block, still searches an array by `stat_id`, and returns `[]` for an empty result.
- Any other shape (null, a different stat, `rows` that isn't a list) throws a clear "unexpected response" error instead of a `TypeError`.
- Client, adapter and send-route tests now use Tautulli's real response shape, with tests for the array and unexpected cases.

</details>
