---
"@latestarr/server": patch
---

**Fixed:** A newsletter's page no longer receives its sources' saved credentials. They were sent encrypted, and the key never left the server, so they couldn't be read, but they had no reason to reach the browser.

<details>
<summary>Technical details</summary>

`GET /api/newsletters/:id` spread each linked `source_connections` row into its response, including `credentialsEncrypted`, since the route was added. It now uses the same `sanitize()` as the Sources routes, with a regression test. No other route returns source rows.

</details>
