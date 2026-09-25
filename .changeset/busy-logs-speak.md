---
"@latestarr/server": minor
---

**Improved:** The Logs page now records what's actually happening: every newsletter send and how many people it reached, recipients that couldn't be delivered to, sources that couldn't be reached, sign-ins and failed sign-in attempts, and each settings change along with who made it. A new `LOG_LEVEL` setting controls how much detail is kept.

<details>
<summary>Technical details</summary>

Closes #168. Previously the server had three explicit log calls in total, so the Logs page only ever showed startup lines.

- **Shared logger** (`apps/server/src/logger.ts`): one pino instance for Fastify, the send pipeline, and the scheduler, so scheduled sends (which have no request) reach the Logs page too. `LOG_LEVEL` (default `info`) is read from the environment and passed through `docker-compose.yml`; an unknown value falls back to `info` with a warning instead of crashing on startup.
- **Who did it**: `requireAuth` swaps `request.log` for a child logger carrying `user` (the signed-in admin's email), so every line from an authenticated route records the actor.
- **Sends** (`pipeline/run-newsletter.ts`): `runNewsletter` takes `{ trigger, log }` and logs every outcome exactly once — start, success/partial/total failure with counts and duration, each undeliverable recipient (warn), the specific source that couldn't be fetched (warn), a send with no active recipients or no usable sources (warn), and a refused send (not found / misconfigured / already running) as a warn rather than an error. The send-now route and scheduler no longer log send failures themselves.
- **Scheduler**: each refresh logs one line listing every enabled newsletter's next run; startup catch-ups are logged and tagged `trigger: "catch-up"`, cron fires `"scheduled"`, and send-now `"manual"`.
- **Settings changes**: create/update/delete for sources, SMTP profiles, recipients (plus a one-line import summary), groups and memberships, newsletters (with "Enabled"/"Paused" for the toggle and a `fields` list of what changed), templates, and newsletter source/group links. Connection and test-email results for sources and SMTP profiles. Sign-in, failed sign-in (with IP), sign-out, SSO sign-in/rejection, first-admin creation, and password/profile changes.
- Field names are logged for updates, never values, so passwords and API keys can't leak into logs. Tests assert log levels, the `user`/`trigger` fields, and that a password never appears in the buffer.

</details>
