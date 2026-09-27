---
"@latestarr/server": minor
"@latestarr/web": minor
---

**New:** Get alerted when a scheduled newsletter fails. A new **Notifications** page can email you through one of your SMTP profiles, post to Discord, Slack, ntfy, or Apprise, or send generic JSON to your own endpoint. It covers sends that fail entirely, sends that only reach some recipients, and newsletters that can't send at all, for example because their SMTP profile was deleted. Use **Send test alert** to check a destination before saving.

<details>
<summary>Technical details</summary>

Closes #195.

- `apps/server/src/notifications/alerts.ts`: settings live in the `settings` table (key `notifications`), with the webhook URL encrypted like other credentials, since Discord and Slack webhook URLs grant posting rights. `sendFailureAlert` never throws, rate-limits to one alert per newsletter and kind per hour (in memory), and logs each delivery attempt. Formats: Discord `{content}`, Slack `{text}`, ntfy plain-text body with `Title`/`Priority`/`Tags` headers, Apprise `{title, body, type}`, and generic JSON `{event, title, message, newsletter, trigger, sendRunId, time}`. Webhook requests time out after 10s.
- `run-newsletter.ts` alerts for scheduled and catch-up sends only: on a thrown failure (including `NewsletterMisconfiguredError`, but not an overlapping run or a deleted newsletter), when a send reaches none of its recipients, and on partial failure. Manual Send now never alerts.
- `GET/PUT /notifications` (the URL is never returned, only `hasUrl`/`urlHost`; an omitted `url` keeps the saved one; `http(s)` only) and `POST /notifications/test`, which tests the settings as entered without saving them.
- SMTP credential building moved to a shared `mailer/credentials.ts` (`smtpCredentialsFor`), used by the SMTP profile routes, the send pipeline, and alerts.
- Web: `/notifications` page (nav item "Notifications") with an explicit Save; the only SMTP profile and the admin's email are prefilled. Documented under "Failure alerts" in `docs/self-hosting.md`.

</details>
