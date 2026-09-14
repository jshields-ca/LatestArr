---
"@latestarr/server": minor
---

Validate every request body with zod (sources, recipients, recipient groups, SMTP profiles, newsletters, templates, auth) instead of ad-hoc `if (!field)` checks. Malformed types (a string where a number is expected, an object where an array is expected) are now rejected with a 400 instead of reaching the database layer.
