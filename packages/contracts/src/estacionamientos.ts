import { z } from 'zod';

import { patenteSchema } from './billetera.js';
import { ladoSchema } from './zonas.js';

const zonaBreveSchema = z.object({ id: z.uuid(), nombre: z.string() });

export const inicioDeEstacionamientoSchema = z
  .object({
    cuadraId: z.uuid(),
    lado: ladoSchema,
    altura: z
      .int()
      .positive()
      .optional()
      .meta({ description: 'Si se omite, se usa el centro de la cuadra en esa mano' }),
    lugar: z
      .int()
      .positive()
      .optional()
      .meta({ description: 'Obligatorio en cuadras con lugares numerados' }),
    patente: patenteSchema,
  })
  .meta({ id: 'InicioDeEstacionamiento' });

/** Dónde quedó el vehículo: lo ven el conductor y el agente. */
export const ubicacionDeEstacionamientoSchema = z
  .object({
    cuadraId: z.uuid(),
    calle: z.string(),
    altura: z.int(),
    lado: ladoSchema,
    lugar: z.int().nullable(),
    direccion: z.string().meta({ example: 'Sarmiento 750 · mano par · lugar 7' }),
  })
  .meta({ id: 'UbicacionDeEstacionamiento' });

export type UbicacionDeEstacionamiento = z.infer<typeof ubicacionDeEstacionamientoSchema>;

export const estacionamientoSchema = z
  .object({
    id: z.uuid(),
    municipio: z.string(),
    zona: zonaBreveSchema,
    ubicacion: ubicacionDeEstacionamientoSchema.nullable(),
    patente: z.string(),
    estado: z.enum(['activo', 'finalizado']),
    inicio: z.iso.datetime(),
    venceEn: z.iso.datetime().meta({ description: 'Hasta cuándo cubre el saldo' }),
    fin: z.iso.datetime().nullable(),
    importe: z.int().meta({
      description: 'Centavos: lo cobrado si finalizó, o lo acumulado hasta ahora si sigue activo',
    }),
    importeFormateado: z.string().meta({ example: '$ 750,00' }),
  })
  .meta({ id: 'Estacionamiento' });

export type Estacionamiento = z.infer<typeof estacionamientoSchema>;

export const resultadoDeControlSchema = z
  .enum([
    'habilitado',
    'fuera_de_horario',
    'sin_estacionamiento',
    'vencido',
    'otra_zona',
    'fuera_de_zona',
  ])
  .meta({ id: 'ResultadoDeControl' });

export type ResultadoDeControl = z.infer<typeof resultadoDeControlSchema>;

export const solicitudDeControlSchema = z
  .object({
    patente: patenteSchema,
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
  })
  .meta({ id: 'SolicitudDeControl' });

export const controlSchema = z
  .object({
    id: z.uuid(),
    patente: z.string(),
    resultado: resultadoDeControlSchema,
    habilitado: z
      .boolean()
      .meta({ description: 'Si el vehículo puede estar estacionado ahí ahora' }),
    zona: zonaBreveSchema.nullable(),
    /** Cuadra en la que está el agente al controlar. */
    cuadra: z
      .object({ id: z.uuid(), calle: z.string(), alturaDesde: z.int(), alturaHasta: z.int() })
      .nullable(),
    estacionamiento: z
      .object({
        id: z.uuid(),
        zona: zonaBreveSchema,
        ubicacion: ubicacionDeEstacionamientoSchema.nullable(),
        inicio: z.iso.datetime(),
        venceEn: z.iso.datetime(),
      })
      .nullable(),
    registradoEn: z.iso.datetime(),
  })
  .meta({ id: 'Control' });

export type Control = z.infer<typeof controlSchema>;
