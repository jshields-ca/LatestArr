---
"@latestarr/server": patch
---

**Fixed:** Updated Handlebars, the template engine behind newsletter and design templates, to pick up upstream security fixes.

<details>
<summary>Technical details</summary>

- `handlebars` 4.7.9 → 4.7.10, and the server's range raised to `^4.7.10` so older versions can't be resolved.
- Fixes three JavaScript-injection advisories (Dependabot alerts #71, #72 and #73): an own-property check bypass, AST type confusion in `compile`, and unsafe inline embedding of precompiled templates.

</details>
