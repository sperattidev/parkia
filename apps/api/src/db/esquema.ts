import type { ReglaTarifariaZonaEntrada } from '@parkia/contracts';
import { sql } from 'drizzle-orm';
import {
  boolean,
  customType,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

/**
 * Columna PostGIS. Se escribe y se lee siempre a través de funciones SQL
 * (`ST_GeomFromGeoJSON`, `ST_AsGeoJSON`), por eso el tipo en TypeScript es opaco.
 */
const multiPoligono = customType<{ data: string; driverData: string }>({
  dataType: () => 'geometry(MultiPolygon, 4326)',
});

const auditoria = {
  creadoEn: timestamp({ withTimezone: true }).notNull().defaultNow(),
  actualizadoEn: timestamp({ withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
};

export const municipios = pgTable('municipios', {
  id: uuid()
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  slug: text().notNull().unique(),
  nombre: text().notNull(),
  provincia: text().notNull(),
  zonaHoraria: text().notNull().default('America/Argentina/Buenos_Aires'),
  activo: boolean().notNull().default(true),
  ...auditoria,
});

export const zonas = pgTable(
  'zonas',
  {
    id: uuid()
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    municipioId: uuid()
      .notNull()
      .references(() => municipios.id, { onDelete: 'restrict' }),
    nombre: text().notNull(),
    color: text().notNull(),
    area: multiPoligono().notNull(),
    /** Validada con `reglaTarifariaZonaSchema` antes de guardarse. */
    reglaTarifaria: jsonb().$type<ReglaTarifariaZonaEntrada>().notNull(),
    activa: boolean().notNull().default(true),
    ...auditoria,
  },
  (tabla) => [
    uniqueIndex('zonas_municipio_nombre_unico').on(tabla.municipioId, tabla.nombre),
    index('zonas_area_gist').using('gist', tabla.area),
  ],
);

// ─── Identidad y acceso ──────────────────────────────────────────────────────

/** Roles del personal municipal. Los conductores no necesitan membresía. */
export const rolMunicipal = pgEnum('rol_municipal', ['admin', 'agente', 'comercio']);

export const usuarios = pgTable('usuarios', {
  id: uuid()
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  /** Siempre en minúsculas. */
  email: text().notNull().unique(),
  nombre: text(),
  /** Solo el personal municipal tiene contraseña; los conductores ingresan con código. */
  hashContrasena: text(),
  activo: boolean().notNull().default(true),
  ...auditoria,
});

export const membresias = pgTable(
  'membresias',
  {
    id: uuid()
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    usuarioId: uuid()
      .notNull()
      .references(() => usuarios.id, { onDelete: 'cascade' }),
    municipioId: uuid()
      .notNull()
      .references(() => municipios.id, { onDelete: 'restrict' }),
    rol: rolMunicipal().notNull(),
    ...auditoria,
  },
  (tabla) => [
    uniqueIndex('membresias_usuario_municipio_rol_unico').on(
      tabla.usuarioId,
      tabla.municipioId,
      tabla.rol,
    ),
  ],
);

/** Códigos de un solo uso enviados por email. Se guarda solo su HMAC. */
export const codigosDeAcceso = pgTable(
  'codigos_de_acceso',
  {
    id: uuid()
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    email: text().notNull(),
    hashCodigo: text().notNull(),
    intentos: integer().notNull().default(0),
    expiraEn: timestamp({ withTimezone: true }).notNull(),
    usadoEn: timestamp({ withTimezone: true }),
    creadoEn: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (tabla) => [index('codigos_de_acceso_email_creado').on(tabla.email, tabla.creadoEn)],
);

/** Sesiones con token opaco. Se guarda solo su HMAC: una filtración de la base no expone tokens. */
export const sesiones = pgTable(
  'sesiones',
  {
    id: uuid()
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    usuarioId: uuid()
      .notNull()
      .references(() => usuarios.id, { onDelete: 'cascade' }),
    hashToken: text().notNull().unique(),
    expiraEn: timestamp({ withTimezone: true }).notNull(),
    revocadaEn: timestamp({ withTimezone: true }),
    ip: text(),
    agenteDeUsuario: text(),
    creadoEn: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (tabla) => [index('sesiones_usuario').on(tabla.usuarioId)],
);
