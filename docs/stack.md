# Parkia — Stack y arquitectura (propuesta)

> Estado: **propuesta para MVP**. Criterios: que lo mantenga una sola persona, que sea profesional y auditable ante un municipio, multi-municipio desde el día uno y con costo de infraestructura casi nulo hasta tener clientes.

---

## 1. Principios

1. **Un solo lenguaje: TypeScript de punta a punta.** Backend, web y mobile comparten tipos y validaciones.
2. **Multi-tenant desde el inicio.** Cada municipio es un _tenant_: una sola instalación sirve a todas las ciudades, configurada por datos, sin forks.
3. **El dinero nunca pasa por Parkia.** Los cobros se acreditan en la cuenta del municipio (ver `mercado.md` §6).
4. **Auditable.** Todo movimiento de saldo, sesión y acta queda en un registro inmutable. Es lo que pide un Tribunal de Cuentas o un Juzgado de Faltas.
5. **Portabilidad.** Todo corre en Docker, sin atarse a un proveedor cloud.
6. **Aburrido y probado > moderno y frágil.**

---

## 2. Componentes del producto

| App                     | Usuario                        | Tecnología                           | Por qué                                                                                   |
| ----------------------- | ------------------------------ | ------------------------------------ | ----------------------------------------------------------------------------------------- |
| **Parkia Conductor**    | Vecino que estaciona           | **PWA** (Next.js)                    | Sin pasar por las tiendas: escanea el QR del cartel y estaciona. Instalable en el celular |
| **Parkia Agente**       | Inspector / agente de control  | **App nativa** (Expo / React Native) | Cámara para leer patentes en el dispositivo, GPS, funciona sin señal                      |
| **Parkia Gestión**      | Municipio (Tránsito, Hacienda) | Next.js (backoffice)                 | Zonas en mapa, tarifas, exenciones, reportes, auditoría                                   |
| **Parkia Transparente** | Público / prensa / concejales  | Next.js (páginas públicas)           | Tablero de recaudación y ocupación en tiempo real: el diferencial                         |
| **Punto de venta**      | Kiosco o comercio              | Dentro de la PWA, con rol "comercio" | Cargar saldo o activar estacionamiento por patente para quien no tiene celular            |
| **API**                 | Todas las anteriores           | NestJS                               | Núcleo de negocio                                                                         |

---

## 3. Stack

### Monorepo

- **pnpm workspaces + Turborepo**: un repo, builds incrementales.
- Estructura:
  ```
  apps/
    api/        NestJS (incluye src/db: esquema Drizzle, migraciones y semillas)
    web/        Next.js: conductor (PWA), gestión, transparente, comercio
    agente/     Expo (React Native)
  packages/
    domain/     reglas de negocio puras (cálculo de tarifas, feriados, horarios)
    contracts/  esquemas Zod compartidos (DTOs, validaciones)
    ui/         componentes compartidos (shadcn/ui)
  docs/
  ```

### Backend

- **NestJS** (adaptador Fastify). Da estructura modular, inyección de dependencias, guards por rol y por municipio, y OpenAPI automático. Vos solo, en dos años, vas a agradecer el orden.
- **PostgreSQL 17 + PostGIS 3.5**:
  - PostGIS para las zonas como polígonos ("¿esta coordenada está en zona 1?") y los reportes geográficos.
  - **Row Level Security** por `municipio_id`: el aislamiento entre ciudades lo garantiza la base, no solo el código.
- **Drizzle ORM**: SQL explícito, buen soporte de PostGIS y RLS, y migraciones versionadas.
- **pg-boss** para colas y tareas programadas (vencimientos, avisos "te quedan 10 minutos", conciliación). Usa Postgres: no hace falta Redis en el MVP.
- **Zod** para validar todo lo que entra y sale (en `packages/contracts`).

#### Decisiones de implementación (oct 2026)

