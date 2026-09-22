---
"@latestarr/web": minor
---

**Improved:** The Recipients page now has a search box and shows 25 at a time with a "Show more" button, instead of one long scrolling list — makes it far easier to find someone after a large import (Plex/Tautulli user import, CSV/paste import).

<details>
<summary>Technical details</summary>

Addresses production feedback that a real-world recipient list (~50 rows from a Tautulli user import) made `apps/web/src/pages/recipients-page.tsx`'s flat list hard to navigate.

- Added a client-side search box (`matchesRecipientQuery`) filtering by email or display name, case-insensitive substring match — no API changes, `listRecipients()` still fetches the full list once.
- Capped initial/incremental rendering to `RECIPIENTS_PAGE_SIZE = 25` rows via a `visibleCount` state and a "Show N more" button, reset to the first page whenever the search query changes.
- Header shows a live count ("N recipients" / "N of M match" while searching).

</details>
