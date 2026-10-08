import { z } from 'zod';

import { emailSchema, rolMunicipalSchema } from './autenticacion.js';
import { resultadoDeControlSchema } from './estacionamientos.js';
import { reglaTarifariaZonaSchema } from './tarifas.js';
import { lineaSchema, slugMunicipioSchema, zonaResumenSchema } from './zonas.js';

const fechaSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato esperado YYYY-MM-DD')
  .meta({ example: '2026-10-05' });

/** Período en fechas locales del municipio, ambas incluidas. */
export const periodoSchema = z
  .object({ desde: fechaSchema.optional(), hasta: fechaSchema.optional() })
  .meta({ description: 'Si se omite, los últimos 30 días' });

export const paginaSchema = z.object({
  pagina: z.coerce.number().int().min(1).default(1),
  porPagina: z.coerce.number().int().min(1).max(200).default(50),
});

const zonaBreveSchema = z.object({ id: z.uuid(), nombre: z.string(), color: z.string() });

// ─── Resumen ─────────────────────────────────────────────────────────────────

export const resumenDeGestionSchema = z
  .object({
    periodo: z.object({ desde: fechaSchema, hasta: fechaSchema }),
    recaudado: z.int().meta({ description: 'Centavos cobrados por estacionamientos finalizados' }),
    cargas: z.int().meta({ description: 'Centavos cargados como saldo' }),
    estacionamientos: z.int(),
    minutosPromedio: z.int(),
    controles: z.int(),
    infracciones: z.int(),
    porDia: z.array(
      z.object({ fecha: fechaSchema, recaudado: z.int(), estacionamientos: z.int() }),
    ),
    porHora: z
      .array(z.object({ hora: z.int().min(0).max(23), estacionamientos: z.int() }))
      .meta({ description: 'Estacionamientos iniciados por hora local del día' }),
    porZona: z.array(
      z.object({
        zona: zonaBreveSchema,
        recaudado: z.int(),
        estacionamientos: z.int(),
        capacidad: z.int(),
        ocupadosAhora: z.int(),
      }),
    ),
    ahora: z.object({ activos: z.int(), capacidad: z.int() }),
  })
  .meta({ id: 'ResumenDeGestion' });

export type ResumenDeGestion = z.infer<typeof resumenDeGestionSchema>;

// ─── Listados ────────────────────────────────────────────────────────────────

export const filtroDeEstacionamientosSchema = periodoSchema.extend({
  patente: z.string().trim().max(10).optional(),
  zonaId: z.uuid().optional(),
  estado: z.enum(['activo', 'finalizado']).optional(),
});

export const filaDeEstacionamientoSchema = z.object({
  id: z.uuid(),
  patente: z.string(),
  zona: zonaBreveSchema,
  direccion: z.string().nullable(),
  inicio: z.iso.datetime(),
  fin: z.iso.datetime().nullable(),
  minutos: z.int(),
  importe: z.int(),
  estado: z.enum(['activo', 'finalizado']),
  motivoDeCierre: z.enum(['conductor', 'saldo_agotado', 'duracion_maxima']).nullable(),
});

export type FilaDeEstacionamiento = z.infer<typeof filaDeEstacionamientoSchema>;

export const filtroDeControlesSchema = periodoSchema.extend({
  patente: z.string().trim().max(10).optional(),
  resultado: resultadoDeControlSchema.optional(),
  agenteId: z.uuid().optional(),
});

export const filaDeControlSchema = z.object({
  id: z.uuid(),
  patente: z.string(),
  resultado: resultadoDeControlSchema,
  habilitado: z.boolean(),
  agente: z.object({ id: z.uuid(), nombre: z.string() }),
  calle: z.string().nullable(),
  zona: z.string().nullable(),
  precisionMetros: z.int().nullable(),
  registradoEn: z.iso.datetime(),
});

export type FilaDeControl = z.infer<typeof filaDeControlSchema>;

export function listaPaginadaSchema<T extends z.ZodType>(elemento: T) {
  return z.object({
    elementos: z.array(elemento),
    total: z.int(),
    pagina: z.int(),
    porPagina: z.int(),
  });
}

export interface ListaPaginada<T> {
  elementos: T[];
  total: number;
  pagina: number;
  porPagina: number;
}

// ─── Personal ────────────────────────────────────────────────────────────────

/** Roles que un municipio asigna desde su panel (comercio llegará con los puntos de venta). */
export const rolAsignableSchema = rolMunicipalSchema.extract(['agente', 'admin']);

export const personaSchema = z
  .object({
    usuarioId: z.uuid(),
    email: z.string(),
    nombre: z.string().nullable(),
    rol: rolMunicipalSchema,
    activo: z.boolean(),
    debeCambiarContrasena: z.boolean(),
    ultimoIngreso: z.iso.datetime().nullable(),
    controlesHoy: z.int(),
  })
  .meta({ id: 'Persona' });

export type Persona = z.infer<typeof personaSchema>;

export const altaDePersonaSchema = z
  .object({
    email: emailSchema,
    nombre: z.string().trim().min(2).max(80),
    rol: rolAsignableSchema,
  })
  .meta({ id: 'AltaDePersona' });

export const cambioDePersonaSchema = z
  .object({ rol: rolAsignableSchema.optional(), activo: z.boolean().optional() })
  .refine((cambio) => cambio.rol !== undefined || cambio.activo !== undefined, {
    message: 'Indicá el rol o el estado',
  })
  .meta({ id: 'CambioDePersona' });

