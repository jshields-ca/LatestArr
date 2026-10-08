---
"@latestarr/web": patch
---

**Fixed:** On the Recipients page, group changes made in a recipient's edit panel now show straight away in the Groups section below. That covers adding them to a group, removing them, and creating a new group. Before, an open group didn't show the new member, and a group created in the panel wasn't listed until you refreshed the page.

<details>
<summary>Technical details</summary>

- Fixes #286.
- The page now loads groups once and shares them. A `GroupSyncContext` lets the edit panel report a new group (added to the list) and membership changes (which bump a version that open groups reload their members on).
- Members reloads keep the current list showing and ignore stale responses.

</details>
