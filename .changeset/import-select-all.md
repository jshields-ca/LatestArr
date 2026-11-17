---
"@latestarr/web": minor
"@latestarr/server": patch
---

**Improved:** Choose who to import with **Select all**, in both ways of importing recipients.

- **From a source:** a **Select all** box above the list ticks or unticks everyone who can be imported, and shows how many are ticked. People with no email and people already on your list aren't counted. The button says how many it will import: **Import 12 people**.
- **From a file:** the review's list of new recipients has a box on each row and the same **Select all**, all ticked to start. Untick someone to leave them out without editing the file. The review's counts and groups update to match.

<details>
<summary>Technical details</summary>

Closes #453. A new `SelectAllCheckbox` component shows the partly-ticked state the way the Recipients table's heading box does, with an "N of M selected" count that covers rows hidden behind **Show all**.

- **Source dialog:** `canImport()` (an email, not already on the list) decides who the box covers. Select none leaves nothing ticked and turns off Import.
- **File dialog:** people left out are kept by email (lowercased and trimmed) and filtered from the rows sent to `POST /api/recipients/import`. `withoutLeftOut()` in `lib/recipient-import.ts` adjusts the review on the client. It drops those people and their place in each group, and drops a group that only they were joining, which the server would then neither create nor change. People already on the list who join a group are still counted. The review also stops listing their repeated rows as skipped, since those aren't sent either. Applying needs no server change, because it works the plan out again from the rows sent.
- **Server fix found in review:** a row naming one group twice in different cases (`Family;family`) counted twice towards that group and added the membership twice. It now counts once.

</details>
