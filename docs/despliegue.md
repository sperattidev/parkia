# Parkia — Despliegue y operación

Parkia corre en la VPS compartida (Ubuntu 22.04) junto a otros proyectos, **sin interferir con ellos**: compose propio en `/opt/parkia`, red Docker propia, límites de CPU y memoria, y **ningún puerto publicado**. Todo el tráfico entra por un Cloudflare Tunnel propio.

```
Internet ─► Cloudflare ─► túnel (cloudflared) ─┬─► web  :3001   app.parkia.net.ar
                                               └─► api  :3000   api.parkia.net.ar
                                                    │
                                    postgres (PostGIS) ◄─ respaldos (diarios)
```

## Entornos

`PARKIA_ENTORNO` en `/opt/parkia/.env`:

| Valor        | Emails                               | Cargas de prueba               | Para qué                        |
| ------------ | ------------------------------------ | ------------------------------ | ------------------------------- |
| `demo`       | consola (códigos en el log) o Resend | habilitadas, con aviso visible | Mostrar el sistema al municipio |
| `produccion` | **solo Resend**                      | **prohibidas**                 | Operación real con cobro        |

## Preparación (una sola vez)

```bash
ssh sperway-vps 'bash -s' < infra/preparar-vps.sh
```

Crea `/opt/parkia` y `/opt/parkia/.env` (permisos 600) con la contraseña de la base y `AUTH_SECRET` **generados en la propia VPS**: nunca pasan por otra máquina.

### Cloudflare Tunnel

1. Cloudflare → **Zero Trust → Networks → Tunnels → Create a tunnel** → tipo _Cloudflared_, nombre `parkia`.
2. En **Public Hostnames** agregar:
   - `app.parkia.net.ar` → `HTTP` → `web:3001`
   - `api.parkia.net.ar` → `HTTP` → `api:3000`
3. Copiar el token del túnel y cargarlo **directamente en la VPS** (no se pega en ningún otro lado):

   ```bash
   ssh sperway-vps
   nano /opt/parkia/.env        # completar CLOUDFLARE_TUNNEL_TOKEN=...
   ```

4. Volver a desplegar: el script levanta `cloudflared` en cuanto encuentra el token.

## Desplegar

Desde una PC con Docker y acceso SSH, con el árbol de git limpio:

```bash
infra/desplegar.sh              # despliega el commit actual
infra/desplegar.sh --sembrar    # además carga los datos de demostración (idempotente)
```

En Windows, si el `ssh` de Git Bash no encuentra la clave, se puede usar el cliente de Windows:

```bash
PARKIA_SSH=/c/Windows/System32/OpenSSH/ssh.exe infra/desplegar.sh
```

El script:

1. Construye las imágenes `parkia-api` y `parkia-web` con la versión del commit.
2. Las envía comprimidas por SSH (la VPS no compila nada).
3. Ejecuta las migraciones de base y luego levanta API, web y túnel, esperando a que cada uno quede sano.
4. Conserva **la versión actual y la anterior** de cada imagen, y borra solo imágenes de Parkia.
5. Limpia imágenes y caché de build en la PC.

### Volver a la versión anterior

```bash
ssh sperway-vps
docker image ls parkia-api                       # ver la versión anterior
sed -i 's/^PARKIA_VERSION=.*/PARKIA_VERSION=<version>/' /opt/parkia/.env
docker compose --env-file /opt/parkia/.env -f /opt/parkia/compose.yaml up -d --wait
```

Las migraciones solo agregan estructura. Volver atrás el código no revierte la base.

## Operación

```bash
cd /opt/parkia && alias pk='docker compose --env-file .env -f compose.yaml'
pk ps                         # estado de los servicios
pk logs -f api                # logs de la API (JSON)
pk logs api | grep 'código'   # en demo: códigos de acceso enviados por consola
pk restart web
```

### Personal

Todo el personal ingresa en `app.parkia.net.ar/personal/ingresar` y Parkia lo lleva a su panel según el rol. **Las altas del día a día se hacen desde los paneles**: el equipo de Parkia da de alta cada municipio con su primer administrador (`/plataforma`), y ese administrador suma a su personal desde el panel municipal. Los dos generan una contraseña temporal que la persona cambia al ingresar.

Por terminal queda la cuenta inicial del **equipo de Parkia** (una sola vez) y el soporte. Desde la PC, con `--parkia`:

```bash
ssh -t sperway-vps 'cd /opt/parkia && read -rsp "Contraseña: " PARKIA_CONTRASENA && echo && export PARKIA_CONTRASENA && docker compose --env-file .env -f compose.yaml run --rm --no-deps -e PARKIA_CONTRASENA api node dist/db/crear-personal.js --email equipo@parkia.net.ar --parkia'
```

Para una cuenta de un municipio (o para cambiarle la contraseña a una existente):

