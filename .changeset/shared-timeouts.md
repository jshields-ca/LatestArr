---
"@latestarr/adapter-core": patch
"@latestarr/adapter-jellyfin": patch
---

**Fixed:** Jellyfin and Emby sources wait up to 30 seconds for a response, like every other source.

They gave up after 15 seconds, so a slow or busy server could fail a check or a send that other sources would have finished.

<details>
<summary>Technical details</summary>

- `jellyfin-client.ts` drops its own 15-second `REQUEST_TIMEOUT_MS` for the shared `SOURCE_REQUEST_TIMEOUT_MS`.
- The 10-second image timeout, defined separately in all six adapter clients, is now `IMAGE_REQUEST_TIMEOUT_MS` in `adapter-core`'s `http-limits.ts`.
- Tautulli's leftover `DEFAULT_FETCH_COUNT` is renamed `POPULAR_FETCH_COUNT`, since it now only sizes "most watched".
- The webhook timeout in `alerts.ts` is named `WEBHOOK_TIMEOUT_MS`.

</details>
