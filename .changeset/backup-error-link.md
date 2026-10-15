---
"@latestarr/server": patch
---

**Improved:** When a backup can't be written, the error links to the fix on latestarr.app.

The message, on the Backups page, in the log and in the failure alert, now ends with a link to the Backups guide's **Can't write** section, which walks through checking and fixing the folder's permissions.

<details>
<summary>Technical details</summary>

`explainFolderError` in `backups/service.ts` appends `https://www.latestarr.app/docs/backups#cant-write`. The site keeps that anchor stable.

</details>
