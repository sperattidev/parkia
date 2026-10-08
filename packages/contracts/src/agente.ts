import { z } from 'zod';

import { resultadoDeControlSchema, ubicacionDeEstacionamientoSchema } from './estacionamientos.js';
import { cuadraSchema, zonaResumenSchema } from './zonas.js';

/**
 * Situación de un vehículo para el agente: `por_vencer` si le quedan menos de
 * 10 minutos; `vencido` si se le agotó el saldo y no volvió a estacionar.
 */
export const situacionSchema = z
  .enum(['vigente', 'por_vencer', 'vencido'])
  .meta({ id: 'Situacion' });

export type Situacion = z.infer<typeof situacionSchema>;

const vehiculoDelPadronSchema = z.object({
  estacionamientoId: z.uuid(),
  patente: z.string(),
  altura: z.int(),
  lugar: z.int().nullable(),
  inicio: z.iso.datetime(),
  venceEn: z.iso.datetime(),
  situacion: situacionSchema,
  controladoEn: z.iso.datetime().nullable().meta({
    description: 'Último control de la patente desde que inició este estacionamiento',
  }),
});

export type VehiculoDelPadron = z.infer<typeof vehiculoDelPadronSchema>;

const manoDelPadronSchema = z.object({
  capacidad: z.int(),
  vehiculos: z.array(vehiculoDelPadronSchema),
});

export const padronSchema = z
  .object({
    cuadra: cuadraSchema,
    zona: zonaResumenSchema,
    manos: z.object({ par: manoDelPadronSchema, impar: manoDelPadronSchema }),
    ultimoControl: z.iso
      .datetime()
      .nullable()
      .meta({ description: 'Último control en la cuadra hoy' }),
  })
  .meta({
    id: 'Padron',
    description:
      'Vehículos declarados en la cuadra (en curso y vencidos recientes): el agente compara con lo que ve',
  });

export type Padron = z.infer<typeof padronSchema>;

const avisoDelRadarSchema = z.object({
  estacionamientoId: z.uuid(),
  patente: z.string(),
  zona: z.object({ id: z.uuid(), nombre: z.string(), color: z.string() }),
  ubicacion: ubicacionDeEstacionamientoSchema,
  posicion: z.tuple([z.number(), z.number()]).meta({ description: '[lng, lat] aproximado' }),
  venceEn: z.iso.datetime(),
  situacion: situacionSchema,
  distanciaMetros: z.number().nullable(),
  controladoEn: z.iso.datetime().nullable(),
});

export type AvisoDelRadar = z.infer<typeof avisoDelRadarSchema>;

export const radarSchema = z
  .object({
    vencidos: z.array(avisoDelRadarSchema),
    porVencer: z.array(avisoDelRadarSchema),
  })
  .meta({
    id: 'Radar',
    description:
      'Vehículos con saldo agotado en las últimas 2 horas y los que vencen en menos de 10 minutos, los más cercanos primero',
  });

export type Radar = z.infer<typeof radarSchema>;

export const controlBreveSchema = z.object({
  id: z.uuid(),
  patente: z.string(),
  resultado: resultadoDeControlSchema,
  habilitado: z.boolean(),
  calle: z.string().nullable(),
  registradoEn: z.iso.datetime(),
});

export type ControlBreve = z.infer<typeof controlBreveSchema>;

export const jornadaSchema = z
  .object({
    desde: z.iso.datetime().meta({ description: 'Inicio del día en el municipio' }),
    controles: z.int(),
    infracciones: z.int().meta({ description: 'Sin estacionamiento, vencidos u otra zona' }),
    porResultado: z.record(resultadoDeControlSchema, z.int()),
    ultimos: z.array(controlBreveSchema),
    cobertura: z
      .array(z.object({ cuadraId: z.uuid(), controles: z.int(), ultimoControl: z.iso.datetime() }))
      .meta({ description: 'Cuadras controladas hoy por todo el equipo' }),
  })
  .meta({ id: 'Jornada', description: 'Resumen del día del agente y cobertura del equipo' });

export type Jornada = z.infer<typeof jornadaSchema>;
