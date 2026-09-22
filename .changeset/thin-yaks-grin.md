---
"@latestarr/web": minor
---

**Improved:** The Edit SMTP profile dialog is now split into Connection / Authentication / Sender identity tabs instead of one long scrolling form.

<details>
<summary>Technical details</summary>

Same pattern as the newsletter edit page's Details/History split (`newsletters-page.tsx`) — the Port & encryption group (port field, the always-visible port-convention reference, and the implicit-TLS switch) took up a lot of vertical space on its own, which is what made the dialog feel cramped as a single stacked view. `EditSmtpProfileDialog` in `apps/web/src/pages/smtp-profiles-page.tsx` now wraps Host/Port/encryption, Username/Password, and From name/From email in `Tabs`, with Name staying outside the tabs since it's the profile's own label. The Add SMTP profile dialog is unchanged — it's shorter and wasn't the one reported as cramped.

</details>
