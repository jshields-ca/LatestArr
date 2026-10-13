---
"@latestarr/web": patch
---

**Fixed:** A send's per-person results read as words too: **Sent**, **Failed**, **Bounced** or **Unsubscribed**, matching the send's own status. They said `sent` or `failed`.

<details>
<summary>Technical details</summary>

- **`components/send-run-history.tsx`:** a `RECIPIENT_STATUS_LABEL` map for `SendRunRecipientResult["status"]`, alongside the run labels in `lib/send-run.ts` from #336.

</details>
