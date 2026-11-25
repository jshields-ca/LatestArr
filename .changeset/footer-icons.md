---
"@latestarr/server": patch
---

**Fixed:** The small icons beside **LatestArr.app** and **Report an issue** at the foot of each newsletter showed as broken images in Gmail and other mail apps. The links are now text only.

<details>
<summary>Technical details</summary>

Closes #475. Built designs drew the icons as SVG `data:` images, which Gmail drops (SVG and `data:` both) and Outlook doesn't show. Icons in emails would need PNGs attached to each email, which #403 plans for buttons.

</details>
