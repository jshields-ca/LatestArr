---
"@latestarr/server": patch
"@latestarr/db": patch
"@latestarr/web": patch
---

**New:** On **Recipients**, you can now mark someone as unsubscribed when they ask to stop by replying to a newsletter, or any other way. Like using the link in a newsletter, it holds even if they're deleted and added again. Before, the only option was **Make inactive**, which is lost when someone is deleted, so they were signed back up when added again.

- **Mark as unsubscribed** is in a person's **Edit** window, and **Mark unsubscribed** works on several ticked people at once. Editors can do this.
- **Subscribe again**, for when someone asks to get newsletters again, is in the same window. Only admins can use it, and it's recorded on the **Logs** page.
- **Unsubscribed** now says whether the person used the link or who marked them. A line above the list explains how **Inactive** (your pause, which isn't kept) differs from **Unsubscribed** (their choice, which is). Deleting someone says what happens if they're added again.

<details>
<summary>Technical details</summary>

- **New routes:**
  - `POST /api/recipients/:id/unsubscribe` (editor) sets `unsubscribedAt` and `unsubscribedBy` (the editor's name), and adds the address to `unsubscribed_addresses`.
  - `POST /api/recipients/:id/resubscribe` (admin) clears both, removes the address from the list, and records an audit event.
  - `POST /api/recipients/bulk` takes `action: "unsubscribe"`.
- **Migration `0015`:** adds `unsubscribed_by` to `recipients` and `unsubscribed_addresses`. Adding, importing, or changing the address of someone on the list carries it over, as `unsubscribedAt` already was.
- **Inactive isn't kept:** being inactive is still not remembered when someone is deleted. That's deliberate, because it's a pause, not an opt-out.

</details>
