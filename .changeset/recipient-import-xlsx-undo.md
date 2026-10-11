---
"@latestarr/server": minor
"@latestarr/web": minor
"@latestarr/db": minor
---

**New:** Import recipients from an Excel file, and undo the last import.

- **Excel:** upload an `.xlsx` file. Its first sheet is read like a CSV, with the same review before anything changes. Older `.xls` files get a message asking you to save as `.xlsx` or CSV.
- **Undo last import** appears next to **Import** for 24 hours, or until your next import. It removes the people and groups the import added, takes people back out of the groups it added them to, and puts back the names it changed. Anything changed since is kept, and Undo tells you what. A person is also kept if they've been sent a newsletter since, so their history stays.

<details>
<summary>Technical details</summary>

- Part 3 of #288, which completes it.
- **Excel:**
  - Read in the browser with [read-excel-file](https://www.npmjs.com/package/read-excel-file) 9.3.10 (MIT), loaded only when a spreadsheet is chosen. The server never parses a spreadsheet.
  - read-excel-file doesn't run formulas. It reads the values the spreadsheet app saved.
  - Limits: 5 MB and 1000 rows.
  - The first sheet becomes tab-separated text in the import box (`lib/spreadsheet.ts`), so it goes through the same parser and review as a paste or CSV.
  - Works under the app's CSP (checked in a browser).
- **Undo:**
  - New `recipient_imports` table (migration `0012_recipient_imports`), holding the latest import's changes: recipients created, names changed, memberships added, groups created.
  - `GET /api/recipients/imports/latest` and `POST /api/recipients/imports/:id/undo` are editor-only.
  - `undoRecipientImport` runs in one transaction and returns what it undid, plus what it kept and why: edited or deactivated people, people sent a newsletter since, names changed again, and groups that were renamed, described, used by a newsletter or given other members.
  - Logged on the server.

</details>
