# Parkia — Stack y arquitectura

> Criterios: que lo mantenga una sola persona, que sea profesional y auditable ante un municipio, multi-municipio desde el día uno y con costo de infraestructura casi nulo hasta tener clientes. Lo que ya está construido y lo que falta se detalla en [estado.md](estado.md).

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
| **Parkia Control**      | Inspector / agente de control  | **Web** (`/agente`); luego Expo      | Hoy: padrón por cuadra, radar y control con GPS. Luego: cámara para patentes y sin señal  |
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
    web/        Next.js: conductor (PWA) y control (/agente); luego gestión y transparencia
  packages/
    domain/     reglas de negocio puras: tarifas, horarios, cuadras, evaluación del control
    contracts/  esquemas Zod compartidos (DTOs, validaciones)
  infra/        preparación de la VPS, despliegue y compose de producción
  docs/
  ```

  La app nativa del agente (`apps/agente`, Expo) se sumará cuando haga falta la cámara para leer patentes y el uso sin señal.

### Backend

- **NestJS** (adaptador Fastify). Da estructura modular, inyección de dependencias, guards por rol y por municipio, y OpenAPI automático. Vos solo, en dos años, vas a agradecer el orden.
- **PostgreSQL 17 + PostGIS 3.5**:
  - PostGIS para las cuadras como ejes de calle ("¿sobre qué cuadra y mano está esta coordenada?", altura interpolada) y los reportes geográficos.
  - **Row Level Security** por `municipio_id`: el aislamiento entre ciudades lo garantiza la base, no solo el código.
- **Drizzle ORM**: SQL explícito, buen soporte de PostGIS y RLS, y migraciones versionadas.
- **Tareas programadas** con `@nestjs/schedule` dentro de la API: hoy, el cierre automático de estacionamientos vencidos (cada minuto, con `FOR UPDATE SKIP LOCKED` para que nunca se cierre dos veces). Cuando haya avisos y conciliación de pagos con reintentos se evaluará **pg-boss** (colas sobre Postgres, sin Redis).
- **Zod** para validar todo lo que entra y sale (en `packages/contracts`).

#### Decisiones de implementación (oct 2026)

| Tema                 | Decisión                                                                                     | Motivo                                                                               |
| -------------------- | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Framework            | **NestJS 12 + Fastify**, proyecto **ESM**                                                    | Versión actual; el ecosistema (swagger, terminus, config, nestjs-pino) ya la soporta |
| Validación y OpenAPI | `StandardSchemaValidationPipe` + `@Body({ schema })` con Zod                                 | Un mismo esquema valida y documenta: sin DTOs duplicados                             |
| Errores              | Cuerpo uniforme `{ statusCode, codigo, mensaje, detalles? }`; errores de dominio → 422       | Códigos estables para los clientes; nunca se filtran detalles internos               |
| TypeScript           | **6.0** (el que fija NestJS 12)                                                              | TS 7 se evaluará cuando lo soporten NestJS y typescript-eslint                       |
| Build de librerías   | **tsdown**, solo ESM                                                                         | Sucesor de tsup (que no es compatible con TS 6)                                      |
| Tests                | **Vitest** con transformador **oxc** (metadata de decoradores)                               | Sin binarios nativos de SWC, que fallaban en Windows                                 |
| Integración          | **Testcontainers** con `postgis/postgis:17-3.5`                                              | Tests contra la misma base que producción, efímera por corrida                       |
| Configuración        | Variables solo desde el entorno del proceso, validadas con Zod al arrancar                   | Nada de `.env` implícitos: lo que corre es lo que se configuró                       |
| Esquema de datos     | Dentro de `apps/api/src/db` (como en Sperway)                                                | Menos paquetes que mantener; se extrae si otra app lo necesita                       |
| Multi-tenant         | Hoy: filtro por `municipio_id` en cada consulta. **Pendiente: RLS**                          | RLS necesita pasar el contexto del usuario a cada transacción                        |
| Zonas                | **Cuadras** (eje de calle `LineString`) agrupadas en zonas, no polígonos                     | Permite calle, altura, mano, capacidad y lugar; una manzana aporta 3 o 4 cuadras     |
| Ubicación            | Cuadra más cercana a 25 m (conductor) o 40 m (agente); la mano sale de qué lado del eje está | El GPS del celular tiene 5–15 m de error: alcanza para cuadra y mano, no para lugar  |
| Control              | Reglas puras en `packages/domain/src/control.ts`; motivo de cierre guardado en la base       | El vencido se sigue viendo después del cierre automático; testeable sin base         |
| Tests de integración | Cada archivo usa su propia base, clonada de una plantilla migrada                            | Aislados entre sí y rápidos (un solo contenedor por corrida)                         |

### Web

- **Next.js 16 (App Router, Turbopack) + React 19 + Tailwind 4**, componentes propios con tokens de diseño en CSS (modo claro y oscuro).
- **MapLibre GL 6 + OpenFreeMap** (teselas vectoriales de OpenStreetMap, sin clave ni costo por uso). El worker de MapLibre se copia a `public/vendor` antes de `dev` y `build`.
- **TanStack Query** para datos en el cliente: el estacionamiento en curso se refresca cada 30 s.
- **Sesión con cookie `httpOnly` (patrón BFF):** el navegador habla solo con la web (`/api/...`), que agrega el token al llamar a la API. El token nunca está al alcance de JavaScript. Las operaciones que modifican datos exigen el encabezado `x-parkia` (protección CSRF) y la cookie es `SameSite=Lax`.
- `proxy.ts` (antes _middleware_) redirige al ingreso las secciones personales sin sesión.
- PWA instalable (manifest e ícono). Pendiente: service worker para uso offline y notificaciones (**Serwist**).
- `agentRules: false` en `next.config.ts`: Next no genera archivos de instrucciones para asistentes.
- Gráficos del tablero municipal (próximo): **Recharts**.

### App Agente

**Hoy: web `/agente`** dentro de la misma app Next.js, con su propio ingreso (email y contraseña) y cuatro pestañas:

- **Ronda:** mapa con la cobertura del equipo en el día y el padrón de la cuadra donde está el agente (vehículos declarados por mano y lugar).
- **Controlar:** patente, veredicto con color y vibración, ubicación declarada y coincidencia con la cuadra del agente.
- **Radar:** vencidos de las últimas 2 horas y por vencer, los más cercanos primero.
- **Jornada:** controles, infracciones y porcentaje en regla.

**Después: app nativa (Expo / React Native)**, distribuida por APK o Play Store interno, para lo que la web no resuelve bien:

- **Lectura de patentes en el dispositivo** con ML Kit Text Recognition, más la validación de formato argentino que ya está en `packages/domain`. Gratis y sin internet.
- **Cola offline**: controles y actas guardados localmente (SQLite) y sincronizados al volver la señal.
- Cada acta lleva foto, GPS, hora, ID del agente y un **hash SHA-256**, para que sea válida ante el Juzgado de Faltas.

### Autenticación

- **Implementación propia** en `apps/api/src/autenticacion` (se descartó Better Auth: su integración con NestJS 12 ESM + Fastify no está madura, y el alcance necesario es chico y auditable).
- **Conductores:** código de 6 dígitos por **email** (luego WhatsApp), sin contraseñas. Vence en 10 min, máximo 5 intentos, un código nuevo invalida el anterior, máximo 5 códigos cada 15 min por email. Sesión de 30 días.
- **Personal municipal:** email + contraseña (**scrypt**, parámetros OWASP), sesión de 12 h. Roles por municipio: `admin`, `agente`, `comercio`. Pendiente: 2FA.
- **Sesiones con token opaco** (256 bits). En la base solo se guarda su **HMAC-SHA256** con `AUTH_SECRET`: una copia de la base no permite usar ni adivinar tokens o códigos.
- **Defensas:** respuestas idénticas exista o no la cuenta (incluido el tiempo de verificación de contraseña), límite de 5 intentos por minuto por IP en endpoints de credenciales y 120 por minuto en general.
- **Autorización:** guardia global (todo exige sesión salvo `@Publico()`) y `@RequiereRol(...)` que valida la membresía en el municipio de la ruta.

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
- **Recursos (oct 2026):** ~6 GB de RAM en uso de 22 GB, CPU ociosa, 104 GB libres en disco y **swap de 8 GB** como red de seguridad.

```
Internet ─► Cloudflare (DNS, proxy, WAF, SSL) ── *.parkia.net.ar
              │  Cloudflare Tunnel propio de Parkia (conexión saliente, sin puertos abiertos)
              ▼
            VPS ── /opt/parkia  (docker compose project "parkia", red Docker propia)
                    ├─ cloudflared   (túnel de Parkia)
                    ├─ migraciones   (corre y termina antes de levantar la API)
                    ├─ api           (NestJS, incluye el cierre automático)
                    ├─ web           (Next.js: conductor y control)
                    ├─ postgres      (postgis/postgis:17-3.5, solo red interna)
                    └─ respaldos     (pg_dump diario en la VPS)
                ── Sperway (sin cambios)
            Backups ─► Cloudflare R2 (fuera de la VPS) · pendiente