| Tema                 | Decisión                                                                                        | Motivo                                                                               |
| -------------------- | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Framework            | **NestJS 12 + Fastify**, proyecto **ESM**                                                       | Versión actual; el ecosistema (swagger, terminus, config, nestjs-pino) ya la soporta |
| Validación y OpenAPI | `StandardSchemaValidationPipe` + `@Body({ schema })` con Zod                                    | Un mismo esquema valida y documenta: sin DTOs duplicados                             |
| Errores              | Cuerpo uniforme `{ statusCode, codigo, mensaje, detalles? }`; errores de dominio → 422          | Códigos estables para los clientes; nunca se filtran detalles internos               |
| TypeScript           | **6.0** (el que fija NestJS 12)                                                                 | TS 7 se evaluará cuando lo soporten NestJS y typescript-eslint                       |
| Build de librerías   | **tsdown**, solo ESM                                                                            | Sucesor de tsup (que no es compatible con TS 6)                                      |
| Tests                | **Vitest** con transformador **oxc** (metadata de decoradores)                                  | Sin binarios nativos de SWC, que fallaban en Windows                                 |
| Integración          | **Testcontainers** con `postgis/postgis:17-3.5`                                                 | Tests contra la misma base que producción, efímera por corrida                       |
| Configuración        | Variables solo desde el entorno del proceso, validadas con Zod al arrancar                      | Nada de `.env` implícitos: lo que corre es lo que se configuró                       |
| Esquema de datos     | Dentro de `apps/api/src/db` (como en Sperway)                                                   | Menos paquetes que mantener; se extrae si otra app lo necesita                       |
| Multi-tenant         | Hoy: filtro por `municipio_id` en cada consulta. **Pendiente: RLS** al incorporar autenticación | RLS necesita el contexto del usuario autenticado                                     |

### Web

- **Next.js (App Router) + Tailwind + shadcn/ui.**
- **MapLibre GL + OpenStreetMap** para los mapas. Sin costo por uso, a diferencia de Google Maps.
- **Serwist** para PWA (offline básico e instalación).
- Gráficos del tablero: **Recharts**.

### App Agente

- **Expo (React Native)**, distribuida por APK o Play Store interno.
- **Lectura de patentes en el dispositivo** con ML Kit Text Recognition, más validación de formato de patente argentina (`AAA000` / `AA000AA`). Gratis y funciona sin internet.
- **Cola offline**: los controles y actas se guardan localmente (SQLite) y se sincronizan al volver la señal.
- Cada acta lleva foto, GPS, hora, ID del agente y un **hash SHA-256**, para que sea válida ante el Juzgado de Faltas.

### Autenticación

- **Better Auth** (librería TS, se aloja en nuestra base, sin costo por usuario).
- Conductores: código por **WhatsApp o SMS** (OTP) o email. Sin contraseñas.
- Municipio y agentes: usuario + contraseña + 2FA, con roles (`admin_municipio`, `hacienda`, `agente`, `comercio`, `superadmin_parkia`).

### Pagos

- **Mercado Pago** como medio principal: tarjetas, dinero en cuenta, QR y efectivo vía Rapipago/Pago Fácil.
  - Cada municipio conecta **su propia cuenta** por OAuth: la plata va directo al municipio.
  - Opción a evaluar: el modelo marketplace de MP, que descuenta automáticamente la comisión de Parkia (`marketplace_fee`) en cada cobro.
- **Saldo prepago (billetera)** con **libro contable de doble entrada** (`ledger`): cada peso tiene origen y destino trazable. Reduce comisiones (una carga cubre muchos estacionamientos) y facilita la conciliación.
- Abstracción `PaymentProvider` para sumar más adelante MODO o transferencias.

### Notificaciones

- Email: **Resend**. Push: Web Push (PWA) y Expo Notifications.
- WhatsApp: **WhatsApp Cloud API (Meta)** para OTP y avisos de vencimiento, en una fase posterior al MVP.

### Infraestructura: VPS propia + Cloudflare

