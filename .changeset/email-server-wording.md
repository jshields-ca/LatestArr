---
"@latestarr/web": patch
"@latestarr/server": patch
---

**Improved:** "SMTP profile" is now "email server" throughout, so the app says what the thing is.

- Buttons, labels, messages and log lines say **email server**, like "Add email server" and "Choose an email server".
- The form's fields are now **SMTP host** and **SMTP port**, the names your mail provider's instructions use.
- The setup checklist step is "Add an email server".

Nothing about how it works has changed, and your saved servers are untouched.

<details>
<summary>Technical details</summary>

A wording change from the UI review (#332), following the page's rename to "Email servers". It covers the web app's strings, the server's error and log messages (for example "Newsletter has no email server configured" and `Added email server "…"`), and `docs/self-hosting.md` and `docs/deliverability.md`. The `/smtp` route, the `/api/smtp-profiles` endpoints, `smtpProfileId` in requests and logs, and the database are unchanged, so scripts, bookmarks and backups keep working. Anything that matches on the old message text, such as a log alert, needs the new wording. The docs' two mentions of the header's pencil button now describe the account menu from #428.

</details>
