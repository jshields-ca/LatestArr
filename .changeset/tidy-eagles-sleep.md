---
"@latestarr/web": minor
"@latestarr/server": minor
---

**New:** Bulk-import recipients by pasting a list of emails or uploading a CSV, instead of adding people one at a time.

<details>
<summary>Technical details</summary>

New "Import" button on the Recipients page opens a dialog with a paste area (or an "Upload CSV" button that reads a file's text into the same field). `apps/web/src/lib/recipient-import.ts` parses the pasted/uploaded text tolerating the formats people actually paste: one bare email per line, `email,Name` or `Name,email` CSV-style pairs (either order), `Name <email>` mailto-style entries, and a flat comma/semicolon-separated address list copied straight from a mail client's To field — with a live "N recipients ready to import, M lines couldn't be parsed" preview and the unparseable lines shown before anything is submitted.

New `POST /recipients/import` (`apps/server/src/http/routes/recipients.ts`) accepts the parsed rows and processes them one at a time rather than as a single multi-row insert, so one bad or duplicate row doesn't fail the whole batch — it returns which rows were `created` and which were `skipped` with a reason (invalid email, already exists, or duplicate within the same import), which the dialog displays after submitting.

</details>
