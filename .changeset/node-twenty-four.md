---
"@latestarr/server": minor
---

**Improved:** The Docker image now runs on Node.js 24, the current long-term support release. Node 22 stops getting security fixes in April 2027. Nothing changes for your setup: pull the new image and restart, and your data and settings carry over.

<details>
<summary>Technical details</summary>

Closes #186.

- `docker/Dockerfile`: both stages use `node:24-alpine`.
- `.nvmrc` and `engines.node` are 24; `@types/node` is `^24.19.0` in every package, matching the runtime (Dependabot still ignores its majors).
- CI tests on Node 24 and 26 (26 becomes LTS in October 2026); the release workflow runs on 24.

</details>
