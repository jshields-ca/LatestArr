# @latestarr/adapter-core

## 0.2.0

### Minor Changes

- dc5a521: Add an optional `fetchPopularItems` capability to the `SourceAdapter` contract for ranking items by watch activity ("most watched this week") instead of recency, and implement it for Tautulli via `get_home_stats`. This lays the data groundwork for the newsletter builder's "Most Watched" sort option.
