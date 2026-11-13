---
"@latestarr/web": patch
---

**Improved:** Smaller consistency and accessibility fixes in Newsletters, the design editor and Logs.

- **Newsletters:** the Content panel of an open newsletter now says "Changes here save as you make them", since the form beside it waits for Save changes.
- **Design editor:** "More colours" opens with the same arrow as the other sections, and a section's summary shows only while it's closed.
- **Logs:** each line is easier to tap, its time is easier to read, and screen readers and voice control hear the line itself in place of "Show details".
- **Screen readers:** the newsletter editor's Schedule, Delivery and Content sections are announced by name.

<details>
<summary>Technical details</summary>

Audit findings 4, 14 and the rest of 10 from the UI review (#332). The newsletter editor's three panels are `role="group"` labelled by their `SubsectionHeading`. In the design editor the section summary is `group-open:invisible`, and "More colours" uses a `ChevronRight` that turns in place of the native marker. A log row's button drops its `aria-label` (a `label-content-name-mismatch`), keeps `aria-expanded`, and carries the row's padding so the target is 24px; the time is `zinc-400` (4.12:1 before). `docs/ui-guidelines.md` is new, linked from CONTRIBUTING.md, and records the patterns this review settled.

On finding 4: the audit said the Content panel saved with no sign that it had. That was wrong. It already confirmed each change with "Saved" or a toast, as the saving rule from #295 asks; what was missing was saying so up front.

</details>
