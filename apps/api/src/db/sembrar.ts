import { reglaTarifariaZonaSchema, type MultiPoligono } from '@parkia/contracts';
import { sql } from 'drizzle-orm';

import { validarEntorno } from '../config/entorno.js';
import { crearConexion, type BaseDeDatos } from './conexion.js';
import { municipios, zonas } from './esquema.js';

/**
 * Microcentro de Firmat. **Polígono demostrativo**: rodea el centro comercial a
 * partir de la Municipalidad (Buenos Aires 1090). Las calles exactas se definen
 * con el municipio y la ordenanza.
 */
const MICROCENTRO_FIRMAT: MultiPoligono = {
  type: 'MultiPolygon',
  coordinates: [
    [
      [
        [-61.4905, -33.457],
        [-61.4845, -33.457],
        [-61.4845, -33.463],
        [-61.4905, -33.463],
        [-61.4905, -33.457],
      ],
    ],
  ],
};

/** Valores de referencia para la demo; el municipio fija los definitivos por ordenanza. */
const REGLA_MICROCENTRO = reglaTarifariaZonaSchema.parse({
  horario: [
    { dias: [1, 2, 3, 4, 5], desde: '08:00', hasta: '20:00' },
    { dias: [6], desde: '08:00', hasta: '13:00' },
  ],
  diasEspeciales: [
    { fecha: '2026-11-23', franjas: [], motivo: 'Día de la Soberanía Nacional' },
    { fecha: '2026-12-08', franjas: [], motivo: 'Inmaculada Concepción de María' },
    { fecha: '2026-12-25', franjas: [], motivo: 'Navidad' },
  ],
  fraccionMinutos: 15,
  minimoMinutos: 30,
  toleranciaMinutos: 5,
  tramos: [
    { desdeMinuto: 0, precioHora: 100_000 },
    { desdeMinuto: 60, precioHora: 150_000 },
    { desdeMinuto: 120, precioHora: 165_000 },
  ],
  topePorJornada: 1_000_000,
});

/** Carga los datos de demostración. Es idempotente: se puede correr varias veces. */
export async function sembrar(db: BaseDeDatos): Promise<void> {
  await db.transaction(async (tx) => {
    const [firmat] = await tx
      .insert(municipios)
      .values({ slug: 'firmat', nombre: 'Firmat', provincia: 'Santa Fe' })
      .onConflictDoUpdate({
        target: municipios.slug,
        set: { nombre: sql`excluded.nombre`, provincia: sql`excluded.provincia` },
      })
      .returning({ id: municipios.id });

    if (!firmat) throw new Error('No se pudo crear el municipio de Firmat.');

    await tx
      .insert(zonas)
      .values({
        municipioId: firmat.id,
        nombre: 'Microcentro',
        color: '#2563EB',
        area: sql`ST_SetSRID(ST_GeomFromGeoJSON(${JSON.stringify(MICROCENTRO_FIRMAT)}), 4326)`,
        reglaTarifaria: REGLA_MICROCENTRO,
      })
      .onConflictDoUpdate({
        target: [zonas.municipioId, zonas.nombre],
        set: {
          color: sql`excluded.color`,
          area: sql`excluded.area`,
          reglaTarifaria: sql`excluded.regla_tarifaria`,
        },
      });
  });
}

if (import.meta.main) {
  const { DATABASE_URL } = validarEntorno(process.env);
  const { db, pool } = crearConexion(DATABASE_URL, 1);
  try {
    await sembrar(db);
    console.info('Datos de demostración cargados (Firmat · Microcentro).');
  } finally {
    await pool.end();
  }
}
