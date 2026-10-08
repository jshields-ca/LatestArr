---
"@latestarr/server": patch
---

**Fixed:** Updated two bundled libraries to pick up upstream security fixes.

<details>
<summary>Technical details</summary>

- Lockfile-only bump of two transitive dependencies:
  - `source-map-js` 1.2.1 → 1.2.2 (event-loop denial of service via indexed source-map offsets; reached through mjml and Tailwind);
  - `shell-quote` 1.10.0 → 1.12.0 (command injection in `quote()`; reached only through `@changesets/cli`, a dev tool).
- Clears Dependabot alerts #69 and #70.

</details>