```

| Pieza                     | Elección                                                                                                                                        | Notas                                                                                                               |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Orquestación              | **Docker Compose** (proyecto `parkia` en `/opt/parkia`)                                                                                         | Se descarta Coolify: instala su propio proxy en 80/443 y podría chocar con Sperway. Compose es aislado y predecible |
| Aislamiento               | Red Docker propia y **límites de CPU/RAM** por servicio (ej. 4 vCPU / 8 GB en total para Parkia)                                                | Parkia nunca puede dejar sin recursos a Sperway                                                                     |
| Exposición                | **Cloudflare Tunnel** dedicado (`cloudflared` como contenedor)                                                                                  | Ningún puerto nuevo en la VPS. No interfiere con Nginx ni con lo que use Sperway                                    |
| Deploy                    | **`infra/desplegar.sh`**: build en la PC → imágenes por SSH → migraciones → `up -d --wait` (ver [despliegue.md](despliegue.md))                 | Rollback = volver a la versión anterior, que siempre se conserva. Luego: imágenes desde GitHub Actions (GHCR)       |
| Subdominios               | `api.parkia.net.ar`, `app.parkia.net.ar` (conductor), `gestion.parkia.net.ar`, `transparencia.parkia.net.ar`, `parkia.net.ar` (sitio comercial) | A futuro: `firmat.parkia.net.ar` como alias por municipio                                                           |
| Base de datos             | Postgres 17 + PostGIS 3.5 **propio de Parkia** (misma imagen que Sperway), volumen persistente                                                  | Separado de cualquier base de Sperway. No se expone a internet                                                      |
| Backups                   | Hoy: `pg_dump` diario en la VPS (7 diarios, 4 semanales, 6 mensuales). **Pendiente: copia a Cloudflare R2**; luego WAL continuo (pgBackRest)    | Restauración probada el 7/10/2026. **Si no está probado, no es backup**                                             |
| Archivos (fotos de actas) | **Cloudflare R2**                                                                                                                               | Fuera de la VPS. Sin costo de egreso                                                                                |
| Errores                   | **Sentry** (cloud, free tier)                                                                                                                   |                                                                                                                     |
| Uptime                    | Monitor externo (Better Stack / UptimeRobot free) sobre `api.` y `app.`                                                                         | Avisa si se cae la VPS entera                                                                                       |
| Hardening                 | Usuario de deploy `parkia` sin sudo (solo grupo docker), SSH solo con clave                                                                     | UFW y fail2ban se revisan **sin modificar** lo que Sperway necesite                                                 |

**Riesgo asumido:** una única VPS es un punto único de falla. Para el piloto es aceptable si los backups están fuera, son continuos y la restauración está documentada (objetivo: menos de 1 h para volver a estar en línea en otra máquina). Con 3 o más municipios se suma una segunda VPS en standby o un Postgres replicado.

Todo en Docker: si un municipio exige servidores propios o hosting específico, se migra sin reescribir.

### Calidad

- **Vitest**: unitarios en todos los paquetes (cobertura mínima del 95 % en `packages/domain`: tarifas y control tienen que ser a prueba de balas) e **integración** de la API contra PostGIS real con Testcontainers.
- **GitHub Actions** en cada push y PR: formato, lint, tipos, tests con cobertura, integración y build.
- **ESLint** (typescript-eslint en modo `strictTypeChecked`) + **Prettier**. Conventional Commits.
- **TypeScript 6** estricto (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`). TS 7 (compilador nativo) se evaluará cuando NestJS y typescript-eslint lo soporten.
- **Pendiente:** Playwright (end-to-end de estacionar, pagar y controlar).

