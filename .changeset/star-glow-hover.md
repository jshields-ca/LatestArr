---
"@latestarr/web": patch
---

**Fixed:** The GitHub star in the header glows and grows on hover again. Its one-time pulse when the page loads had been switching the hover effect off.

<details>
<summary>Technical details</summary>

- `.star-glow-intro` used animation fill mode `both`, so the finished pulse kept applying its last frame, and that overrode the hover and focus styles on `.star-glow`.
- It now uses `backwards`. The pulse ends at the resting state, so nothing needs holding. (#242)

</details>
