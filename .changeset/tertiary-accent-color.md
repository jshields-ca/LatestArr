---
"@latestarr/web": patch
---

**Improved:** Added a new accent color (a calm blue) used for informational badges like the version number and the "In Active Development" label, giving the app's look a bit more depth.

<details>
<summary>Technical details</summary>

Adds a third palette hue — `--tertiary`/`--tertiary-foreground` (indigo/blue, hue ~228) — as a genuine design token alongside `--primary`, following production feedback that the "Bloom" palette had nowhere to go for calm, informational UI beyond the rose primary and the ad hoc violet secondary accent. Indigo/blue was picked as the clearest complementary/triadic partner to rose while staying clear of green (already success) and red/orange (already destructive, and Plex's own brand color); both the light and dark pairs clear 4.5:1+ text contrast the same way every other token pair in `index.css` does. Wired into Tailwind as `bg-tertiary`/`text-tertiary-foreground` and exposed as a new `Badge` `tertiary` variant, used for the header's running-version badge and the new footer's "In Active Development" badge — reserved for informational labels, never a semantic success/warning/destructive state.

</details>
