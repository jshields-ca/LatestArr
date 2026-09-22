---
"@latestarr/web": minor
"@latestarr/server": minor
---

**New:** A Logs page in the web UI shows recent server activity — failed sends, source sync errors, auth events, and anything else worth troubleshooting — without needing to `docker logs` the container.

<details>
<summary>Technical details</summary>

The server's pino logger now writes to two destinations via `pino.multistream`: stdout (unchanged — still what `docker logs` shows) and a new in-memory ring buffer (`apps/server/src/log-buffer.ts`, capped at 500 entries), which drops Fastify's routine per-request "incoming request"/"request completed" pair so the buffer holds actual events instead of being drowned out by ordinary traffic. New `GET /logs` (`?level=warn|error|...` and `?limit=`) serves recent entries with a human-readable level label.

The new Logs page polls this on load/refresh/filter-change, showing each entry's level (color-coded), timestamp, and message, with a "Details" toggle that expands the entry's full raw context (request info, error type/message/stack) for whichever ones carry it.

Note for anyone extending `apps/server/src/app.ts`: pino's actual destination is its *second* constructor argument — `pino(multistreamResult)` alone silently falls back to pino's own default stdout destination and never writes to any custom stream in the multistream array; it has to be `pino(options, multistreamResult)`. Confirmed via a minimal repro while building this — easy to get wrong and have it look like it's working (the primary stdout destination still logs normally) while the second destination silently receives nothing.

</details>
