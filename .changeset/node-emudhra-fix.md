---
"@latestarr/server": patch
---

**Fixed:** The image is built on Node.js 24.22.1, which no longer trusts the eight compromised eMudhra certificates.

Those certificates had keys weak enough to work out, so someone with them could make a fake HTTPS certificate for any site. LatestArr uses Node's built-in list of trusted certificates when it connects to your media servers, your email server, single sign-on and poster images. On 0.12.5 and earlier, someone on the network between LatestArr and one of those could have impersonated it. Updating to 0.12.6 closes that.

Also updates markdown-it to 15.0.3, which fixes two ways crafted Markdown could make it slow. LatestArr's intro and footer notes don't switch on either feature involved, so this is a precaution.

<details>
<summary>Technical details</summary>

No code change for the certificates: `docker/Dockerfile` builds `FROM node:24-alpine`, which now resolves to 24.22.1 (Node's 2026-10-21 security release: it rejects chains containing the eMudhra intermediates' keys and updates the bundled roots to NSS 3.131.1). LatestArr doesn't set `NODE_EXTRA_CA_CERTS`, `--use-system-ca` or `rejectUnauthorized`, so Node's bundled store is the one in use. markdown-it 15.0.3 (#385) fixes GHSA advisories for quadratic-time reference definitions and inline HTML; `render/notes.ts` uses the `zero` preset without `reference`, and with `html: false`.

</details>
