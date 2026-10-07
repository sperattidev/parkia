import type { ReglaTarifariaZonaEntrada } from '@parkia/contracts';
import { sql } from 'drizzle-orm';
import {
  boolean,
  customType,
  index,
  jsonb,
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
