# syntax=docker/dockerfile:1

FROM node:22-alpine AS base
RUN corepack enable

# ---- install workspace dependencies -----------------------------------
FROM base AS deps
WORKDIR /app
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY apps/server/package.json apps/server/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/config/package.json packages/config/package.json
COPY packages/db/package.json packages/db/package.json
COPY packages/crypto/package.json packages/crypto/package.json
COPY packages/adapters/core/package.json packages/adapters/core/package.json
COPY packages/adapters/tautulli/package.json packages/adapters/tautulli/package.json
COPY packages/adapters/plex/package.json packages/adapters/plex/package.json
COPY packages/adapters/booklore-family/package.json packages/adapters/booklore-family/package.json
RUN pnpm install --frozen-lockfile

# ---- build everything ---------------------------------------------------
FROM deps AS build
COPY . .
RUN pnpm turbo run build

# ---- prune to production-only installs per app --------------------------
# --legacy: pnpm v10 defaults to requiring inject-workspace-packages=true for
# `deploy`; --legacy falls back to the pre-v10 copy-based behavior instead,
# which needs no workspace-wide install-time config change.
FROM build AS deploy
RUN pnpm --filter @latestarr/server deploy --prod --legacy /prod/server

# ---- final runtime image --------------------------------------------------
FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=deploy /prod/server ./
# Served as static files with an SPA fallback (see apps/server/src/app.ts);
# every backend API route lives under /api specifically so it can't collide
# with a client-side route of the same name (e.g. "/sources" the page vs.
# "/sources" the endpoint) now that both are served from this one origin.
COPY --from=build /app/apps/web/dist ./public

EXPOSE 3000
VOLUME ["/app/data"]

CMD ["node", "dist/index.js"]
