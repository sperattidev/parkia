# syntax=docker/dockerfile:1.7
# Imagen de la API de Parkia. Construir desde la raíz del monorepo:
#   docker build -f apps/api/Dockerfile -t parkia-api .

FROM node:24.21.0-alpine AS base
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable
WORKDIR /repo

# Dependencias: solo cambian si cambian los package.json o el lockfile.
FROM base AS dependencias
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/api/package.json apps/api/
COPY packages/domain/package.json packages/domain/
COPY packages/contracts/package.json packages/contracts/
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile --filter "@parkia/api..."

FROM dependencias AS compilacion
COPY tsconfig.base.json turbo.json ./
COPY packages packages
COPY apps/api apps/api
RUN pnpm --filter "@parkia/api..." build
# Solo dependencias de producción, con los paquetes del monorepo ya compilados.
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm --filter @parkia/api deploy --prod --legacy /salida \
 && cp -r apps/api/dist apps/api/drizzle /salida/

FROM node:24.21.0-alpine AS ejecucion
ENV NODE_ENV=production
WORKDIR /app
RUN apk add --no-cache tini
COPY --from=compilacion --chown=node:node /salida ./
USER node
EXPOSE 3000
LABEL com.parkia.project=parkia org.opencontainers.image.title="Parkia API"
HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/salud >/dev/null || exit 1
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "dist/main.js"]
