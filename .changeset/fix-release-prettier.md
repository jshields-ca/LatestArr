---
"@latestarr/server": patch
---

Fix the release workflow's second crash: `changeset version` auto-formats every `CHANGELOG.md` it touches with the project's own Prettier config (`.prettierrc.cjs` exists at the repo root) by shelling out to `pnpm exec prettier`, but `prettier` was never actually installed as a dependency — only its config file existed. Added `prettier` as a root devDependency so that auto-format step, and the config file that's been sitting unused, actually works.
