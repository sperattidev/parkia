import { z } from 'zod';

import { patenteSchema } from './billetera.js';

const zonaBreveSchema = z.object({ id: z.uuid(), nombre: z.string() });

export const inicioDeEstacionamientoSchema = z
  .object({ zonaId: z.uuid(), patente: patenteSchema })
  .meta({ id: 'InicioDeEstacionamiento' });

export const estacionamientoSchema = z
  .object({
    id: z.uuid(),
    municipio: z.string(),
    zona: zonaBreveSchema,
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
    estacionamiento: z
      .object({
        id: z.uuid(),
        zona: zonaBreveSchema,
        inicio: z.iso.datetime(),
        venceEn: z.iso.datetime(),
      })
      .nullable(),
    registradoEn: z.iso.datetime(),
  })
  .meta({ id: 'Control' });

export type Control = z.infer<typeof controlSchema>;
