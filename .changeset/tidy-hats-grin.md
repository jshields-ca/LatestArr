---
"@latestarr/web": minor
---

**Improved:** "Send now" is reachable from a newsletter's collapsed row — no need to expand it first — and no longer sits crowded next to the "Save changes" button.

<details>
<summary>Technical details</summary>

Addresses feedback that Save changes and Send now rendered right next to each other with no clear separation between them, and that Send now was only reachable after expanding a newsletter row.

Moved the "Send now" button from inside the Details tab into `NewsletterCard`'s always-visible header action cluster (`apps/web/src/pages/newsletters-page.tsx`), alongside Delete. The inline send-result/error feedback moved with it — now rendered right below the Enabled row, outside the `expanded` block, same as Enabled itself, so it shows regardless of whether the row happens to be expanded.

</details>
