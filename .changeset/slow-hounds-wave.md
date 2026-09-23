---
"@latestarr/web": minor
---

**Improved:** The "Enabled" toggle no longer takes up a full-width row of its own — it's now folded into the newsletter's header action cluster, alongside Send now and Delete.

<details>
<summary>Technical details</summary>

Closes out the remaining part of #167 (the button-crowding and Send-now-visibility parts were addressed separately). The toggle was a small control that didn't need a whole `SettingRow` to itself; moved it into `NewsletterCard`'s header `actions` (`apps/web/src/pages/newsletters-page.tsx`) as a compact `<label>`-wrapped `Switch`, and removed the now-empty standalone row.

</details>
