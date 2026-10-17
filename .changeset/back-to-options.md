---
"@latestarr/server": patch
"@latestarr/web": patch
---

**Fixed:** A design switched to code can go back to its options, with **Back to options** in the design editor.

Before, **Edit as code** was one-way. The design returns to the options it had when it switched, keeping its intro, footer note and buttons; changes made to the code are dropped, and a confirmation says so first. A design that started as code, from the old template builder, gets the default options.

<details>
<summary>Technical details</summary>

Adds `POST /api/templates/:id/convert-to-options` (editor role, listed in `security.test.ts`), which sets `mode: "design"` and clears `compiledMjml`. A design keeps its `settings` while in code mode, so nothing else needs restoring. Reported in #381.

</details>
