---
"@latestarr/server": patch
---

**Fixed:** In a design's preview with sample content, the source buttons now match your connected sources, for example "Read on Book Orbit" for a Book Orbit source. Before, the sample always said "Read on BookLore". With no sources connected yet, it shows neutral labels such as "Watch now" and "Read now". Book Orbit's button is now spelled the way the project spells it: "Read on Book Orbit".

<details>
<summary>Technical details</summary>

- Fixes #291.
- `/templates/preview` loads the source connections (kind, name, public URL) and passes them to `renderDesignSample`.
- `sampleSourceButtons()` builds the buttons with `buildSourceButtons`, so labels, merging and naming match a real send. A source without a public URL gets a stand-in URL so its button still shows in the sample.
- `source-buttons.ts`: the `bookorbit` label is now "Book Orbit" (#296).

</details>
