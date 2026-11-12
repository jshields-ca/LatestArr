---
"@latestarr/adapter-booklore-family": patch
---

**Improved:** Updated the library that reads BookLore, BookOrbit and Grimmory feeds, clearing a low-severity security alert. LatestArr wasn't exposed: the problem needs a parser option it doesn't use.

<details>
<summary>Technical details</summary>

fast-xml-parser 5.11.2 → 5.12.0 (#423), with strnum 2.5.1 and is-unsafe 2.0.3. Clears GHSA-474x-hrwr-fgx4 (quadratic CPU use on unterminated tags inside a stop node), which needs the non-default `stopNodes` option; `booklore-client.ts` sets only `ignoreAttributes` and `attributeNamePrefix`. No code change. Checked by parsing the same feed of 24 awkward values (numbers, leading zeros, exponents, CRLF line endings, entities, CDATA) with both versions and LatestArr's parser options: the output is identical.

</details>
