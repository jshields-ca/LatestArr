---
"@latestarr/server": minor
"@latestarr/web": minor
---

**Improved:** The Default design has a fresh look to match the LatestArr app. The newsletter sits on a white card with an accent bar, and the header shows the date range, how many items are new, and a count for each type. Items are grouped into Movies, TV, Books, and so on, with smaller posters, tidier spacing, and summaries trimmed to about two lines.

**New:** Several new episodes of the same show now share one row, like "The Daily Show · 4 new episodes", with each episode listed underneath, so a week of a daily show doesn't fill the email. It's on by default, and you can switch it off in a design's Sections settings. Designs you saved earlier keep their "Group by type" setting; turn it on in the design editor to get the new sections.

<details>
<summary>Technical details</summary>

Closes #218 and #219.

- `render/design.ts`: the email is an `mj-wrapper` card with a 4px accent top border on a tinted page (`page` colour, with its own dark-mode rule), with the credits below the card. Cards rows have a 72px poster and hairline dividers, `overviewShort`, and a pill badge. `groupByType` now defaults to true, and TV episodes and seasons share one "TV" section (`contentType="tv_episode,tv_season"`). New option `sections.groupEpisodes` (default true).
- `render/mjml-template.ts`: `mediaList` takes `groupEpisodes="true"` and comma-separated `contentType`. `ifAnyItems` and `ifKindLinked` accept several types, and `ifKindLinked` is also true when a type has items, so a section never hides real items. New context values: `periodFormatted`, `itemCount`, `kindCounts`, `hasLinkedSources`, and per item `overviewShort`, `episodes`, `episodeCount`, `moreEpisodes`. The code-mode reference documents them.
- An issue with nothing new and no linked sources says "No new items in this period." instead of rendering nothing.
- Design editor: a "Group a show's new episodes" switch; the section order lists Movies, TV, Books, Audiobooks, Games and moves TV's two types together; the "lookback line" option is now "Show the date range and counts". The sample preview includes two episodes of one show.
- Default snapshots re-recorded.

</details>
