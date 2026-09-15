---
"@latestarr/server": patch
---

Publish a container image to `ghcr.io/jshields-ca/latestarr` on every tagged release (`:latest` and `:vX.Y.Z`), so self-hosters can `docker compose pull` instead of always building from source. `docker-compose.yml` now references that image, falling back to building from `docker/Dockerfile` when no matching image exists locally.
