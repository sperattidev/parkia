import type { ReglaTarifariaZonaEntrada } from '@parkia/contracts';
import { sql } from 'drizzle-orm';
import {
  bigint,
  boolean,
  check,
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

// ─── Vehículos y billetera ───────────────────────────────────────────────────

export const vehiculos = pgTable(
  'vehiculos',
  {
    id: uuid()
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    usuarioId: uuid()
      .notNull()
      .references(() => usuarios.id, { onDelete: 'cascade' }),
    /** Normalizada (ver `normalizarPatente`). Una misma patente puede estar en varias cuentas. */
    patente: text().notNull(),
    alias: text(),
    creadoEn: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (tabla) => [uniqueIndex('vehiculos_usuario_patente_unico').on(tabla.usuarioId, tabla.patente)],
);

/**
 * Saldo prepago de un conductor en un municipio: el dinero cargado se acredita
 * en la cuenta de ese municipio y solo paga estacionamiento allí.
 */
export const billeteras = pgTable(
  'billeteras',
  {
    id: uuid()
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    usuarioId: uuid()
      .notNull()
      .references(() => usuarios.id, { onDelete: 'restrict' }),
    municipioId: uuid()
      .notNull()
      .references(() => municipios.id, { onDelete: 'restrict' }),
    /** Centavos. Siempre igual a la suma de sus movimientos. */
    saldo: bigint({ mode: 'number' }).notNull().default(0),
    ...auditoria,
  },
  (tabla) => [
    uniqueIndex('billeteras_usuario_municipio_unico').on(tabla.usuarioId, tabla.municipioId),
    check('billeteras_saldo_no_negativo', sql`${tabla.saldo} >= 0`),
  ],
);

export const tipoDeMovimiento = pgEnum('tipo_de_movimiento', [
  'carga',
  'consumo',
  'reintegro',
  'ajuste',
]);

/** Libro de movimientos. Solo admite inserciones (lo garantiza un trigger). */
export const movimientos = pgTable(
  'movimientos',
  {
    id: uuid()
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    billeteraId: uuid()
      .notNull()
      .references(() => billeteras.id, { onDelete: 'restrict' }),
    tipo: tipoDeMovimiento().notNull(),
    /** Centavos con signo: positivo acredita, negativo debita. */
    importe: bigint({ mode: 'number' }).notNull(),
    saldoResultante: bigint({ mode: 'number' }).notNull(),
    /** Origen del movimiento (id de pago, de estacionamiento…). Evita duplicados. */
    referencia: text().notNull(),
    descripcion: text().notNull(),
    /** Quién lo registró, si fue una persona (ajustes, cargas en comercio). */
    registradoPor: uuid().references(() => usuarios.id, { onDelete: 'restrict' }),
    creadoEn: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (tabla) => [
    uniqueIndex('movimientos_tipo_referencia_unico').on(tabla.tipo, tabla.referencia),
    index('movimientos_billetera_creado').on(tabla.billeteraId, tabla.creadoEn),
    check('movimientos_importe_no_cero', sql`${tabla.importe} <> 0`),
    check('movimientos_saldo_no_negativo', sql`${tabla.saldoResultante} >= 0`),
  ],
);
