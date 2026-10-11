---
"@latestarr/server": minor
---

**New:** The container image now runs natively on ARM: Apple Silicon Macs, Raspberry Pi 4 and 5 (on a 64-bit OS), ARM NAS boxes and cloud servers. Docker picks the right image for you, so `docker compose pull` just works, with no `--platform linux/amd64` emulation.

<details>
<summary>Technical details</summary>

- Closes #318.
- **`publish-image.yml`** is a new reusable workflow used by `dev-image.yml` and `release.yml`.
  - It builds `linux/amd64` on `ubuntu-latest` and `linux/arm64` natively on `ubuntu-24.04-arm`, rather than under QEMU. Each pushes by digest.
  - A merge job then publishes one multi-platform manifest per tag, and checks that both architectures are there.
- **CI:** builds and smoke-tests the arm64 image too ("Docker build (arm64)"). The native modules (better-sqlite3, sharp, @node-rs/argon2) load at startup, so a missing arm64 binary fails the health check. The required "Docker build" check keeps its name.
- **Out of scope:** 32-bit ARM (`linux/arm/v7`), because sharp ships no prebuilt binaries for it.

</details>
