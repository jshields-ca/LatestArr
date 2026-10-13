---
"@latestarr/server": patch
---

**Fixed:** A backup that can't be written now says which folder is the problem.

Before, a backup folder LatestArr couldn't write to failed with SQLite's "unable to open database file", on the Backups page, in the log, and in the failure alert. It now names the folder and says to check that LatestArr can write to it.

<details>
<summary>Technical details</summary>

`makeBackup` maps `SQLITE_CANTOPEN` and file-system errors (`EACCES`, `EPERM`, `EROFS`, `ENOENT`, `ENOTDIR`, `EEXIST`) to a message naming `backupDir`, keeping the original error as `cause`.

</details>
