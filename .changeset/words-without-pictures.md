---
"@latestarr/server": minor
---

**Improved:** Newsletters now include a plain-text version alongside the HTML, which spam filters prefer and text-only email readers can show. The deliverability guide also explains how to check your DKIM record when a received email reports `dkim=temperror` or `dkim=fail`.

<details>
<summary>Technical details</summary>

Closes #220.

- `render/plain-text.ts` converts the rendered HTML with `html-to-text`: wrapped at 78 characters, links shown as `Title [url]`, images and styles dropped. It is generated from the final HTML, so code designs get one too. Sent as `text` on both real sends and test sends, so messages become `multipart/alternative`.
- `docs/deliverability.md`: a "temperror or fail" section on checking the DKIM selector record, and a note about the text part.

</details>
