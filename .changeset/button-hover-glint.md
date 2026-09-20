---
"@latestarr/web": patch
---

**Improved:** Buttons now feel smoother and more premium to hover over — a subtle light sweep and an easier lift, instead of an abrupt bump.

<details>
<summary>Technical details</summary>

Addresses production feedback that the primary button's hover lift felt "bumpy" rather than premium. The hover-triggered lift/shadow now transitions on a slower, spring-like `cubic-bezier(0.34, 1.56, 0.64, 1)` curve at 220ms (up from the shared 150ms linear-ish default), scoped to the `default` variant only via `hover:` utilities so every other button's snappy press-state timing is untouched. A one-shot diagonal light sweep (`.btn-glint` in `index.css`, a `::after` gradient translated across the button and clipped by `overflow-hidden`) plays once per hover-enter rather than looping, and is disabled under `prefers-reduced-motion`.

</details>
