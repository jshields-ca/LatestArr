---
"@latestarr/adapter-core": patch
"@latestarr/adapter-plex": patch
"@latestarr/adapter-tautulli": patch
"@latestarr/adapter-booklore-family": patch
"@latestarr/server": patch
---

**Fixed:** BookOrbit books and audiobooks now show their synopsis, like movies do.

**Improved:** Buttons and TV links in newsletters fit what they point to.

- **Listen on BookOrbit:** under Audiobooks, a source's button now says **Listen on**, under Books **Read on**, under Movies and TV **Watch on**, and under Games **Play on**. Before, one source had one label everywhere, so BookOrbit's audiobooks had a **Read on BookOrbit** button.
- **TV rows link to the season or show:** a row that groups several new episodes now links to their season, or to the show when they're from different seasons, as Tautulli's newsletter does. Each episode listed under it still links to that episode. This works for Plex and Tautulli sources.

<details>
<summary>Technical details</summary>

- **Synopsis:** BookOrbit puts an entry's description in `<content type="text">`; BookLore and Grimmory use `<summary>`. `getEntrySummaryText` now falls back to `<content>`, and ignores an empty one.
- **Verbs:** `buildSourceButtons` adds `labelsByKind`, with the verb chosen by kind (`VERB_BY_KIND`), and the `sourceButtonsFor` helper uses the label for its section's kind. Buttons not under a section keep the app's own verb.
- **TV links:** `NewItem` gains `seasonUrl` and `seriesUrl`. Plex fills them from `parentRatingKey` and `grandparentRatingKey`, and Tautulli from `parent_rating_key` and `grandparent_rating_key`, as Plex Web deep links. `groupEpisodes` links the row to the shared season, else the series, else the first episode.
- Reported in #353 and #359.

</details>
