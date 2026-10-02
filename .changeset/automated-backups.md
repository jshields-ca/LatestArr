---
"@latestarr/server": minor
"@latestarr/web": minor
"@latestarr/db": minor
---

**New:** Automatic backups. LatestArr now backs up its database every day at 03:00 and keeps the last seven, with no downtime. It also backs up before every upgrade. The new **Backups** page (admins only) changes the schedule and what's kept, and can **Back up now**, download, or delete a backup. Point `BACKUP_PATH` at another disk or a NAS so a failed disk can't take both the database and its backups. To restore one, run `docker exec -it latestarr node dist/cli.js restore <file>` and restart.

<details>
<summary>Technical details</summary>

- Closes #263.
- **Snapshots** use SQLite's online backup API (`better-sqlite3`'s `backup()`), never a raw file copy.
  - Each snapshot is switched out of WAL mode and must pass `PRAGMA integrity_check` before it's kept.
  - It's packed into one ZIP with `manifest.json` (version, migration count, item counts, and an `ENCRYPTION_KEY` fingerprint, never the key) and a README.
  - The file is written under a temporary name and renamed, so a crash never leaves a half-written backup.
  - The ZIP writer and reader are small and in-house (`backups/zip.ts`), using Node's `zlib` deflate and `crc32`, so there's no new dependency.
- **Names:** `latestarr-backup-<UTC time>-v<version>-<scheduled|manual|pre-upgrade>.zip`. The folder itself is the list of backups, so it stays right after a restore or a manual copy. Download and delete only accept names matching this pattern, so no other path can be reached.
- **Retention:** keep the newest _N_ (default 7), or calendar rules (the newest of each of the last _D_ days, _W_ weeks, and _M_ months).
  - The newest backup is always kept, and so are the 3 newest pre-upgrade backups.
  - Pruning only runs after a backup succeeds.
- **Schedule:** on by default, daily at 03:00 in the server's time zone (`TZ`), with the same schedule picker as newsletters.
- **Pre-upgrade backup:** taken at startup, before migrations, whenever the version that last ran the database (now saved as `appVersion`) differs from this one. Databases from before 0.12 are labelled "earlier".
- **Failures** are logged, shown on the Backups page, and sent as a failure alert (new **A backup fails** option, on by default, at most one an hour).
- **Restore** uses the recovery CLI:
  - `check-backup <file>` reports the version, contents, integrity, and whether the key matches.
  - `restore <file>` stages a checked database (`restore-pending.db`), and the next start swaps it in, keeping the old one as `latestarr.db.before-restore-<time>`. `restore --cancel` undoes the staging.
  - It refuses a backup made with another key (unless `--ignore-key-mismatch`) or by a newer version.
  - At startup, LatestArr warns if `ENCRYPTION_KEY` can't decrypt the saved credentials.
- **Routes:** `GET`/`POST /backups`, `PUT /backups/settings`, `GET /backups/:filename/download`, `DELETE /backups/:filename`, all admin only.
  - Downloads are `no-store` and logged at warn level.
  - The page warns when backups share the database's disk (same device id).
- `docker/entrypoint.sh` gives the `node` user a separate `BACKUP_PATH` mount. Backup files are written `0600`.
- Docs: a new "Backups" section with "Restoring a backup" in `docs/self-hosting.md`, plus `BACKUP_PATH` in `.env.example`.

</details>
