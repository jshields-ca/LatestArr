---
"@latestarr/adapter-booklore-family": patch
---

**Fixed:** BookLore, BookOrbit and Grimmory sources showed a book whose title is only digits wrongly: "007" appeared as "7" and "1.50" as "1.5". Titles, authors and descriptions now show exactly as the library has them.

<details>
<summary>Technical details</summary>

Fixes #426. The OPDS feed was parsed with fast-xml-parser's defaults, which turn a text node that looks like a number into a JavaScript number. `parseTagValue: false` keeps text as text, and `parseAttributeValue: false` is now set explicitly. `dc:issued` no longer needs converting back to a string. Entry ids were affected the same way (a numeric `<id>` such as `0042` became `42`); the three apps use `urn:` ids, so no links change.

</details>
