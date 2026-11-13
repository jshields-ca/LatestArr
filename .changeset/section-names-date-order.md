---
"@latestarr/server": minor
"@latestarr/web": minor
---

**New:** A design can rename its sections and put the day before the month: "Films" for "Movies", and "29 September 2026".

- **Section names:** in the design editor's new **Wording** panel, give any section its own name. It's used for the heading, the section's Browse button, the counts under the title ("9 films"), and each item's badge ("Film"). Blank keeps the default.
- **Dates:** "September 29, 2026" or "29 September 2026", in the email and its subject line.
- **Use UK English** sets both at once: Films, and the day first.
- **Code designs** get the names as `{{sectionNames.movie.heading}}` and `{{sectionNames.movie.browse}}`, and their dates follow the same order.

Thanks to crispybegs for asking (#390).

<details>
<summary>Technical details</summary>

Closes #390. `render/wording.ts` gathers what a design can change: section names, count words and date order. Design settings gain `wording: { dateOrder, sectionNames }`, each name up to 40 characters. The default design no longer writes "Movies" into its markup: headings read `{{sectionNames.<section>.heading}}` and the library link `label=sectionNames.<section>.browse`, so a name is escaped by Handlebars like any other value and can't add markup or template code. The Default design's rendered email is unchanged (its snapshot test passes as it was). `render/dates.ts` takes the order; the subject, item dates and date range all use it, and so does the newsletter form's subject preview. "Most watched", "Nothing new this time" and the Where to watch verbs stay in English for now.

</details>
