---
"@latestarr/server": patch
---

**Fixed:** LatestArr now checks `ENCRYPTION_KEY` when it starts. If the key is missing or invalid, it stops with a message saying how to generate one. Before, it started anyway, and saving a source or SMTP profile failed with a generic error.

<details>
<summary>Technical details</summary>

- `encryptionKeyProblem()` (`apps/server/src/secrets.ts`) requires `ENCRYPTION_KEY` to be base64 that decodes to exactly 32 bytes. `index.ts` logs the problem at `fatal` and exits 1 before touching the database.
- The wrong-length message warns that credentials already saved need the key they were saved with. (#256)
- The CI smoke test now starts the container with a generated key, and `CONTRIBUTING.md` describes the new startup error for dev setups where Turborepo's strict env mode drops the key.

</details>
