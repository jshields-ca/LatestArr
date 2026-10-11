---
"@latestarr/server": minor
"@latestarr/web": minor
---

**New:** A **groups** column in a recipient import adds each person to those groups, and creates any that don't exist yet.

- Put several groups in one cell separated by `;`, or by commas in a file separated by semicolons. Groups match by name, ignoring case and spaces.
- The review lists each group: new or existing, and how many people the import adds to it. Nothing changes until you choose **Import**.
- An import only adds people to groups. It never removes anyone.
- The template file now includes a groups column.

<details>
<summary>Technical details</summary>

- Part 2 of #288.
- **Server:**
  - Import rows take `groups: string[]` (up to 20 names of up to 100 characters each).
  - The plan gains `groups: [{ name, isNew, adding }]`, where existing group names keep their own spelling.
  - Applying, in the same transaction, creates the missing groups and inserts memberships with `onConflictDoNothing`. It returns `createdGroups` and `membershipsAdded`.
  - An existing recipient who only joins groups no longer counts as unchanged.
- **Web:**
  - The parser reads a Group or Groups column, and in heading mode splits cells on the file's own delimiter.
  - The review has a Groups section.
  - New groups and memberships show on the page straight away (`GroupSyncContext`).

</details>
