import { z } from 'zod';

const instanteSchema = z.iso
  .datetime({ offset: true })
  .transform((valor) => new Date(valor))
  .meta({ example: '2026-10-05T10:00:00-03:00' });

export const cotizacionSolicitudSchema = z
  .object({
    zonaId: z.uuid(),
    inicio: instanteSchema,
    fin: instanteSchema,
  })
  .meta({ id: 'CotizacionSolicitud' });

export type CotizacionSolicitud = z.infer<typeof cotizacionSolicitudSchema>;

export const cotizacionSchema = z
  .object({
    zonaId: z.uuid(),
    importe: z.int().meta({ description: 'Centavos' }),
    importeFormateado: z.string().meta({ example: '$ 1.375,00' }),
    minutosCobrables: z.int(),
    jornadas: z.array(
      z.object({
        fecha: z.string().meta({ example: '2026-10-05' }),
        minutosCobrables: z.int(),
        minutosFacturados: z.int(),
        enTolerancia: z.boolean(),
        importeSinTope: z.int(),
        aplicoTope: z.boolean(),
        importe: z.int(),
      }),
    ),
  })
  .meta({ id: 'Cotizacion' });

export type Cotizacion = z.infer<typeof cotizacionSchema>;
