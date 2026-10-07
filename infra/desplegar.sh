#!/usr/bin/env bash
# Despliega Parkia en la VPS desde una PC con Docker:
#   infra/desplegar.sh            # despliega el commit actual
#   infra/desplegar.sh --sembrar  # además carga los datos de demostración
#
# Las imágenes se construyen localmente y se envían por SSH: la VPS no compila
# nada ni acumula caché de builds compartida con otros proyectos.
set -euo pipefail

VPS="${PARKIA_VPS:-sperway-vps}"
SSH="${PARKIA_SSH:-ssh}"
BASE=/opt/parkia
COMPOSE="docker compose --env-file $BASE/.env -f $BASE/compose.yaml"
SEMBRAR=false
[[ "${1:-}" == "--sembrar" ]] && SEMBRAR=true

cd "$(git rev-parse --show-toplevel)"
if [[ -n "$(git status --porcelain)" ]]; then
  echo "Hay cambios sin commitear: se despliega solo código versionado." >&2
  exit 1
fi
VERSION="$(git rev-parse --short=10 HEAD)"
echo "▶ Versión $VERSION"

echo "▶ Construyendo imágenes"
docker build -f apps/api/Dockerfile -t "parkia-api:$VERSION" .
docker build -f apps/web/Dockerfile -t "parkia-web:$VERSION" .

echo "▶ Enviando imágenes a $VPS"
docker save "parkia-api:$VERSION" "parkia-web:$VERSION" | gzip -1 | "$SSH" "$VPS" 'gunzip | docker load'
"$SSH" "$VPS" "cat > $BASE/compose.yaml" < infra/produccion/compose.yaml

echo "▶ Actualizando servicios"
"$SSH" "$VPS" "bash -s" <<REMOTO
set -euo pipefail
sed -i "s/^PARKIA_VERSION=.*/PARKIA_VERSION=$VERSION/" $BASE/.env
servicios="postgres respaldos migraciones api web"
# El túnel se levanta solo cuando su token está cargado.
grep -q '^CLOUDFLARE_TUNNEL_TOKEN=.\+' $BASE/.env && servicios="\$servicios cloudflared"
if ! grep -q '^CLOUDFLARE_TUNNEL_TOKEN=.\+' $BASE/.env; then
  export CLOUDFLARE_TUNNEL_TOKEN=pendiente
fi
$COMPOSE up -d --wait --remove-orphans \$servicios
if $SEMBRAR; then $COMPOSE run --rm --no-deps api node dist/db/sembrar.js; fi

# Limpieza: solo imágenes de Parkia, conservando la versión actual y la anterior.
for imagen in parkia-api parkia-web; do
  docker image ls "\$imagen" --format '{{.CreatedAt}}\t{{.Repository}}:{{.Tag}}' \
    | sort -r | tail -n +3 | cut -f2 | xargs -r docker image rm
done
docker image prune -f --filter label=com.parkia.project=parkia >/dev/null
$COMPOSE ps --format 'table {{.Service}}\t{{.Status}}'
REMOTO

echo "▶ Limpiando imágenes y caché locales"
docker image rm "parkia-api:$VERSION" "parkia-web:$VERSION" >/dev/null
docker builder prune -f >/dev/null
echo "✔ Desplegado $VERSION"
