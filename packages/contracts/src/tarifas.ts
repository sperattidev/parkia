import {
  ErrorDeDominio,
  centavos,
  validarReglaTarifaria,
  type FechaLocal,
  type HoraLocal,
  type ReglaTarifaria,
} from '@parkia/domain';
import { z } from 'zod';

/** Importe en centavos enteros. */
export const centavosSchema = z
  .int()
  .min(0)
  .transform((valor) => centavos(valor))
  .meta({ description: 'Importe en centavos de peso (entero)', example: 100000 });

const horaLocalSchema = z
  .string()
  .regex(/^\d{2}:\d{2}$/, 'Formato esperado HH:mm')
  .transform((valor) => valor as HoraLocal)
  .meta({ example: '08:00' });

const fechaLocalSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato esperado YYYY-MM-DD')
  .transform((valor) => valor as FechaLocal)
  .meta({ example: '2026-10-12' });

const diaSemanaSchema = z
  .literal([0, 1, 2, 3, 4, 5, 6])
  .meta({ description: '0 = domingo … 6 = sábado' });

const franjaSchema = z.object({ desde: horaLocalSchema, hasta: horaLocalSchema });

export const reglaTarifariaZonaSchema = z
  .object({
    horario: z.array(franjaSchema.extend({ dias: z.array(diaSemanaSchema).min(1) })).min(1),
    diasEspeciales: z
      .array(
        z.object({
          fecha: fechaLocalSchema,
          franjas: z.array(franjaSchema),
          motivo: z.string().trim().min(1).max(120).optional(),
        }),
      )
      .optional(),
    fraccionMinutos: z.int().positive(),
    minimoMinutos: z.int().min(0),
    toleranciaMinutos: z.int().min(0),
    tramos: z.array(z.object({ desdeMinuto: z.int().min(0), precioHora: centavosSchema })).min(1),
    topePorJornada: centavosSchema.optional(),
  })
  .superRefine((regla, ctx) => {
    // La coherencia de la regla la decide el dominio: una sola fuente de verdad.
    try {
      validarReglaTarifaria({ ...regla, zonaHoraria: 'UTC' });
    } catch (error) {
      if (!(error instanceof ErrorDeDominio)) throw error;
      ctx.addIssue({ code: 'custom', message: error.message, params: { codigo: error.codigo } });
    }
  })
  .meta({ id: 'ReglaTarifariaZona', description: 'Configuración tarifaria de una zona' });

/** Regla tarifaria tal como se guarda por zona: la zona horaria la aporta el municipio. */
export type ReglaTarifariaZona = Omit<ReglaTarifaria, 'zonaHoraria'>;

export type ReglaTarifariaZonaEntrada = z.input<typeof reglaTarifariaZonaSchema>;
