# Parkia

Sistema de estacionamiento medido para municipios y comunas de Argentina: app para conductores, app para agentes de control, gestión municipal y tablero público de transparencia.

> Estado: **en desarrollo (MVP)**. Primer objetivo: piloto en el microcentro de Firmat, Santa Fe.

## Documentación

| Documento                          | Contenido                                                 |
| ---------------------------------- | --------------------------------------------------------- |
| [docs/mercado.md](docs/mercado.md) | Mercado, competencia, modelo de negocio y precios         |
| [docs/stack.md](docs/stack.md)     | Arquitectura, stack, infraestructura y alcance del MVP    |
| [docs/tarifas.md](docs/tarifas.md) | Reglas de cálculo de tarifas (referencia para municipios) |

## Estructura

```
apps/            Aplicaciones (API, web, app de agentes) — próximamente
packages/
  domain/        Reglas de negocio puras: tarifas, horarios de cobro, dinero
docs/            Documentación del producto y la arquitectura
```

## Requisitos

- Node.js 24 (ver `.nvmrc`)
- pnpm 12 (`npm i -g pnpm@12`)
- Docker Desktop (para la base de datos local, cuando se incorpore la API)

## Comandos

```bash
pnpm install          # instala dependencias
pnpm test             # tests de todos los paquetes
pnpm test:coverage    # tests con cobertura (mínimo 95 % en domain)
pnpm lint             # ESLint con reglas estrictas de TypeScript
pnpm typecheck        # verificación de tipos
pnpm format           # formatea con Prettier
pnpm check            # todo lo anterior, como en CI
pnpm build            # compila los paquetes
```

## Convenciones

- **TypeScript estricto** en todo el monorepo.
- **Dinero siempre en centavos enteros** (`Centavos`), nunca en punto flotante.
- **Lenguaje del dominio en español** (zona, franja, jornada, liquidación) para hablar el mismo idioma que el municipio y las ordenanzas.
- **Commits** con [Conventional Commits](https://www.conventionalcommits.org/es/v1.0.0/): `feat:`, `fix:`, `docs:`, `chore:`, `test:`, `refactor:`.

## Licencia

Software propietario. Todos los derechos reservados. Ver [LICENSE](LICENSE).
