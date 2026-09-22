---
"@latestarr/web": minor
---

**Improved:** The Recipients page is now a dense, sortable table with a search box and real pagination — click Name/Email/Status to sort, search narrows results live, and large lists page 25 at a time — instead of one long scrolling list of cards.

<details>
<summary>Technical details</summary>

Addresses production feedback that a real-world recipient list (~50 rows from a Tautulli user import) made `apps/web/src/pages/recipients-page.tsx`'s flat card list hard to navigate. A few layout options were sketched and reviewed before picking this one.

- Replaced the per-recipient `ListRow` cards with a `<table>` (`RecipientTableRow`), each row: Name, Email, an inline Active/Inactive `Switch`, and Edit/Delete actions.
- Added click-to-sort column headers (`SortableColumnHeader`) for Name/Email/Status, toggling ascending/descending on repeat clicks, with proper `aria-sort` on each `<th>` and a visible up/down/unsorted icon.
- Added a client-side search box (`matchesRecipientQuery`) filtering by email or display name, case-insensitive substring match — no API changes, `listRecipients()` still fetches the full list once.
- Replaced incremental "Show more" with real Previous/Next pagination (`RECIPIENTS_PAGE_SIZE = 25`), resetting to page 1 whenever the search query changes.
- Header shows a live count ("N recipients" / "N of M match" while searching).

</details>