```bash
ssh -t sperway-vps 'cd /opt/parkia && read -rsp "Contraseña: " PARKIA_CONTRASENA && echo && export PARKIA_CONTRASENA && docker compose --env-file .env -f compose.yaml run --rm --no-deps -e PARKIA_CONTRASENA api node dist/db/crear-personal.js --email agente@firmat.gob.ar --municipio firmat --rol agente'
```

La contraseña se escribe sin mostrarse y no queda en el historial de la terminal. Roles: `agente` (control en la calle) o `admin` (todo lo del agente y el panel municipal).

### Actividad simulada (solo demo)

En la demo no hay conductores reales, así que el padrón, el radar y el mapa de ocupación se verían vacíos. El simulador crea **conductores ficticios** (`conductor-001@demo.parkia.net.ar`, …) con su vehículo y saldo de prueba, y estaciona con los mismos servicios que la API: vencimientos e importes salen de la regla tarifaria real de cada zona. Respeta la capacidad de cada mano y los lugares numerados ocupados, incluida la actividad real. **Con `PARKIA_ENTORNO=produccion` se niega a correr.**

```bash
# Foto creíble ahora: ~35 % de ocupación, vencidos recientes por saldo agotado y estacionamientos por vencer
ssh sperway-vps 'cd /opt/parkia && docker compose --env-file .env -f compose.yaml run --rm --no-deps api node dist/db/simular.js'

# Otra ocupación (0 a 0,9) o municipio
ssh sperway-vps 'cd /opt/parkia && docker compose --env-file .env -f compose.yaml run --rm --no-deps api node dist/db/simular.js --ocupacion 0.5 --municipio firmat'

# Borrar lo simulado
ssh sperway-vps 'cd /opt/parkia && docker compose --env-file .env -f compose.yaml run --rm --no-deps api node dist/db/simular.js --limpiar'
```

- Repetirlo no duplica nada: converge a la ocupación pedida, cierra los vencidos, retira a quien cumplió su estadía y repone llegadas.
- Los vencidos solo existen **dentro del horario de cobro** (de 8 a 20 en días hábiles): fuera de ese horario el saldo no se consume y la foto solo tiene vehículos vigentes.
- Para que la calle tenga movimiento durante toda la demostración, agregar `PARKIA_SIMULACION=true` en `/opt/parkia/.env` y volver a desplegar: cada 5 minutos, mientras alguna zona cobra, llegan conductores nuevos, se van los que cumplieron su estadía y uno de cada cinco se queda sin saldo (aparece en el radar). La validación del entorno impide habilitarlo en producción.
- `--limpiar` borra los estacionamientos simulados, los controles hechos sobre ellos, los vehículos y las sesiones, y desactiva las cuentas ficticias. Sus billeteras y movimientos quedan: el libro de movimientos es inmutable por diseño. Nada que no pertenezca a una cuenta `@demo.parkia.net.ar` se modifica.

En local: `pnpm --filter @parkia/api build && pnpm --filter @parkia/api db:simular` (acepta las mismas opciones después de `--`).

### Respaldos

- `respaldos` hace un `pg_dump` diario en `/opt/parkia/respaldos` y conserva 7 diarios, 4 semanales y 6 mensuales.
- **Pendiente:** copia fuera de la VPS (Cloudflare R2). Mientras tanto, una falla del disco de la VPS perdería los datos.
- Los archivos se llaman `.sql.gz`, pero están en **formato propio de PostgreSQL** (`pg_dump --format=custom`, ya comprimido): se restauran con `pg_restore`, **sin** `gunzip`.
- Restaurar un respaldo (probado el 7/10/2026 en una base descartable):

  ```bash
  # 1) Probar primero en una base aparte
  docker exec parkia-postgres-1 psql -U parkia -d postgres -c 'CREATE DATABASE prueba_restauracion'
  sudo cat respaldos/last/<archivo>.sql.gz | docker exec -i parkia-postgres-1 pg_restore -U parkia -d prueba_restauracion --no-owner
  # 2) Restaurar sobre la base real (detener api y web antes)
  pk stop api web
  sudo cat respaldos/last/<archivo>.sql.gz | docker exec -i parkia-postgres-1 pg_restore -U parkia -d parkia --clean --if-exists --no-owner
  pk start api web
  ```

- Forzar un respaldo en el momento: `docker exec parkia-respaldos-1 /backup.sh`.

## Próximos pasos de infraestructura

- Copia de respaldos a R2 y prueba de restauración mensual.
- Build y publicación de imágenes desde GitHub Actions (GHCR) para desplegar sin una PC.
- Monitoreo externo de `api.parkia.net.ar/salud` y alertas.
- Seguimiento de errores (Sentry) en API y web.

El estado general del producto y lo que falta está en [estado.md](estado.md).
