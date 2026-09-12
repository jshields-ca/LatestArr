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
RUN pnpm install --frozen-lockfile

# ---- build everything ---------------------------------------------------
FROM deps AS build
COPY . .
RUN pnpm turbo run build

# ---- prune to production-only installs per app --------------------------
FROM build AS deploy
RUN pnpm --filter @latestarr/server deploy --prod /prod/server

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
