---
"@latestarr/web": patch
---

**Improved:** Pages with nothing to list yet show a greyed stamp, a heading and what to do next, in place of a plain text card.

This covers Newsletters, Recipients and its groups, Sources and Email servers.

<details>
<summary>Technical details</summary>

From the UI review (#332), logo extra L7. A new `EmptyState` (`components/ui/empty-state.tsx`) replaces the five copies of a `Card` holding only a title and description. `LogoMark` gains a `muted` variant, drawn in the muted text colour so it greys with either theme; it's `aria-hidden` here, since it's decoration. The headings and their wording are unchanged.

</details>
