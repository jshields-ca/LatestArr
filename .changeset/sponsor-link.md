---
"@latestarr/web": patch
---

**New:** A quiet **Sponsor** link in the web app's footer, and a line under **Star on GitHub** in the star popover, both linking to GitHub Sponsors. They're plain links: no banners, pop-ups or reminders, and nothing in the newsletters people receive.

<details>
<summary>Technical details</summary>

- Closes #266.
- The footer gains `Sponsor` (heart icon) after Discussions, in the same tertiary style as the other links. The star popover gains a muted secondary link under its button.
- Both point to https://github.com/sponsors/jshields-ca and open in a new tab. App-shell tests check both.

</details>
