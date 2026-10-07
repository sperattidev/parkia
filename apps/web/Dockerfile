# syntax=docker/dockerfile:1.7
# Imagen de la web de Parkia (Next.js standalone). Construir desde la raíz:
#   docker build -f apps/web/Dockerfile -t parkia-web .

FROM node:24.21.0-alpine AS base
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH COREPACK_ENABLE_DOWNLOAD_PROMPT=0 NEXT_TELEMETRY_DISABLED=1
RUN corepack enable
WORKDIR /repo

FROM base AS dependencias
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/web/package.json apps/web/
COPY packages/domain/package.json packages/domain/
COPY packages/contracts/package.json packages/contracts/
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile --filter "@parkia/web..."

FROM dependencias AS compilacion
COPY tsconfig.base.json turbo.json ./
COPY packages packages
COPY apps/web apps/web
RUN pnpm --filter "@parkia/web^..." build && pnpm --filter @parkia/web build

FROM node:24.21.0-alpine AS ejecucion
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3001 HOSTNAME=0.0.0.0
WORKDIR /app
RUN apk add --no-cache tini
# Salida standalone: servidor mínimo con solo las dependencias que usa.
COPY --from=compilacion --chown=node:node /repo/apps/web/.next/standalone ./
COPY --from=compilacion --chown=node:node /repo/apps/web/.next/static ./apps/web/.next/static
COPY --from=compilacion --chown=node:node /repo/apps/web/public ./apps/web/public
USER node
EXPOSE 3001
LABEL com.parkia.project=parkia org.opencontainers.image.title="Parkia Web"
HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3001/manifest.webmanifest >/dev/null || exit 1
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "apps/web/server.js"]
