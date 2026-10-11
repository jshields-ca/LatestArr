---
"@latestarr/server": minor
"@latestarr/web": minor
---

**Improved:** Importing recipients now shows what will change before anything is saved, and explains the file format.

- **Review first:** after pasting or uploading, **Review** lists the new recipients, name changes for people already on your list, who's already there unchanged, and skipped rows with the reason. Nothing changes until you choose **Import**.
- **Names update:** a name in the file now updates an existing recipient's name. Before, the row was skipped as "Already exists". A row without a name leaves the existing name alone.
- **File format help** with a downloadable template.
- **Spreadsheet-friendly:** a heading row is read by column (Email, E-mail or Email address, plus Name, Full name or Display name), in any order, with other columns ignored. Quoted names like `"Smith, Jane"` stay whole, and cells copied straight from a spreadsheet work too.

<details>
<summary>Technical details</summary>

- Part 1 of #288: format help and a preview before applying.
- **Server:** `POST /api/recipients/import` takes `dryRun: true` and returns `{ plan: { create, update, unchanged, skipped } }` without writing anything (`planRecipientImport` in `http/routes/recipient-import.ts`).
  - Applying works the plan out again inside one transaction (`applyRecipientImport`), and returns `{ created, updated, unchanged, skipped }`.
  - Emails match existing recipients ignoring case.
- **Web:**
  - `components/import-recipients-dialog.tsx` has three steps: edit, review and done. Closing with a pasted list asks first.
  - The parser (`lib/recipient-import.ts`) gains `splitCells`, which is quote-aware and splits on commas, semicolons and tabs. It also maps heading rows to columns and drops a leading byte-order mark.

</details>
