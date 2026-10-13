---
"@latestarr/web": patch
---

**Fixed:** Send statuses read as words, and the design editor fits a phone.

- **Readable statuses:** Recent sends and History said `success`, `failed`, or `partial_failure`. They now say **Sent**, **Failed**, or **Partly sent**, which is amber rather than red, since most of it went out. **Waiting** and **Sending** cover sends that haven't finished.
- **Design name on phones:** the design editor squeezed the name box to a couple of letters at phone width. It now has its own row, with **Edit as code** and **Save** below it.

<details>
<summary>Technical details</summary>

- **`lib/send-run.ts`:** a `STATUS_LABEL` map, and `partial_failure` uses the `warning` badge variant.
- **`design-editor-page.tsx`:** the name field gets `min-w-[12rem]`, so the header wraps instead of shrinking it.
- Found while taking screenshots for latestarr.app.

</details>
