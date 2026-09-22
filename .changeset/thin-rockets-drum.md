---
"@latestarr/web": minor
---

**Improved:** The Dashboard's "Recent sends" card now shows the same expandable send detail as the Newsletters page's History tab — included items, per-recipient delivery status, and a link to view a copy of the sent HTML — instead of just a status line.

<details>
<summary>Technical details</summary>

Addresses production feedback that the enhanced send-run history from the Newsletters page (added in #137/#148) wasn't reflected on the Dashboard.

Extracted the newsletters-page's `SendRunHistoryList`/`SendRunDetails` pair into a shared `apps/web/src/components/send-run-history.tsx`, dropping the separate `newsletterId` prop in favor of reading it off `run.newsletterId` (already present on every `SendRun`) so the same list can render runs spanning multiple newsletters. Added an optional `newsletterName` field the Dashboard's cross-newsletter feed populates and the per-newsletter History tab leaves unset. `apps/web/src/pages/newsletters-page.tsx` and `dashboard-page.tsx` both now import from the shared module instead of each keeping their own copy — `dashboard-page.tsx`'s old flat `RecentRunRow` is gone.

</details>
