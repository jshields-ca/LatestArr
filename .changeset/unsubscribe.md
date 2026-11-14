---
"@latestarr/server": minor
"@latestarr/web": minor
"@latestarr/db": minor
---

**New:** Recipients can unsubscribe themselves. Every newsletter has an **Unsubscribe** link, and mail apps like Gmail can show their own Unsubscribe button.

- **One step for them:** the link opens a short page that asks first. Unsubscribing leaves every newsletter on your LatestArr, and they can subscribe again from the same page.
- **On the Recipients page,** they show as **Unsubscribed** with the date, in place of the Active switch. An editor can't switch them back on.
- **In a send's history,** they're listed as skipped because they unsubscribed.
- **Needs `WEB_ORIGIN`** set to the address recipients can reach LatestArr at. Left at `localhost`, newsletters go without a link, and the Logs page says so. Mail apps' own button also needs that address to be `https://`.
- **Code designs** add the link with `{{unsubscribeUrl}}`.

<details>
<summary>Technical details</summary>

Closes #383. Recipients gain `unsubscribed_at` (migration 0013), separate from `isActive`. Each recipient's existing random `unsubscribeToken` is the key; it's no longer included in any recipients or groups API response.

- **Links and headers:** the email is rendered once with a placeholder, and each copy gets its recipient's token just before sending (`mailer/unsubscribe.ts`), so stored sends hold no tokens. Copies carry `List-Unsubscribe` and `List-Unsubscribe-Post: List-Unsubscribe=One-Click` (RFC 8058) when `WEB_ORIGIN` is `https`. Previews and test sends get a link marked as a preview, and no headers. Send to the rest gives each copy its own link too.
- **Public routes,** listed as public in `security.test.ts`: `POST /api/unsubscribe/:token` (one-click; accepts the form-encoded or multipart body mail providers send) and `POST /api/unsubscribe` (the page, with the token in the body). Both are limited to 20 requests a minute per address, answer 404 for an unknown token without saying anything about the list, and log the change. The page's link puts the token after `#`, which browsers don't send; the one-click path's token is hidden in request logs.
- **Same-origin check:** the page's request goes through it like any other; a mail provider's post has no `Origin` and is let through, as the RFC expects.

</details>
