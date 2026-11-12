---
"@latestarr/adapter-booklore-family": patch
---

**Improved:** Updated the library that reads BookLore, BookOrbit and Grimmory feeds (fast-xml-parser 5.12.0).

<details>
<summary>Technical details</summary>

fast-xml-parser 5.11.2 → 5.12.0 (#423), with strnum 2.5.1 and is-unsafe 2.0.3. No code change. Checked by parsing the same feed of 24 awkward values (numbers, leading zeros, exponents, CRLF line endings, entities, CDATA) with both versions and LatestArr's parser options: the output is identical.

</details>