---

## 4. Modelo de dominio (núcleo)

```
Municipio (tenant)
 ├─ Zona (nombre, color)
 │   ├─ ReglaTarifaria (franjas horarias, días, precio por fracción, progresividad, tope)
 │   └─ Cuadra (eje LineString PostGIS, calle, alturas, capacidad por mano, lugares numerados)
 ├─ Feriado / Evento especial
 ├─ Exencion (discapacidad, frentista, oficial) → vinculada a Patente
 ├─ Agente
 ├─ Comercio (punto de venta, comisión)
 └─ CuentaCobro (credenciales MP del municipio)

Conductor ─< Vehiculo (patente)
Conductor ── Billetera ─< MovimientoLedger
Estacionamiento (patente, zona, cuadra, mano, altura, lugar?, regla congelada, inicio, vence, fin, monto, motivo de cierre)
Control (agente, patente, cuadra, ubicación, precisión GPS, resultado) ─? Acta (foto, hash, estado → Juzgado de Faltas)
Pago (proveedor, id externo, estado, webhook) → MovimientoLedger
AuditLog (append-only: quién, qué, cuándo, antes/después)
```

Hoy existen municipio, zonas con regla tarifaria y feriados, cuadras, personal con roles, conductores, vehículos, billetera con movimientos inmutables, estacionamientos y controles. El resto (exenciones, comercios, cuentas de cobro, pagos, actas y auditoría general) es el plan.

