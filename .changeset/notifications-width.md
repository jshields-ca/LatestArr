---
"@latestarr/web": patch
---

**Fixed:** The Notifications page's cards now span the page like every other page's.

They were narrower than the rest on a desktop. The fields inside them keep a comfortable width, as on the Backups page.

<details>
<summary>Technical details</summary>

The `max-w-2xl` cap moves from the form to each card's `CardContent`.

</details>