- **Servidor:** VPS de 8 vCPU / 24 GB RAM, **Ubuntu 22.04**. Alcanza para varios municipios del tamaño de Firmat.
- **Dominio:** `parkia.net.ar` (nic.ar), DNS en Cloudflare.
- **Convivencia:** en la misma VPS corren **Sperway** (ridesharing, con Caddy en 80/443, observabilidad Prometheus/Grafana/Loki y backups offsite), **Nubera** (con su propio Cloudflare Tunnel), **Skinbot** y **Prisma**. **Regla: Parkia no toca nada de otros proyectos.** Ni su proxy, ni sus puertos, ni sus bases, ni sus redes Docker. Se sigue el mismo patrón que Nubera: túnel propio en el compose.
- **Recursos (oct 2026):** ~6 GB de RAM en uso de 22 GB, CPU ociosa, 104 GB libres en disco. **Sin swap**: conviene agregar un swapfile de 4–8 GB como red de seguridad (cambio de sistema, coordinar antes).

```
Internet ─► Cloudflare (DNS, proxy, WAF, SSL) ── *.parkia.net.ar
              │  Cloudflare Tunnel propio de Parkia (conexión saliente, sin puertos abiertos)
              ▼
            VPS ── /opt/parkia  (docker compose project "parkia", red Docker propia)
                    ├─ cloudflared   (túnel de Parkia)
                    ├─ api           (NestJS)
                    ├─ worker        (pg-boss: vencimientos, avisos, conciliación)
                    ├─ web           (Next.js: conductor, gestión, transparente)
                    └─ postgres      (postgis/postgis:17-3.5, solo red interna)
                ── Sperway (sin cambios)
            Backups ─► Cloudflare R2 (fuera de la VPS)
```

| Pieza                     | Elección                                                                                                                                        | Notas                                                                                                               |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Orquestación              | **Docker Compose** (proyecto `parkia` en `/opt/parkia`)                                                                                         | Se descarta Coolify: instala su propio proxy en 80/443 y podría chocar con Sperway. Compose es aislado y predecible |
| Aislamiento               | Red Docker propia y **límites de CPU/RAM** por servicio (ej. 4 vCPU / 8 GB en total para Parkia)                                                | Parkia nunca puede dejar sin recursos a Sperway                                                                     |
| Exposición                | **Cloudflare Tunnel** dedicado (`cloudflared` como contenedor)                                                                                  | Ningún puerto nuevo en la VPS. No interfiere con Nginx ni con lo que use Sperway                                    |
| Deploy                    | **GitHub Actions** → build de imágenes → **GHCR** → SSH a la VPS → `docker compose pull && up -d`                                               | Migraciones de base antes de levantar la API. Rollback = volver al tag anterior                                     |
| Subdominios               | `api.parkia.net.ar`, `app.parkia.net.ar` (conductor), `gestion.parkia.net.ar`, `transparencia.parkia.net.ar`, `parkia.net.ar` (sitio comercial) | A futuro: `firmat.parkia.net.ar` como alias por municipio                                                           |
| Base de datos             | Postgres 17 + PostGIS 3.5 **propio de Parkia** (misma imagen que Sperway), volumen persistente                                                  | Separado de cualquier base de Sperway. No se expone a internet                                                      |
| Backups                   | **pgBackRest** (o WAL-G) a **Cloudflare R2**: WAL continuo + full diario, retención 30 días                                                     | Restauración probada mensualmente. **Si no está probado, no es backup**                                             |
| Archivos (fotos de actas) | **Cloudflare R2**                                                                                                                               | Fuera de la VPS. Sin costo de egreso                                                                                |
| Errores                   | **Sentry** (cloud, free tier)                                                                                                                   |                                                                                                                     |
| Uptime                    | Monitor externo (Better Stack / UptimeRobot free) sobre `api.` y `app.`                                                                         | Avisa si se cae la VPS entera                                                                                       |
| Hardening                 | Usuario de deploy `parkia` sin sudo (solo grupo docker), SSH solo con clave                                                                     | UFW y fail2ban se revisan **sin modificar** lo que Sperway necesite                                                 |

