---
"@latestarr/web": patch
---

**Improved:** The Backups page's help links open the Backups guide on latestarr.app.

**Restoring a backup** and the note about where backups are saved now link to the friendly guide instead of the repository's technical reference.

<details>
<summary>Technical details</summary>

`RESTORE_DOCS_URL` and `BACKUP_PATH_DOCS_URL` in `pages/backups-page.tsx` point to `latestarr.app/docs/backups#restoring-a-backup` and `#where-theyre-saved`. The `README.txt` inside each backup still links to `docs/self-hosting.md#restoring-a-backup`, which ships with the code.

</details>
