---
"@latestarr/adapter-core": minor
"@latestarr/adapter-tautulli": minor
---

Add an optional `fetchPopularItems` capability to the `SourceAdapter` contract for ranking items by watch activity ("most watched this week") instead of recency, and implement it for Tautulli via `get_home_stats`. This lays the data groundwork for the newsletter builder's "Most Watched" sort option.