**Riesgo asumido:** una única VPS es un punto único de falla. Para el piloto es aceptable si los backups están fuera, son continuos y la restauración está documentada (objetivo: menos de 1 h para volver a estar en línea en otra máquina). Con 3 o más municipios se suma una segunda VPS en standby o un Postgres replicado.

Todo en Docker: si un municipio exige servidores propios o hosting específico, se migra sin reescribir.

### Calidad

- **Vitest** (unitarios, sobre todo `packages/domain`: el cálculo de tarifas tiene que ser a prueba de balas).
- **Playwright** (end-to-end de los flujos críticos: estacionar, pagar, controlar).
- **GitHub Actions**: lint, typecheck, tests y preview por PR.
- **ESLint** (typescript-eslint en modo `strictTypeChecked`) + **Prettier**. Conventional Commits.
- **TypeScript 5.9** estricto (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`). TS 7 (compilador nativo) se evaluará cuando el ecosistema (NestJS, typescript-eslint) lo soporte.

---

## 4. Modelo de dominio (núcleo)

```
Municipio (tenant)
 ├─ Zona (polígono PostGIS, nombre, color)
 │   └─ ReglaTarifaria (franjas horarias, días, precio por fracción, progresividad, tope)
 ├─ Feriado / Evento especial
 ├─ Exencion (discapacidad, frentista, oficial) → vinculada a Patente
 ├─ Agente
 ├─ Comercio (punto de venta, comisión)
 └─ CuentaCobro (credenciales MP del municipio)

Conductor ─< Vehiculo (patente)
Conductor ── Billetera ─< MovimientoLedger
SesionEstacionamiento (patente, zona, inicio, fin, monto, origen: app/comercio/agente)
Control (agente, patente, ubicación, resultado) ─? Acta (foto, hash, estado → Juzgado de Faltas)
Pago (proveedor, id externo, estado, webhook) → MovimientoLedger
AuditLog (append-only: quién, qué, cuándo, antes/después)
```

**Regla clave:** la consulta "¿esta patente está habilitada aquí y ahora?" (sesión activa, exención o abono) debe responder en menos de 200 ms. Es lo que usa el agente en la calle.

---

## 5. Alcance del MVP (demo + piloto Firmat)

**Incluido**

- [ ] Gestión: alta de municipio, zonas dibujadas en mapa, reglas tarifarias, horarios, feriados.
- [ ] Conductor (PWA): registro por email/OTP, patentes, carga de saldo con Mercado Pago, iniciar y finalizar estacionamiento (cobro por tiempo real), historial.
- [ ] Agente (Expo): login, lectura de patente por cámara o manual, resultado habilitado/no habilitado, labrado de acta con foto + GPS, modo offline.
- [ ] Comercio: activar estacionamiento o cargar saldo por patente.
- [ ] Reportes: recaudación por día, zona y medio de pago; exportación CSV de actas.
- [ ] Tablero público de transparencia.
- [ ] Auditoría completa.

**Fuera del MVP (siguientes fases)**

- Bot de WhatsApp para estacionar sin app.
- Abonos mensuales y residentes.
- Integración formal con Juzgado de Faltas y pago voluntario de multas.
- Lectura automática de patentes con cámaras fijas (LPR) y sensores.
- Facturación electrónica ARCA de la comisión.
- App conductor nativa (si la PWA no alcanza).

---

## 6. Decisiones descartadas (y por qué)

| Alternativa                               | Motivo                                                                                                  |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Laravel / Django                          | Excelentes, pero suman un segundo lenguaje frente a mobile y web en TS                                  |
| Next.js solo, como backend                | Mezcla UI y negocio; webhooks, colas y la app nativa piden una API independiente                        |
| Firebase / Supabase como backend completo | Lock-in; consultas geográficas, ledger y auditoría quedan mejor en Postgres propio con lógica en la API |
| Google Maps                               | Costo por uso que crece con cada municipio                                                              |
| Microservicios                            | Sobreingeniería para un equipo de una persona. Monolito modular primero                                 |
