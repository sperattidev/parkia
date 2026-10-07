import { esPatenteValida, normalizarPatente } from '@parkia/domain';
import { z } from 'zod';

export const patenteSchema = z
  .string()
  .refine(esPatenteValida, 'No es una patente argentina válida (ej.: AB123CD o ABC123)')
  .transform((valor) => normalizarPatente(valor))
  .meta({ example: 'AB123CD' });

export const vehiculoNuevoSchema = z
  .object({
    patente: patenteSchema,
    alias: z.string().trim().min(1).max(40).optional().meta({ example: 'Auto de casa' }),
  })
  .meta({ id: 'VehiculoNuevo' });

export const vehiculoSchema = z
  .object({ id: z.uuid(), patente: z.string(), alias: z.string().nullable() })
  .meta({ id: 'Vehiculo' });

export type Vehiculo = z.infer<typeof vehiculoSchema>;

export const tipoDeMovimientoSchema = z.enum(['carga', 'consumo', 'reintegro', 'ajuste']);

export const billeteraSchema = z
  .object({
    municipio: z.string(),
    saldo: z.int().meta({ description: 'Centavos' }),
    saldoFormateado: z.string().meta({ example: '$ 5.000,00' }),
    movimientos: z.array(
      z.object({
        id: z.uuid(),
        tipo: tipoDeMovimientoSchema,
        importe: z.int().meta({ description: 'Centavos, con signo' }),
        saldoResultante: z.int(),
        descripcion: z.string(),
        creadoEn: z.iso.datetime(),
      }),
    ),
  })
  .meta({ id: 'Billetera' });

export type Billetera = z.infer<typeof billeteraSchema>;

/** Solo fuera de producción: simula una carga hasta integrar Mercado Pago. */
export const cargaDePruebaSchema = z
  .object({
    importe: z
      .int()
      .positive()
      .max(10_000_000)
      .meta({ description: 'Centavos (máx. $100.000)', example: 500_000 }),
  })
  .meta({ id: 'CargaDePrueba' });
