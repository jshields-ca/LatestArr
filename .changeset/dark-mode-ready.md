---
"@latestarr/server": minor
---

**Fixed:** Newsletters look right in dark-mode email apps. Emails now say they support light and dark mode, and include dark versions of the design's own colours, so apps like Apple Mail and Outlook.com use those instead of guessing. Type badges have a thin outline, so they stay visible in apps that remove backgrounds (such as Thunderbird's dark message view).

<details>
<summary>Technical details</summary>

Closes #216.

- Designs declare `color-scheme: light dark` (meta tags and `:root`) and always set an explicit body background.
- For a light design, dark colours are derived from its palette. `@media (prefers-color-scheme: dark)` rules, plus `[data-ogsc]`/`[data-ogsb]` rules for Outlook.com, swap each inline colour by value (e.g. `[style*="color:#241521"]`), so no element needs its own class and custom palettes work too. Palette colours are lower-cased so the selectors match. A design that's already dark only declares support.
- Badges get a 1px border mixed from the accent colour. The Default design's snapshot changes accordingly.
- Gmail's apps apply their own dark mode and ignore these styles, so results there vary.

</details>