export const credencialTemporalSchema = z
  .object({
    persona: personaSchema,
    contrasenaTemporal: z.string().nullable().meta({
      description:
        'Se muestra una sola vez; nula si la persona ya tenía cuenta de personal y conserva su contraseña',
    }),
  })
  .meta({ id: 'CredencialTemporal' });

export type CredencialTemporal = z.infer<typeof credencialTemporalSchema>;

// ─── Zonas, tarifas y cuadras ────────────────────────────────────────────────

const colorSchema = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, 'Color en formato #RRGGBB')
  .meta({ example: '#2754E6' });

export const zonaDeGestionSchema = z
  .object({
    id: z.uuid(),
    nombre: z.string(),
    color: z.string(),
    activa: z.boolean(),
    regla: z.unknown().meta({ description: 'Regla tarifaria (ver ReglaTarifariaZona)' }),
    resumen: zonaResumenSchema,
    cuadras: z.int(),
    capacidad: z.int(),
  })
  .meta({ id: 'ZonaDeGestion' });

export type ZonaDeGestion = z.infer<typeof zonaDeGestionSchema>;

export const zonaNuevaSchema = z
  .object({
    nombre: z.string().trim().min(2).max(60),
    color: colorSchema,
    regla: reglaTarifariaZonaSchema,
  })
  .meta({ id: 'ZonaNueva' });

export const cambioDeZonaSchema = z
  .object({
    nombre: z.string().trim().min(2).max(60).optional(),
    color: colorSchema.optional(),
    activa: z.boolean().optional(),
    regla: reglaTarifariaZonaSchema.optional(),
  })
  .meta({ id: 'CambioDeZona' });

export const cuadrasDeGestionSchema = z
  .object({
    type: z.literal('FeatureCollection'),
    features: z.array(
      z.object({
        type: z.literal('Feature'),
        id: z.uuid(),
        geometry: lineaSchema,
        properties: z.object({
          zonaId: z.uuid().nullable(),
          calle: z.string(),
          alturaDesde: z.int(),
          alturaHasta: z.int(),
          lugares: z.object({ par: z.int(), impar: z.int() }),
          lugaresNumerados: z.boolean(),
          activa: z.boolean(),
          color: z.string(),
          ocupados: z.object({ par: z.int(), impar: z.int() }),
        }),
      }),
    ),
  })
  .meta({ id: 'CuadrasDeGestion', description: 'Todas las cuadras, con o sin zona' });

export type CuadrasDeGestion = z.infer<typeof cuadrasDeGestionSchema>;

const lugaresSchema = z.int().min(0).max(200);

export const cambioDeCuadraSchema = z
  .object({
    zonaId: z.uuid().nullable().optional(),
    lugaresPar: lugaresSchema.optional(),
    lugaresImpar: lugaresSchema.optional(),
    lugaresNumerados: z.boolean().optional(),
    activa: z.boolean().optional(),
  })
  .meta({ id: 'CambioDeCuadra' });

// ─── Auditoría ───────────────────────────────────────────────────────────────

export const entradaDeAuditoriaSchema = z
  .object({
    id: z.uuid(),
    accion: z.string().meta({ example: 'zona.tarifa' }),
    entidad: z.string(),
    entidadId: z.string(),
    usuario: z.object({ email: z.string(), nombre: z.string().nullable() }),
    antes: z.unknown(),
    despues: z.unknown(),
    creadoEn: z.iso.datetime(),
  })
  .meta({ id: 'EntradaDeAuditoria' });

export type EntradaDeAuditoria = z.infer<typeof entradaDeAuditoriaSchema>;

// ─── Plataforma (equipo de Parkia) ───────────────────────────────────────────

export const municipioDePlataformaSchema = z
  .object({
    slug: z.string(),
    nombre: z.string(),
    provincia: z.string(),
    zonaHoraria: z.string(),
    activo: z.boolean(),
    zonas: z.int(),
    cuadras: z.int(),
    personal: z.int(),
    estacionamientosHoy: z.int(),
    recaudado30Dias: z.int(),
  })
  .meta({ id: 'MunicipioDePlataforma' });

export type MunicipioDePlataforma = z.infer<typeof municipioDePlataformaSchema>;

export const municipioNuevoSchema = z
  .object({
    slug: slugMunicipioSchema,
    nombre: z.string().trim().min(2).max(80),
    provincia: z.string().trim().min(2).max(60),
    zonaHoraria: z.string().default('America/Argentina/Buenos_Aires'),
    administrador: altaDePersonaSchema
      .omit({ rol: true })
      .meta({ description: 'Primer administrador del municipio' }),
  })
  .meta({ id: 'MunicipioNuevo' });

export const altaDeMunicipioSchema = z
  .object({ municipio: municipioDePlataformaSchema, administrador: credencialTemporalSchema })
  .meta({ id: 'AltaDeMunicipio' });

export type AltaDeMunicipio = z.infer<typeof altaDeMunicipioSchema>;

export const cambioDeMunicipioSchema = z
  .object({
    nombre: z.string().trim().min(2).max(80).optional(),
    provincia: z.string().trim().min(2).max(60).optional(),
    activo: z.boolean().optional(),
  })
  .meta({ id: 'CambioDeMunicipio' });
