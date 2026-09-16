---
"@latestarr/web": patch
---

Simplify the SMTP profile Add/Edit dialog's port and encryption copy. Based on direct user testing feedback, the two-sentence paragraph explaining STARTTLS vs. implicit TLS under the "Use implicit TLS" toggle assumed email-server knowledge most self-hosters don't have. It's replaced with a "Port & encryption" section containing a compact, always-visible reference (587 = STARTTLS, 465 = implicit TLS, 25/2525 = usually unencrypted) and a one-line hint under the toggle, both wired up with `aria-describedby` for accessibility. The toggle's behavior (including auto-defaulting on for port 465) is unchanged.
