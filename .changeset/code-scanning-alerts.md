---
"@latestarr/server": patch
"@latestarr/web": patch
---

**Fixed:** A design's logo is no longer downloaded from the server's own network. An editor could set a logo's address to something on your home network, such as a camera's snapshot, and a test send would email them the image. Logos from the internet work as before; for an image on your own network, upload it.

<details>
<summary>Technical details</summary>

From GitHub code scanning (CodeQL).

- **Alert 30, logo URLs:** `fetchLogoImage` now downloads through `fetchPublic` (`pipeline/public-fetch.ts`). It refuses private, loopback, link-local (including cloud metadata), CGNAT/Tailscale, multicast and reserved addresses, and IPv6 unique-local, link-local and IPv4-mapped forms of those. The check is on the address actually connected to, through the request's DNS lookup, so a name resolving to a private address is refused. A private address written as an IP is refused before connecting, and each of up to three redirects is checked again. A refused logo is linked instead, as any logo that can't be embedded already was. Linked logos and uploads are unchanged.
- **Alert 28, template code injection:** code designs are Handlebars templates editors write. Prototype access is now pinned off (`allowProtoPropertiesByDefault` and `allowProtoMethodsByDefault: false`, Handlebars' defaults since 4.6), with tests that fail if it's turned on.
- **Alert 27, slow regular expression:** the code-design check blanks `{{…}}` in one `indexOf` pass instead of a lazy regex, with the same output (checked against the regex on 2,000 random strings).

</details>
