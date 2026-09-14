# Email deliverability

A digest newsletter that lands in spam is worse than useless — recipients stop trusting it and stop opening it even once it's fixed. This covers the two things that actually move the needle: sender authentication (SPF/DKIM/DMARC) and a few LatestArr-specific settings.

## Why authentication matters here specifically

LatestArr sends mail on a recurring schedule, from an address you configure, through an SMTP server you configure — that's exactly the shape of traffic spam filters are built to scrutinize, because it's also exactly the shape of a compromised-account spam campaign. Without SPF/DKIM/DMARC telling receiving mail servers "yes, this SMTP server is authorized to send as this domain," a real recurring digest and a spam run are indistinguishable to them on the first few sends.

## SPF, DKIM, and DMARC in one paragraph each

- **SPF** (Sender Policy Framework) is a DNS TXT record on your sending domain listing which mail servers are allowed to send mail claiming to be from it. It doesn't require anything from LatestArr or nodemailer — it's pure DNS configuration on whatever domain your `defaultFromEmail` uses.
- **DKIM** (DomainKeys Identified Mail) cryptographically signs each outgoing message so the receiving server can verify it wasn't altered in transit and genuinely came from a server holding your domain's private key. The SMTP provider or server signs the message — LatestArr just needs to send through a server that's configured to do this, it doesn't sign anything itself.
- **DMARC** tells receiving servers what to do when a message fails SPF or DKIM (quarantine, reject, or nothing), and gives you a reporting address to see who's sending mail claiming to be your domain. It's a DNS TXT record too, and it's what actually gets enforced — SPF/DKIM alone are advisory without it.

## Setting these up depends entirely on your SMTP provider

LatestArr talks to SMTP over the standard protocol (via nodemailer) and has no opinion on which provider you use — configure any of these as an SMTP profile:

- **A transactional email provider** (Mailgun, Postmark, SendGrid, Amazon SES, Brevo, etc.) — the easiest path. These providers walk you through adding their SPF include and a DKIM CNAME/TXT record to your domain's DNS when you verify a sending domain in their dashboard, and DKIM signing happens automatically on their end from then on. Use the SMTP credentials they issue, not your provider account's own login.
- **Gmail/Google Workspace** — usable via an [app password](https://support.google.com/accounts/answer/185833) if you're sending a low volume from a personal or Workspace account, but Gmail already applies its own SPF/DKIM for `smtp.gmail.com`, and Google's sending limits (500/day on free Gmail) make it a poor fit for anything beyond a small household setup.
- **A self-hosted mail server** — full control, full responsibility: you configure SPF/DKIM/DMARC on your own domain's DNS yourself and are responsible for your own sending IP's reputation, which is the hardest path to get right for infrequent, low-volume sends like a weekly digest (reputation is built by volume and consistency).

Whichever you choose, the domain that needs SPF/DKIM/DMARC configured is the domain in your SMTP profile's **`defaultFromEmail`** — not the domain LatestArr itself is hosted at, and not your SMTP provider's own domain.

## Verifying it worked

After setting up DNS records, use **Send test email** on the SMTP profile's detail page, then check the received message's headers (most webmail clients show this as "Show original" or similar) for `spf=pass` and `dkim=pass`. [mail-tester.com](https://www.mail-tester.com/) gives a more thorough score if you want a second check.

## What LatestArr does and doesn't do for you

- The `defaultFromName`/`defaultFromEmail` on an SMTP profile become the message's `From` header on every send — make sure the address matches whichever domain you've authenticated.
- **There's no built-in unsubscribe mechanism yet** — no `List-Unsubscribe` header, no self-serve opt-out link in the sent email. Today, removing someone from future sends means an admin toggling that recipient inactive (or deleting them) from the Recipients screen. If you're sending to more than a handful of people who didn't explicitly ask to be on the list, be aware this is a real gap against CAN-SPAM/GDPR one-click-unsubscribe expectations, not just a deliverability nicety — mailbox providers increasingly penalize senders without it, independent of authentication.
- Every send goes out individually per recipient (not one message BCC'd to the whole group), which avoids the "large recipient list in one message" pattern spam filters also scrutinize.
