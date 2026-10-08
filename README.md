# Parkia

Sistema de estacionamiento medido para municipios y comunas de Argentina: app para conductores, app para agentes de control, gestión municipal y tablero público de transparencia.

> Estado: **MVP en demostración** en <https://app.parkia.net.ar/firmat> (conductor) y <https://app.parkia.net.ar/agente> (control). Primer objetivo: piloto en el microcentro de Firmat, Santa Fe. Qué está hecho y qué falta: [docs/estado.md](docs/estado.md).

## Documentación

| Documento                                        | Contenido                                                 |
| ------------------------------------------------ | --------------------------------------------------------- |
| [docs/estado.md](docs/estado.md)                 | Qué está hecho, qué falta y en qué orden                  |
| [docs/mercado.md](docs/mercado.md)               | Mercado, competencia, modelo de negocio y precios         |
| [docs/stack.md](docs/stack.md)                   | Arquitectura, stack, infraestructura y alcance del MVP    |
| [docs/tarifas.md](docs/tarifas.md)               | Reglas de cálculo de tarifas (referencia para municipios) |
| [docs/funcionamiento.md](docs/funcionamiento.md) | Cuentas, saldo, cuadras, estacionamiento y control        |
| [docs/despliegue.md](docs/despliegue.md)         | Servidor, deploy, túnel, respaldos y operación            |

## Estructura

```
apps/
  api/           API REST (NestJS 12 + Fastify + PostgreSQL/PostGIS)
  web/           Next.js 16: app del conductor (PWA) y app de control para agentes (/agente)
packages/
  domain/        Reglas de negocio puras: tarifas, horarios, cuadras, control, dinero
  contracts/     Esquemas Zod compartidos entre la API y los clientes
infra/           Preparación de la VPS, despliegue y compose de producción
docs/            Documentación del producto y la arquitectura
compose.yaml     Servicios para desarrollo local (PostGIS)
```

## Requisitos

- Node.js 24 (ver `.nvmrc`)
- pnpm 12 (`npm i -g pnpm@12`)
- Docker Desktop

## Puesta en marcha

```bash
pnpm install
pnpm db:up                              # PostGIS local en el puerto 5433
cp apps/api/.env.example apps/api/.env  # configuración de desarrollo
pnpm build
pnpm --filter @parkia/api db:migrate    # aplica migraciones
pnpm --filter @parkia/api db:seed       # datos de demo: Firmat, 2 zonas y 30 cuadras reales
PARKIA_CONTRASENA=agente-de-desarrollo pnpm --filter @parkia/api db:crear-personal -- --email agente@firmat.test --municipio firmat --rol agente
pnpm --filter @parkia/api dev           # API en http://localhost:3000
cp apps/web/.env.example apps/web/.env.local
pnpm --filter @parkia/web dev           # conductor: http://localhost:3001/firmat · control: http://localhost:3001/agente
```

- Documentación interactiva de la API: <http://localhost:3000/docs>
- Especificación OpenAPI: <http://localhost:3000/docs/openapi.json>
- Salud: <http://localhost:3000/salud>
- En desarrollo los códigos de acceso por email se muestran en el log de la API.
- El agente de desarrollo (`agente@firmat.test`) ingresa con la contraseña indicada en `apps/api/.env.example`.
- Para depurar un test de integración: `LOG_LEVEL_PRUEBAS=error pnpm test:integracion` muestra los errores de la API.

## Comandos

```bash
pnpm test              # tests unitarios de todos los paquetes
pnpm test:integracion  # tests de la API contra PostGIS efímero (requiere Docker)
pnpm test:coverage     # tests con cobertura (mínimo 95 % en domain)
pnpm lint              # ESLint con reglas estrictas de TypeScript
pnpm typecheck         # verificación de tipos
pnpm format            # formatea con Prettier
pnpm check             # formato + lint + tipos + tests, como en CI
pnpm build             # compila todo
pnpm db:down           # detiene la base local
```

## Convenciones

- **TypeScript estricto** en todo el monorepo, **solo ESM**.
- **Dinero siempre en centavos enteros** (`Centavos`), nunca en punto flotante.
- **Lenguaje del dominio en español** (zona, franja, jornada, liquidación) para hablar el mismo idioma que el municipio y las ordenanzas.
- **Errores de la API** con cuerpo uniforme `{ statusCode, codigo, mensaje, detalles? }` y códigos estables.
- **Commits** con [Conventional Commits](https://www.conventionalcommits.org/es/v1.0.0/): `feat:`, `fix:`, `docs:`, `chore:`, `test:`, `refactor:`.

## Licencia

Software propietario. Todos los derechos reservados. Ver [LICENSE](LICENSE).
