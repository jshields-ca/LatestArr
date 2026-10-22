# Email deliverability

> The friendly version of this guide is on the docs site: **[latestarr.app/docs/email-delivery/deliverability](https://www.latestarr.app/docs/email-delivery/deliverability)**.

A digest that lands in spam stops being read, even after it's fixed. Two things matter most: authenticating your sending domain (SPF, DKIM and DMARC), and a few LatestArr settings.

## Why it matters

LatestArr sends scheduled mail from an address you choose, through an SMTP server you choose. That's also what a spam run from a hijacked account looks like. SPF, DKIM and DMARC tell receiving servers that your SMTP server is allowed to send as your domain. Without them, your first few digests look no different from spam.

## SPF, DKIM and DMARC

- **SPF** is a DNS TXT record on your sending domain that lists the servers allowed to send as it. It's DNS only; nothing changes in LatestArr.
- **DKIM** signs each message, so the receiver can check it came from a server holding your domain's key and wasn't changed on the way. Your SMTP provider or server does the signing, not LatestArr.
- **DMARC** is another DNS TXT record. It tells receivers what to do when SPF or DKIM fails (nothing, quarantine or reject) and where to send reports. It's what makes SPF and DKIM count.

They go on the domain of the SMTP profile's **From email**. That's not the domain LatestArr runs on, and not your provider's own domain.

## Choosing an SMTP provider

LatestArr works with any standard SMTP server. Add it on the **SMTP Profiles** page. Sending only goes out from LatestArr, so none of these need LatestArr to be reachable from the internet.

- **A transactional email provider** (Resend, Mailgun, Postmark, SendGrid, Amazon SES, Brevo and others) is the easiest. When you verify your domain, they show the SPF and DKIM records to add, and they sign every message from then on. Use the SMTP credentials they give you, not your account login. For example, [Resend](https://resend.com/docs/send-with-smtp):
  - **Host** `smtp.resend.com`, **port** 465 with **Use implicit TLS (port 465)** on (or 587 with it off);
  - **username** `resend`, and an API key from Resend as the **password**;
  - a **From email** on a domain you've verified in Resend.
- **Gmail or Google Workspace** works with an [app password](https://support.google.com/accounts/answer/185833) for a small household list. Google signs mail for `smtp.gmail.com` itself, but free Gmail's limit of 500 messages a day rules it out for larger lists.
- **Your own mail server** gives full control and full responsibility: you set up SPF, DKIM and DMARC yourself, and build your server's reputation. That's hardest for a small weekly digest, because reputation comes from steady volume.

## Checking it works

After adding the DNS records, use **Send test email** on the SMTP profile. Open the message's headers (often called "Show original") and look for `spf=pass` and `dkim=pass`. [mail-tester.com](https://www.mail-tester.com/) gives a fuller score.

### If DKIM shows `temperror` or `fail`

The message's `DKIM-Signature` header names the selector (`s=`) and domain (`d=`). The key lives at `<selector>._domainkey.<domain>`, as a TXT record starting `v=DKIM1`. Check it with any DNS tool, e.g. `nslookup -type=TXT <selector>._domainkey.<domain>`.

- **`dkim=temperror`:** the receiver couldn't look up the key at that moment. Often a passing DNS problem; if it keeps happening, the record may be missing or malformed.
- **`dkim=fail`:** the record doesn't match the key your server signs with, often after a provider rotates keys. Copy the current record from your provider.
- **No `DKIM-Signature` header:** your server isn't signing. Turn on DKIM for the sending domain in your provider's settings.

## What LatestArr does for you

- **From name** and **From email** on the SMTP profile become each message's `From`. Use an address on the domain you've authenticated.
- **One message per recipient,** never one message to the whole list, which spam filters also distrust.
- **A plain-text version** goes with every HTML email. HTML-only mail scores worse with spam filters.

## What it doesn't do yet

**There's no unsubscribe link or `List-Unsubscribe` header yet.** To stop sending to someone, an editor or admin turns them off (**Active**) or deletes them on the **Recipients** page. Mailbox providers increasingly expect one-click unsubscribe, and laws like CAN-SPAM and GDPR may too. If you send to people who didn't ask to be on the list, keep this gap in mind.
