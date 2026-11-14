# Email deliverability

> The friendly version of this guide is on the docs site: **[latestarr.app/docs/email-delivery/deliverability](https://www.latestarr.app/docs/email-delivery/deliverability)**.

A digest that lands in spam stops being read, even after it's fixed. Two things matter most: authenticating your sending domain (SPF, DKIM and DMARC), and a few LatestArr settings.

## Why it matters

LatestArr sends scheduled mail from an address you choose, through an SMTP server you choose. That's also what a spam run from a hijacked account looks like. SPF, DKIM and DMARC tell receiving servers that your SMTP server is allowed to send as your domain. Without them, your first few digests look no different from spam.

## SPF, DKIM and DMARC

- **SPF** is a DNS TXT record on your sending domain that lists the servers allowed to send as it. It's DNS only; nothing changes in LatestArr.
- **DKIM** signs each message, so the receiver can check it came from a server holding your domain's key and wasn't changed on the way. Your SMTP provider or server does the signing, not LatestArr.
- **DMARC** is another DNS TXT record. It tells receivers what to do when SPF or DKIM fails (nothing, quarantine or reject) and where to send reports. It's what makes SPF and DKIM count.

They go on the domain of the email server's **From email**. That's not the domain LatestArr runs on, and not your provider's own domain.

## Choosing an SMTP provider

LatestArr works with any standard SMTP server. Add it on the **Email servers** page. Sending only goes out from LatestArr, so none of these need LatestArr to be reachable from the internet.

- **A transactional email provider** (Resend, Mailgun, Postmark, SendGrid, Amazon SES, Brevo and others) is the easiest. When you verify your domain, they show the SPF and DKIM records to add, and they sign every message from then on. Use the SMTP credentials they give you, not your account login. For example, [Resend](https://resend.com/docs/send-with-smtp):
  - **Host** `smtp.resend.com`, **port** 465 with **Use implicit TLS (port 465)** on (or 587 with it off);
  - **username** `resend`, and an API key from Resend as the **password**;
  - a **From email** on a domain you've verified in Resend.
- **Gmail or Google Workspace** works with an [app password](https://support.google.com/accounts/answer/185833) for a small household list. Google signs mail for `smtp.gmail.com` itself, but free Gmail's limit of 500 messages a day rules it out for larger lists.
- **Your own mail server** gives full control and full responsibility: you set up SPF, DKIM and DMARC yourself, and build your server's reputation. That's hardest for a small weekly digest, because reputation comes from steady volume.

## Checking it works

After adding the DNS records, use **Send test email** on the email server. Open the message's headers (often called "Show original") and look for `spf=pass` and `dkim=pass`. [mail-tester.com](https://www.mail-tester.com/) gives a fuller score.

### If DKIM shows `temperror` or `fail`

The message's `DKIM-Signature` header names the selector (`s=`) and domain (`d=`). The key lives at `<selector>._domainkey.<domain>`, as a TXT record starting `v=DKIM1`. Check it with any DNS tool, e.g. `nslookup -type=TXT <selector>._domainkey.<domain>`.

- **`dkim=temperror`:** the receiver couldn't look up the key at that moment. Often a passing DNS problem; if it keeps happening, the record may be missing or malformed.
- **`dkim=fail`:** the record doesn't match the key your server signs with, often after a provider rotates keys. Copy the current record from your provider.
- **No `DKIM-Signature` header:** your server isn't signing. Turn on DKIM for the sending domain in your provider's settings.

## What LatestArr does for you

- **From name** and **From email** on the email server become each message's `From`. Use an address on the domain you've authenticated.
- **One message per recipient,** never one message to the whole list, which spam filters also distrust.
- **A plain-text version** goes with every HTML email. HTML-only mail scores worse with spam filters.

## Unsubscribing

Every newsletter carries an **Unsubscribe** link for its recipient, and the `List-Unsubscribe` and `List-Unsubscribe-Post` headers (RFC 8058) that let Gmail, Yahoo and other mail apps show their own Unsubscribe button.

- **Unsubscribing leaves every newsletter** on your LatestArr. The **Recipients** page shows who unsubscribed and when. An editor can't switch them back on; the person can, from the same link.
- **Opening the link changes nothing.** The page asks first, so a mail scanner that follows links can't unsubscribe anyone.
- **Code designs** add the link with `{{unsubscribeUrl}}`. The headers go out either way.

### Where the link points

The link uses `PUBLIC_URL` if it's set, otherwise `WEB_ORIGIN`. What recipients get depends on that address:

| The address | What recipients get |
| --- | --- |
| Public and `https://` | The link, and their mail app's own Unsubscribe button. |
| Public, plain `http://` | The link. No button from the mail app, which needs `https://`. |
| On your home or private network (`192.168…`, `10…`, Tailscale, `.local`, …) | A link that only works for people on that network. The Logs page warns on each send. |
| `localhost` (the default), or not set | No link. The Logs page warns on each send. |

Whenever the link can't work for everyone, recipients can still **unsubscribe by replying**. Each email carries a `List-Unsubscribe` header with a `mailto:` address, so Gmail, Apple Mail and others show an Unsubscribe button that emails you "Unsubscribe". Without a link, the footer also says "Don't want these? Reply and ask to unsubscribe." LatestArr doesn't read your mail, so you turn them off on the **Recipients** page yourself.

- **Replies go** to the newsletter's reply-to address if it has one, otherwise its From address.
- **A `noreply@` address gets no reply option,** since nobody reads it. Use a From address someone reads.

### Publish only the unsubscribe page

LatestArr can stay private while its unsubscribe page is public. Give the page its own address through a reverse proxy or tunnel that passes on only these paths, and set `PUBLIC_URL` to it. Keep `WEB_ORIGIN` as the address you use, so sign-in, SSO and password resets carry on as before.

| Path | What it is |
| --- | --- |
| `/unsubscribe` | The page |
| `/assets/*`, `/favicon.svg` | The app's scripts, styles and icon (the same code as on GitHub; nothing private) |
| `/api/unsubscribe`, `/api/unsubscribe/*` | Unsubscribing, and mail apps' one-click requests |

Everything else, including sign-in and the rest of the API, stays unreachable from outside. The unsubscribe requests need no account, are rate-limited, and say nothing about who's on your list. The page also checks whether someone's signed in; blocking that is fine.

Set `TRUST_PROXY=true` in LatestArr, so its rate limit counts each visitor separately rather than treating everyone as the proxy.

**Caddy:**

```
unsubscribe.example.com {
	@unsubscribe path /unsubscribe /assets/* /favicon.svg /api/unsubscribe /api/unsubscribe/*
	handle @unsubscribe {
		reverse_proxy latestarr:3000
	}
	handle {
		respond 404
	}
}
```

**Cloudflare Tunnel** (`config.yml`; nothing to open on your router):

```yaml
ingress:
  - hostname: unsubscribe.example.com
    path: ^/(unsubscribe|assets/.*|favicon\.svg|api/unsubscribe(/.*)?)$
    service: http://latestarr:3000
  - hostname: unsubscribe.example.com
    service: http_status:404
  - service: http_status:404
```

**nginx:**

```nginx
server {
    server_name unsubscribe.example.com;
    # listen 443 ssl; and your certificate here

    location ~ ^/(unsubscribe|favicon\.svg|api/unsubscribe(/.*)?)$ {
        proxy_pass http://latestarr:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    location /assets/ {
        proxy_pass http://latestarr:3000;
    }
    location / {
        return 404;
    }
}
```

Then set `PUBLIC_URL=https://unsubscribe.example.com` and restart LatestArr. To check, open `https://unsubscribe.example.com/unsubscribe#preview`: it should say the link is from a preview. The sign-in page at the same address should not load.

## What it doesn't do yet

Deleting an unsubscribed person and adding them again starts them afresh, subscribed. Leave them on the list instead.
