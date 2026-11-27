---
"@latestarr/server": patch
---

**Fixed:** On a design with a dark background, notices (Info, Warning and Alert) showed the design's light text on a pale box, so they couldn't be read in the preview or in sent emails. A dark design's notice now has a dark box. If a design's text or link colour can't be read on a notice's box, the notice uses one that can.

<details>
<summary>Technical details</summary>

- A notice uses the dark set of colours (bar, tint and icon) when the design's background is dark, and the light set otherwise. Before, it always used the light set.
- The notice's text keeps the design's text colour when it reaches 4.5:1 against the tint (WCAG). Otherwise it's `#1c1a1b` on a light tint or `#f4f1f2` on a dark one, and dark mode turns `#1c1a1b` light.
- Links in the notice keep the design's link colour when it reaches 4.5:1, and otherwise use the notice type's colour. Code designs get this as `noticeLinkColor`.

</details>
