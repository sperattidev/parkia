#!/usr/bin/env bash
# Prepara /opt/parkia en la VPS. Se ejecuta una sola vez y es idempotente:
#   ssh sperway-vps 'bash -s' < infra/preparar-vps.sh
# Los secretos se generan en la propia VPS y nunca salen de ella.
set -euo pipefail

BASE=/opt/parkia

sudo mkdir -p "$BASE/respaldos"
sudo chown "$(id -u):$(id -g)" "$BASE"
sudo chmod 750 "$BASE"
# El contenedor de respaldos escribe como el usuario postgres (uid 999).
sudo chown 999:999 "$BASE/respaldos"
sudo chmod 700 "$BASE/respaldos"

ENV_FILE="$BASE/.env"
if [[ ! -f "$ENV_FILE" ]]; then
  umask 077
  cat > "$ENV_FILE" <<CONFIG
PARKIA_ENTORNO=demo
PARKIA_VERSION=
POSTGRES_PASSWORD=$(openssl rand -base64 36 | tr -d '/+=\n' | cut -c1-40)
AUTH_SECRET=$(openssl rand -base64 48 | tr -d '\n')
CLOUDFLARE_TUNNEL_TOKEN=
CORREO_PROVEEDOR=consola
RESEND_API_KEY=
CORREO_REMITENTE=Parkia <no-responder@parkia.net.ar>
CONFIG
  echo "Creado $ENV_FILE con secretos nuevos."
else
  echo "$ENV_FILE ya existe: no se modifica."
fi
chmod 600 "$ENV_FILE"
ls -la "$BASE"
