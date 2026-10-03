---
"@latestarr/server": patch
---

**Fixed:** Updated two third-party libraries with published security fixes, so LatestArr isn't exposed to their denial-of-service and address-matching bugs.

<details>
<summary>Technical details</summary>

- `ip-address` 10.7.0 → 10.7.3 (via `@fastify/rate-limit`, so it ships in the server): fixes an unbounded parse diagnostic on long input that could stall the process, and `isInSubnet()` comparing IPv4 and IPv6 addresses as one address space.
- `brace-expansion` 1.1.18 → 1.1.21 and 5.0.9 → 5.0.12 (via `minimatch`, build and lint tooling): fixes stack exhaustion on nested or comma-heavy brace patterns and quadratic-time expansion.
- Lockfile-only change (`pnpm update --depth Infinity`), within each parent's allowed range. Clears Dependabot alerts #61–#68.

</details>
