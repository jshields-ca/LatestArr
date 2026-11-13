---
"@latestarr/web": patch
---

**Improved:** A design's own buttons can be moved up and down, rather than deleted and added again in the order wanted.

<details>
<summary>Technical details</summary>

Closes #401. Up and down arrows on each row of **Your buttons** (`CtaRows` in `design-editor-page.tsx`), shown when there are two or more. Each is named after the button ("Move Requests up"), and focus follows the button to its new place, or to its other arrow once it reaches the top or bottom. The **Where to watch** buttons follow the order of a newsletter's sources and aren't changed here.

</details>
