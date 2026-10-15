---
"@latestarr/web": patch
---

**Fixed:** Each person's result in a send's details reads as a word (**Sent**, **Failed**, **Bounced** or **Unsubscribed**), like the send's own status, instead of `sent` or `failed`.

<details>
<summary>Technical details</summary>

- **`components/send-run-history.tsx`:** a `RECIPIENT_STATUS_LABEL` map for `SendRunRecipientResult["status"]`, alongside the run labels in `lib/send-run.ts` from #336.

</details>
