---
"@latestarr/server": minor
"@latestarr/web": minor
---

**New:** A design can show longer summaries: about 2, 4 or 6 lines (30, 60 or 100 words), chosen under **Item details**. Handy for books, whose blurbs say more than a film's.

Thanks to crispybegs for asking (#359).

<details>
<summary>Technical details</summary>

Closes #359. Design settings gain `summaryLength` (`short`, the default and today's length; `medium`; `long`). Each item now also carries `{{overviewMedium}}` and `{{overviewLong}}` (360 and 600 characters, cut at a whole word) beside `{{overviewShort}}` (180), so code designs can use them too.

</details>
