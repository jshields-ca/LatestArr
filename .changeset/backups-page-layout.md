---
"@latestarr/web": patch
---

**Improved:** A clearer Backups page, from release testing.

- **Status at a glance:** one card shows the last backup, the next one, where they're saved, and how many there are with their total size. A note in that card warns when they're on the same disk as the database, with a link to how to fix it.
- **Always in agreement:** the last backup comes from the backups actually in the folder. After changing `BACKUP_PATH`, it no longer names a backup the list doesn't show.
- **Backups first:** Saved backups comes next, newest first, with Download and Delete in each row.
- **Settings summed up:** Schedule and retention says what's set in its header, like "Daily at 3:00 AM (UTC), keeps the latest 7.". Its form no longer stretches across the page.
- **Restoring in three steps:** check, restore, and restart, each with a copy button, already filled in with your newest backup's name. The `ENCRYPTION_KEY` reminder sits with them.

<details>
<summary>Technical details</summary>

- From release testing in #281.
- **`pages/backups-page.tsx`:** the status card is a definition list, and "Last backup" uses the newest file unless a later run failed. Backups list inside a card. The settings form is `max-w-xl`, with retention in its own group. `RestoreCard` has a `Command` component for copying with `navigator.clipboard`.
- Tests cover the summary, the folder-based status, and copying a command.

</details>
