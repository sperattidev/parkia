import { reglaTarifariaZonaSchema, type ReglaTarifariaZonaEntrada } from '@parkia/contracts';
import { sql } from 'drizzle-orm';
import { z } from 'zod';

import { validarEntorno } from '../config/entorno.js';
import { crearConexion, type BaseDeDatos } from './conexion.js';
import { cuadras, municipios, zonas } from './esquema.js';
import cuadrasDeFirmat from './semillas/firmat-cuadras.json' with { type: 'json' };

const FERIADOS = [
  { fecha: '2026-11-23', franjas: [], motivo: 'Día de la Soberanía Nacional' },
  { fecha: '2026-12-08', franjas: [], motivo: 'Inmaculada Concepción de María' },
  { fecha: '2026-12-25', franjas: [], motivo: 'Navidad' },
];

/** Zonas de demostración. Valores de referencia: el municipio fija los definitivos por ordenanza. */
const ZONAS: readonly {
  clave: string;
  nombre: string;
  color: string;
  regla: ReglaTarifariaZonaEntrada;
}[] = [
  {
    clave: 'microcentro',
    nombre: 'Microcentro',
    color: '#2754E6',
    regla: {
      horario: [
        { dias: [1, 2, 3, 4, 5], desde: '08:00', hasta: '20:00' },
        { dias: [6], desde: '08:00', hasta: '13:00' },
      ],
      diasEspeciales: FERIADOS,
      fraccionMinutos: 15,
      minimoMinutos: 30,
      toleranciaMinutos: 5,
      tramos: [
        { desdeMinuto: 0, precioHora: 100_000 },
        { desdeMinuto: 60, precioHora: 150_000 },
        { desdeMinuto: 120, precioHora: 165_000 },
      ],
      topePorJornada: 1_000_000,
    },
  },
  {
    clave: 'quemada',
    nombre: 'La Quemada',
    color: '#0E9F6E',
    regla: {
      horario: [{ dias: [1, 2, 3, 4, 5], desde: '08:00', hasta: '20:00' }],
      diasEspeciales: FERIADOS,
      fraccionMinutos: 15,
      minimoMinutos: 30,
      toleranciaMinutos: 10,
      tramos: [{ desdeMinuto: 0, precioHora: 60_000 }],
      topePorJornada: 400_000,
    },
  },
];

const cuadraDeSemillaSchema = z.object({
  zona: z.string(),
  calle: z.string(),
  alturaDesde: z.int(),
  alturaHasta: z.int(),
  lugaresPar: z.int(),
  lugaresImpar: z.int(),
  lugaresNumerados: z.boolean(),
  coordenadas: z.array(z.tuple([z.number(), z.number()])).min(2),
});

/**
 * Carga los datos de demostración de Firmat: el municipio, dos zonas y sus
 * cuadras reales (geometría de OpenStreetMap, ver `semillas/LEEME.md`).
 * Es idempotente: se puede correr varias veces.
 */
export async function sembrar(db: BaseDeDatos): Promise<void> {
  const cuadrasDemo = z.array(cuadraDeSemillaSchema).parse(cuadrasDeFirmat);

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

    const idsDeZona = new Map<string, string>();
    for (const zona of ZONAS) {
      const [fila] = await tx
        .insert(zonas)
        .values({
          municipioId: firmat.id,
          nombre: zona.nombre,
          color: zona.color,
          reglaTarifaria: reglaTarifariaZonaSchema.parse(zona.regla),
        })
        .onConflictDoUpdate({
          target: [zonas.municipioId, zonas.nombre],
          set: { color: sql`excluded.color`, reglaTarifaria: sql`excluded.regla_tarifaria` },
        })
        .returning({ id: zonas.id });
      if (!fila) throw new Error(`No se pudo crear la zona ${zona.nombre}.`);
      idsDeZona.set(zona.clave, fila.id);
    }

    for (const cuadra of cuadrasDemo) {
      const linea = { type: 'LineString', coordinates: cuadra.coordenadas };
      await tx
        .insert(cuadras)
        .values({
          municipioId: firmat.id,
          zonaId: idsDeZona.get(cuadra.zona) ?? null,
          calle: cuadra.calle,
          alturaDesde: cuadra.alturaDesde,
          alturaHasta: cuadra.alturaHasta,
          geometria: sql`ST_SetSRID(ST_GeomFromGeoJSON(${JSON.stringify(linea)}), 4326)`,
          lugaresPar: cuadra.lugaresPar,
          lugaresImpar: cuadra.lugaresImpar,
          lugaresNumerados: cuadra.lugaresNumerados,
        })
        .onConflictDoUpdate({
          target: [cuadras.municipioId, cuadras.calle, cuadras.alturaDesde],
          set: {
            zonaId: sql`excluded.zona_id`,
            alturaHasta: sql`excluded.altura_hasta`,
            geometria: sql`excluded.geometria`,
            lugaresPar: sql`excluded.lugares_par`,
            lugaresImpar: sql`excluded.lugares_impar`,
            lugaresNumerados: sql`excluded.lugares_numerados`,
          },
        });
    }
  });
}

if (import.meta.main) {
  const { DATABASE_URL } = validarEntorno(process.env);
  const { db, pool } = crearConexion(DATABASE_URL, 1);
  try {
    await sembrar(db);
    console.info('Datos de demostración cargados: Firmat · Microcentro y La Quemada.');
  } finally {
    await pool.end();
  }
}
