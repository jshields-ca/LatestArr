---
"@latestarr/server": patch
---

**Fixed:** A From name with special characters can no longer change the address an email is sent from. Security updates for nodemailer and other dependencies are included too.

- **From name:** LatestArr built the From header as one piece of text, "Name <address>", which the email library then had to read apart. A name containing angle brackets, like `Flix <other@example.com>`, made emails come from that other address. The name and address are now passed separately, so any name is kept as just a name. This covered newsletters, test emails, password reset emails and alerts. Only editors and admins can set a From name.
- **Dependencies:** nodemailer 10.1.7 fixes three ways crafted addresses could be misread. It also updates `undici` and `fast-uri`, which come in through other libraries, to clear their security advisories.

<details>
<summary>Technical details</summary>

`fromHeader(name, address)` in `mailer/send.ts` returns `{ name, address }` (or the address alone with no name), used by `loadSender`, password reset, the SMTP test email and alerts. `from-header.test.ts` builds real messages with Nodemailer's stream transport and checks that names with commas, quotes, brackets and semicolons leave one From address. Dependencies: #389 (nodemailer 10.1.0 to 10.1.7 and nine dev and patch updates), #413 (undici 6.29.1, 7.30.1 and 8.12.3, and fast-uri 3.1.9 and 4.2.3).

</details>
