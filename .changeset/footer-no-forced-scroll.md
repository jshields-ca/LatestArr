---
"@latestarr/web": patch
---

**Fixed:** On pages with little content, the page footer no longer gets pushed off the bottom of the screen behind a wall of empty space — it now sits right after the content, without needing to scroll to find it.

<details>
<summary>Technical details</summary>

Addresses production feedback that there was "a lot of dead space between the bottom of content and the footer" and that short pages forced a scroll just to reach it. The root cause (`app-shell.tsx`): the content row (`flex-1`, between the sidebar and `<main>`) and the sidebar (`h-[calc(100vh-3.5rem)]`, a viewport-relative fixed height) were both independently forcing that row to be at least one full viewport tall on every page, regardless of how much actual content there was — pushing the footer to just past the fold on every page, not only long ones.

Fix: drop `flex-1` from the content row and the sidebar's explicit `h-[calc(100vh-3.5rem)]`. The sidebar now sizes via the row's default `align-items: stretch`, so its `border-r` divider still spans the full height of whichever of the sidebar/main is taller on any page with real content — no visual change there. The root `<div>`'s `min-h-screen` is left as-is, so short pages still fill at least one viewport; any leftover space now falls *below* the footer (ordinary bottom-of-page whitespace) instead of being forced in *above* it. Verified visually (headless Chromium against the dev build): a minimal page's `document.documentElement.scrollHeight` now equals `window.innerHeight` with no scrollbar, and the footer is visible immediately below the content.

</details>
