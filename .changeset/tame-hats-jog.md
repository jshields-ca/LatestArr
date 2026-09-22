---
"@latestarr/web": patch
---

**Fixed:** SMTP profile cards now correctly label STARTTLS connections (e.g. port 587) instead of showing a misleading "No TLS", and give the "Authenticated" badge success styling instead of neutral.

<details>
<summary>Technical details</summary>

The connection-security badge only checked the `secure` boolean (implicit TLS, i.e. port 465), so any STARTTLS profile — the common case for providers like Dreamhost on port 587 — showed "No TLS" even though the connection is encrypted, just via an upgrade after the initial handshake rather than from the start. `connectionSecurityLabel()` in `apps/web/src/pages/smtp-profiles-page.tsx` now also checks `port`, matching the existing `PORT_GUIDE` convention (465 → Implicit TLS, 587 → STARTTLS, anything else → No TLS), and gives both TLS variants `success` badge styling. The "Authenticated" badge also switches from `neutral` to `success` when `hasAuth` is true.

</details>
