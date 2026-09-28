---
"@latestarr/web": minor
---

**Improved:** The web UI works better on phones. The Recipients table shows each email under the name instead of cutting it off, dialogs fit the screen and scroll when they're long, buttons no longer squash together, small icons are easier to tap, and iPhones no longer zoom in when you tap a text field.

<details>
<summary>Technical details</summary>

Closes #187. Measured every page at 375px wide (horizontal overflow, element widths, tap targets under 24px) before and after.

- `components/ui/button.tsx`: `size="icon"` buttons get `shrink-0`; they were being squeezed to 23px wide in crowded rows.
- `components/list-row.tsx`: the actions cluster wraps below `sm` instead of shrinking its children (Sources' four actions didn't fit in 309px).
- `components/ui/dialog.tsx`: `w-[calc(100%-1.5rem)]` side margins, `max-h-[calc(100dvh-2rem)]` with `overflow-y-auto` (dvh tracks mobile browser toolbars), `p-5 sm:p-6`, and a 32px Close target. Removed the per-page `max-h-[90vh]` overrides this makes redundant. The sheet's Close button gets the same target.
- `components/ui/input.tsx`, `textarea.tsx`, `select.tsx`: `text-base sm:text-sm`. iOS Safari zooms the page when focusing any field under 16px.
- Recipients table: below `sm` the Email column is hidden and the address shows as a second line in the Name cell; the Status label is hidden (the switch keeps its `aria-label`); Status and Actions shrink to their content. Sort header buttons get a 28px-tall target.
- Newsletters: linked-source/group chip "×" buttons (also on Recipients) grow from 16px to 24px without changing chip height.
- Header GitHub/Star icon buttons grow to 28px targets via `-m-1.5 p-1.5`, so the visuals don't move.

</details>