**Regla clave:** la consulta "¿esta patente está habilitada aquí y ahora?" (sesión activa, exención o abono) debe responder en menos de 200 ms. Es lo que usa el agente en la calle.

---

## 5. Alcance del MVP (demo + piloto Firmat)

**Incluido** (✅ hecho · ◐ parcial · ⬜ falta; detalle en [estado.md](estado.md))

- ◐ **Gestión:** municipio, zonas, cuadras, tarifas, horarios y feriados existen en la base, pero se cargan por semilla. ⬜ Panel municipal.
- ◐ **Conductor (PWA):** ✅ ingreso por código, patentes, estacionar por cuadra, mano y lugar con cobro por tiempo real, historial. ⬜ Carga de saldo con Mercado Pago (hoy, cargas de prueba).
- ◐ **Agente:** ✅ ingreso, padrón, radar, control manual y jornada. ⬜ Actas con foto, lectura por cámara y modo offline.
- ⬜ **Comercio:** activar estacionamiento o cargar saldo por patente.
- ⬜ **Reportes:** recaudación por día, zona y medio de pago; exportación CSV de actas.
- ⬜ **Tablero público de transparencia.**
- ◐ **Auditoría:** ✅ movimientos de saldo inmutables y cada control registrado. ⬜ Registro general de cambios (quién, qué, cuándo, antes y después).

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
