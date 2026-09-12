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
# apps/server doesn't serve these yet; wiring lands with the static-file-serving work.
COPY --from=build /app/apps/web/dist ./public

EXPOSE 3000
VOLUME ["/app/data"]

CMD ["node", "dist/index.js"]
