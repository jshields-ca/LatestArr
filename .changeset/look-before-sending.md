---
"@latestarr/server": minor
"@latestarr/web": minor
---

**New:** Preview a newsletter before it goes out. The new **Preview** button shows exactly what the next send would contain, with real items, images, and your intro and buttons, without emailing anyone. From the same window you can send a test copy to just yourself.

<details>
<summary>Technical details</summary>

Closes #193. `apps/server/src/pipeline/run-newsletter.ts` now separates loading a newsletter (`loadNewsletter`), its SMTP sender (`loadSender`), and rendering from delivery. Real sends, `previewNewsletter`, and `sendTestNewsletter` all use the same render path, so the preview matches the sent email.

- `POST /newsletters/:id/preview` returns `{ subject, html, items }`. Embedded images (normally `cid:` attachments) are swapped for inline `data:` URIs so a browser can show them. It needs no SMTP profile, creates no send-run, and doesn't affect missed-send catch-up. A failure returns 502 with the same readable reason as Send now and is logged as a warning.
- `POST /newsletters/:id/send-test` (`{ to }`) sends the render to one address with a `[Test]` subject prefix, with no send-run, and logs `Sent a test of "…" to …` with `trigger: "test"` and the admin's email.
- Web: `NewsletterPreviewDialog` renders the HTML in a sandboxed `<iframe srcdoc>` (no scripts or same-origin access; popups allowed so the email's links open in a new tab) and prefills the test address with the signed-in admin's email via a new `useOptionalAuth()`.

This preview is also the live preview the upcoming design editor (#199) and code mode (#200) will build on.

</details>
