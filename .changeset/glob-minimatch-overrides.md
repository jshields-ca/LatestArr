---
"@latestarr/server": patch
---

**Improved:** Updated glob and minimatch to clear two moderate security alerts, so image scanners stop flagging them.

LatestArr isn't exposed to either problem: nothing lets a user supply a file search pattern, and it never cancels a file search. Nothing to do when upgrading.

<details>
<summary>Technical details</summary>

Clears GHSA-g3hv-75wg-m249 (CVE-2026-118764, minimatch pattern amplification, fixed in 11.0.1) and GHSA-3g3m-2fjr-6pw4 (CVE-2026-118773, glob's abort signal not stopping a walk, fixed in 14.0.2). @fastify/static 10.1.8 → 10.1.9 moves to glob 14; its glob only runs with `wildcard: false`, which LatestArr doesn't set. js-beautify, editorconfig and mjml-cli still ask for the old versions, and only their command-line tools use them, which LatestArr doesn't run. So root `pnpm.overrides` force `glob@13` → `^14.0.2` and `minimatch@10` → `^11.0.1`; they can go once those packages catch up. The linting-only minimatch 3.1.5 (via eslint-plugin-jsx-a11y) stays, as it doesn't contain the affected code.

@fastify/static 10.1.9 also sends a request for a directory with no index file to the not-found handler rather than a 403, so a GET like `/assets` now gets the web app's page.

</details>
