---
"@latestarr/server": patch
---

**Improved:** Settings in `.env` can have a `LATESTARR_` prefix, so one `.env` can serve a whole stack.

With the provided `docker-compose.yml`, any setting can be written as `LATESTARR_ENCRYPTION_KEY`, `LATESTARR_PORT`, `LATESTARR_TZ` and so on. The prefixed name wins over the plain one, so LatestArr can't pick up another app's `PORT` or `TZ` from a shared `.env`. The plain names still work as before, so nothing needs changing. **`BACKUP_PATH`** set in `.env` now reaches the container too. Before, it had to go straight into the compose file.

<details>
<summary>Technical details</summary>

`docker-compose.yml` uses Compose's nested defaults, e.g. `${LATESTARR_ENCRYPTION_KEY:-${ENCRYPTION_KEY:-}}`. Inside the container the names are unchanged, and the server reads them as before: there's no new way for it to find the encryption key. CI runs `docker compose config` to check plain, prefixed and default values. Fixes #399.

</details>
